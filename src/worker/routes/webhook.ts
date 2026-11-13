import type { Env } from '../types';
import { sha256Hex, verifyLemonSignature } from '../lib/crypto';
import { isMockPayments, json, notify } from '../lib/http';
import { cancelSubscription } from '../lib/lemon';
import { processLemonEvent, type LemonEvent, type ProcessResult } from '../lib/orders';

const MAX_BODY = 256_000;

/** Zapíše doručení, zpracuje ho idempotentně a vrátí výsledek. Sdílí ho i lokální simulace platby. */
export async function handleVerifiedEvent(env: Env, rawBody: ArrayBuffer | string, ev: LemonEvent, ctx?: ExecutionContext): Promise<ProcessResult> {
  const eventId = await sha256Hex(rawBody);
  const name = String(ev.meta?.event_name ?? 'unknown').slice(0, 60);
  const prior = await env.DB.prepare('SELECT processing_status FROM webhook_events WHERE id = ?').bind(eventId).first<{ processing_status: string }>();
  if (prior && prior.processing_status !== 'retry' && prior.processing_status !== 'received') {
    return { outcome: 'ignored', detail: 'duplicate_delivery' };
  }
  const lemonOrderId = ev.data?.type === 'orders' ? String(ev.data.id) : ev.data?.attributes?.order_id != null ? String(ev.data.attributes.order_id) : null;
  await env.DB
    .prepare(`INSERT OR IGNORE INTO webhook_events (id, event_type, lemon_order_id) VALUES (?, ?, ?)`)
    .bind(eventId, name, lemonOrderId)
    .run();

  const result = await processLemonEvent(env, ev);
  await env.DB
    .prepare(`UPDATE webhook_events SET processing_status = ?, detail = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(result.outcome, result.detail.slice(0, 200), eventId)
    .run();

  const after = async () => {
    for (const sid of result.cancelSubscriptions ?? []) {
      // Po exkluzivním prodeji se lease nesmí obnovit. Když zrušení selže, označ objednávku k ručnímu zásahu.
      if (isMockPayments(env) || (await cancelSubscription(env, sid))) continue;
      await env.DB
        .prepare(`UPDATE orders SET needs_review = 1, note = TRIM(note || ' ' || ?), updated_at = CURRENT_TIMESTAMP WHERE lemon_subscription_id = ?`)
        .bind('Beat byl exkluzivně prodán, ale automatické obnovení se nepodařilo zrušit – zruš předplatné ručně v Lemon Squeezy.', sid)
        .run();
      await notify(env, `⚠️ Nepodařilo se zrušit obnovení lease (předplatné ${sid}) po exkluzivním prodeji – zruš ho ručně.`);
    }
    if (result.notify) await notify(env, result.notify);
  };
  if (ctx) ctx.waitUntil(after());
  else await after();
  return result;
}

export async function lemonWebhook(env: Env, request: Request, ctx: ExecutionContext): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY) return json({ error: 'payload_too_large' }, 413);
  // Syrové tělo se čte PŘED parsováním – podpis se počítá nad přesnými bajty.
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY) return json({ error: 'payload_too_large' }, 413);
  const valid = await verifyLemonSignature(raw, request.headers.get('x-signature'), env.LEMONSQUEEZY_WEBHOOK_SECRET);
  if (!valid) return json({ error: 'invalid_signature' }, 401);

  let ev: LemonEvent;
  try {
    ev = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const result = await handleVerifiedEvent(env, raw, ev, ctx);
  // 5xx jen když má smysl doručení zopakovat; jinak 200, aby se neopakovalo donekonečna.
  if (result.outcome === 'retry') return json({ ok: false, detail: result.detail }, 503);
  return json({ ok: true, outcome: result.outcome });
}
