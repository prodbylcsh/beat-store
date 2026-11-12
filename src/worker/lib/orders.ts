import type { Env, IntentRow, OrderRow } from '../types';
import { addYears, nowIso } from './db';
import { uuid } from './crypto';

/**
 * Zpracování událostí z Lemon Squeezy. Volá se až PO ověření podpisu.
 * Zdrojem pravdy o zaplacení je výhradně tato funkce — nic jiného licenci neuděluje.
 */

export interface LemonEvent {
  meta?: { event_name?: string; custom_data?: Record<string, unknown> | null; test_mode?: boolean };
  data?: { id?: string | number; type?: string; attributes?: Record<string, any> };
}

export interface ProcessResult {
  /** processed = stav změněn; ignored = nic k provedení; rejected = neprošla validace; retry = zkusit později (5xx) */
  outcome: 'processed' | 'ignored' | 'rejected' | 'retry';
  detail: string;
  orderId?: string;
  /** vedlejší efekty k provedení mimo DB transakci */
  cancelSubscriptions?: string[];
  notify?: string;
}

/** Den po konci období ještě necháváme stažení aktivní (zpožděná obnova platby). */
const GRACE_MS = 3 * 24 * 3600_000;

export function isLicenseActive(o: Pick<OrderRow, 'payment_status' | 'license_status' | 'term_ends_at'>, now = Date.now()): boolean {
  if (o.payment_status !== 'paid' && o.payment_status !== 'partial_refund') return false;
  if (o.license_status === 'revoked' || o.license_status === 'expired') return false;
  if (!o.term_ends_at) return true;
  return now < new Date(o.term_ends_at).getTime() + GRACE_MS;
}

function modeMatches(env: Env, testMode: unknown): boolean {
  const isTest = testMode === true;
  return env.APP_ENV === 'production' ? !isTest : isTest;
}

export async function processLemonEvent(env: Env, ev: LemonEvent): Promise<ProcessResult> {
  const name = ev.meta?.event_name;
  const a = ev.data?.attributes;
  if (!name || !a || ev.data?.id === undefined) return { outcome: 'rejected', detail: 'malformed' };

  if (env.LEMON_STORE_ID && String(a.store_id) !== String(env.LEMON_STORE_ID)) {
    return { outcome: 'rejected', detail: 'foreign_store' };
  }
  if (!modeMatches(env, a.test_mode)) return { outcome: 'rejected', detail: 'mode_mismatch' };

  switch (name) {
    case 'order_created':
      return orderCreated(env, ev);
    case 'order_refunded':
      return orderRefunded(env, ev);
    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_cancelled':
    case 'subscription_resumed':
    case 'subscription_expired':
    case 'subscription_paused':
    case 'subscription_unpaused':
      return subscriptionChanged(env, ev);
    default:
      return { outcome: 'ignored', detail: `unhandled:${name}` };
  }
}

async function orderCreated(env: Env, ev: LemonEvent): Promise<ProcessResult> {
  const a = ev.data!.attributes!;
  const lemonOrderId = String(ev.data!.id);

  const existing = await env.DB.prepare('SELECT id FROM orders WHERE lemon_order_id = ?').bind(lemonOrderId).first<{ id: string }>();
  // Opakované nebo pozdní doručení nesmí přepsat pozdější stav (např. refundaci).
  if (existing) return { outcome: 'ignored', detail: 'duplicate_order', orderId: existing.id };

  if (a.status !== 'paid') return { outcome: 'ignored', detail: `status:${String(a.status)}` };

  const intentId = ev.meta?.custom_data?.intent_id;
  if (typeof intentId !== 'string' || !intentId) return { outcome: 'rejected', detail: 'missing_intent' };
  const intent = await env.DB.prepare('SELECT * FROM checkout_intents WHERE id = ?').bind(intentId).first<IntentRow>();
  if (!intent) return { outcome: 'rejected', detail: 'unknown_intent' };

  const variantId = a.first_order_item?.variant_id;
  if (variantId === undefined || String(variantId) !== String(intent.lemon_variant_id)) {
    return { outcome: 'rejected', detail: 'variant_mismatch' };
  }

  const id = uuid();
  const createdAt = typeof a.created_at === 'string' ? a.created_at : nowIso();
  const base = {
    id, lemonOrderId, orderNumber: a.order_number != null ? String(a.order_number) : null,
    email: typeof a.user_email === 'string' ? a.user_email : null,
    name: typeof a.user_name === 'string' ? a.user_name : null,
    currency: typeof a.currency === 'string' ? a.currency : intent.currency,
    total: Number.isFinite(a.total) ? Number(a.total) : null,
    isTest: a.test_mode === true ? 1 : 0,
  };

  if (intent.kind === 'service') {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO orders (id, lemon_order_id, order_number, checkout_intent_id, kind, buyer_email, buyer_name, currency, total_minor, payment_status, license_status, is_test)
         VALUES (?, ?, ?, ?, 'service', ?, ?, ?, ?, 'paid', 'active', ?)`,
      ).bind(id, lemonOrderId, base.orderNumber, intent.id, base.email, base.name, base.currency, base.total, base.isTest),
      env.DB.prepare(`UPDATE checkout_intents SET status = 'paid' WHERE id = ?`).bind(intent.id),
      env.DB.prepare(`UPDATE service_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'new'`).bind(intent.service_order_id),
    ]);
    return { outcome: 'processed', detail: 'service_paid', orderId: id, notify: `💸 Zaplacená objednávka mix/master (${base.email ?? '?'})` };
  }

  const beat = await env.DB.prepare('SELECT id, title, status FROM beats WHERE id = ?').bind(intent.beat_id).first<{ id: string; title: string; status: string }>();
  if (!beat) return { outcome: 'rejected', detail: 'unknown_beat' };

  const lease = intent.license !== 'exclusive';
  let needsReview = 0;
  let note = '';
  const stmts: D1PreparedStatement[] = [];
  let cancelSubscriptions: string[] = [];

  if (!lease) {
    if (beat.status === 'sold') {
      // Dva souběžné nákupy exkluzivity: druhý je potřeba ručně vrátit.
      needsReview = 1;
      note = 'Beat už byl exkluzivně prodán – vrať platbu (refund) v Lemon Squeezy.';
    } else {
      stmts.push(env.DB.prepare(`UPDATE beats SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(beat.id));
      const subs = await env.DB
        .prepare(`SELECT lemon_subscription_id AS sid FROM orders WHERE beat_id = ? AND lemon_subscription_id IS NOT NULL AND license_status = 'active'`)
        .bind(beat.id)
        .all<{ sid: string }>();
      cancelSubscriptions = subs.results.map((r) => r.sid);
    }
  } else if (beat.status === 'sold') {
    needsReview = 1;
    note = 'Lease zaplacen po exkluzivním prodeji beatu – vrať platbu (refund).';
  }

  stmts.unshift(
    env.DB.prepare(
      `INSERT OR IGNORE INTO orders (id, lemon_order_id, order_number, checkout_intent_id, kind, beat_id, beat_title, license, buyer_email, buyer_name, artist_name,
         currency, total_minor, payment_status, license_status, term_started_at, term_ends_at, needs_review, note, is_test)
       VALUES (?, ?, ?, ?, 'license', ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'active', ?, ?, ?, ?, ?)`,
    ).bind(
      id, lemonOrderId, base.orderNumber, intent.id, beat.id, beat.title, intent.license, base.email, base.name, intent.artist_name,
      base.currency, base.total, createdAt, lease ? addYears(createdAt, 1) : null, needsReview, note, base.isTest,
    ),
    env.DB.prepare(`UPDATE checkout_intents SET status = 'paid' WHERE id = ?`).bind(intent.id),
  );
  await env.DB.batch(stmts);

  return {
    outcome: 'processed', detail: needsReview ? 'paid_needs_review' : 'paid', orderId: id, cancelSubscriptions,
    notify: `${needsReview ? '⚠️' : '💸'} ${beat.title} — ${intent.license?.toUpperCase()} (${base.email ?? '?'})${note ? ` · ${note}` : ''}`,
  };
}

async function orderRefunded(env: Env, ev: LemonEvent): Promise<ProcessResult> {
  const a = ev.data!.attributes!;
  const order = await env.DB.prepare('SELECT * FROM orders WHERE lemon_order_id = ?').bind(String(ev.data!.id)).first<OrderRow>();
  if (!order) return { outcome: 'retry', detail: 'refund_for_unknown_order' };

  const full = a.status === 'refunded' || (a.refunded === true && a.status !== 'partial_refund');
  const paymentStatus = full ? 'refunded' : 'partial_refund';
  const stamp = `[${nowIso()}] ${paymentStatus}`;
  await env.DB
    .prepare(
      `UPDATE orders SET payment_status = ?, license_status = CASE WHEN ? = 1 THEN 'revoked' ELSE license_status END,
         needs_review = CASE WHEN ? = 1 AND license = 'exclusive' THEN 1 ELSE needs_review END,
         note = TRIM(note || ' ' || ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(paymentStatus, full ? 1 : 0, full ? 1 : 0, stamp, order.id)
    .run();
  if (order.kind === 'service' && full) {
    await env.DB
      .prepare(`UPDATE service_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT service_order_id FROM checkout_intents WHERE id = ?)`)
      .bind(order.checkout_intent_id)
      .run();
  }
  return { outcome: 'processed', detail: paymentStatus, orderId: order.id, notify: `↩️ Refund (${paymentStatus}): ${order.beat_title ?? order.kind}` };
}

async function subscriptionChanged(env: Env, ev: LemonEvent): Promise<ProcessResult> {
  const a = ev.data!.attributes!;
  if (ev.data!.type && ev.data!.type !== 'subscriptions') return { outcome: 'ignored', detail: 'not_a_subscription' };
  const order = await env.DB.prepare('SELECT * FROM orders WHERE lemon_order_id = ?').bind(String(a.order_id)).first<OrderRow>();
  // Pořadí doručení není zaručené: bez objednávky chceme, aby to Lemon Squeezy zkusil znovu.
  if (!order) return { outcome: 'retry', detail: 'subscription_before_order' };
  if (order.license_status === 'revoked') return { outcome: 'ignored', detail: 'order_revoked' };

  const status = String(a.status);
  let licenseStatus: string;
  let termEnds: string | null = order.term_ends_at;
  if (status === 'expired') {
    licenseStatus = 'expired';
    termEnds = a.ends_at ?? order.term_ends_at ?? nowIso();
  } else if (status === 'cancelled') {
    licenseStatus = 'cancelled';
    termEnds = a.ends_at ?? order.term_ends_at;
  } else if (status === 'active' || status === 'on_trial') {
    licenseStatus = 'active';
    termEnds = a.renews_at ?? order.term_ends_at;
  } else {
    // past_due / unpaid / paused: období se neprodlužuje, platnost určuje term_ends_at
    licenseStatus = status;
  }

  await env.DB
    .prepare(`UPDATE orders SET lemon_subscription_id = ?, license_status = ?, term_ends_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(String(ev.data!.id), licenseStatus, termEnds, order.id)
    .run();
  return { outcome: 'processed', detail: `subscription:${status}`, orderId: order.id };
}
