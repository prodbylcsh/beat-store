import type { Env, IntentRow } from '../types';
import { sha256Hex } from '../lib/crypto';
import { HttpError, html, isMockPayments } from '../lib/http';
import { handleVerifiedEvent } from './webhook';

/**
 * SIMULOVANÁ PLATBA – jen lokální vývoj bez Lemon Squeezy klíče (APP_ENV=development).
 * Projde stejným kódem jako skutečný webhook, takže jde vyzkoušet celý tok včetně stažení.
 */
async function intentFor(env: Env, id: string, token: string): Promise<IntentRow> {
  if (!isMockPayments(env)) throw new HttpError(404, 'not_found');
  const intent = await env.DB.prepare('SELECT * FROM checkout_intents WHERE id = ?').bind(id).first<IntentRow>();
  if (!intent || intent.token_hash !== (await sha256Hex(token))) throw new HttpError(404, 'not_found');
  return intent;
}

export async function devCheckoutPage(env: Env, url: URL, id: string): Promise<Response> {
  const token = url.searchParams.get('t') ?? '';
  const intent = await intentFor(env, id, token);
  const price = (intent.price_minor / 100).toLocaleString('cs-CZ');
  return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulovaný checkout</title>
<style>body{font:15px/1.5 ui-monospace,Menlo,monospace;background:#0b0b0a;color:#edebe6;display:grid;place-items:center;min-height:100vh;margin:0}
form{width:min(420px,90vw);border:1px dashed #555;padding:28px;border-radius:14px}h1{font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:#ff5a1f;margin:0 0 4px}
p{color:#aaa;margin:0 0 18px}label{display:block;font-size:12px;color:#888;margin:12px 0 4px}input{width:100%;box-sizing:border-box;padding:10px;background:#161615;border:1px solid #333;color:inherit;font:inherit;border-radius:8px}
button{margin-top:20px;width:100%;padding:13px;border:0;border-radius:999px;background:#ff5a1f;color:#000;font:inherit;font-weight:700;cursor:pointer}.t{font-size:22px;color:#fff;margin:14px 0}</style>
<form method="post" action="/api/dev/pay"><h1>Simulovaný checkout</h1><p>Lokální vývoj bez Lemon Squeezy. V ostrém provozu je tady platební brána.</p>
<div>${intent.kind === 'license' ? `Licence: ${intent.license}` : 'Služba: mix/master'}</div><div class="t">${price} ${intent.currency}${intent.kind === 'license' && intent.license !== 'exclusive' ? ' / rok' : ''}</div>
<input type="hidden" name="id" value="${intent.id}"><input type="hidden" name="t" value="${token}">
<label>Jméno</label><input name="name" value="Test Kupující" required><label>E-mail</label><input name="email" type="email" value="test@example.com" required>
<button>Zaplatit (simulace)</button></form>`);
}

export async function devPay(env: Env, request: Request): Promise<Response> {
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const token = String(form.get('t') ?? '');
  const intent = await intentFor(env, id, token);
  const orderId = String(Math.floor(Date.now() / 10) % 1_000_000_000);
  const now = new Date().toISOString();
  const base = { store_id: env.LEMON_STORE_ID || 0, test_mode: true };
  const order = {
    meta: { event_name: 'order_created', custom_data: { intent_id: intent.id }, test_mode: true },
    data: {
      type: 'orders', id: orderId,
      attributes: {
        ...base, status: 'paid', order_number: Number(orderId.slice(-5)), user_name: String(form.get('name') ?? ''), user_email: String(form.get('email') ?? ''),
        currency: intent.currency, total: intent.price_minor, created_at: now, first_order_item: { variant_id: intent.lemon_variant_id },
      },
    },
  };
  await handleVerifiedEvent(env, JSON.stringify(order), order);
  if (intent.kind === 'license' && intent.license !== 'exclusive') {
    const renews = new Date(Date.now() + 365 * 24 * 3600_000).toISOString();
    const sub = {
      meta: { event_name: 'subscription_created', custom_data: { intent_id: intent.id }, test_mode: true },
      data: { type: 'subscriptions', id: `sub-${orderId}`, attributes: { ...base, order_id: Number(orderId), status: 'active', renews_at: renews, ends_at: null } },
    };
    await handleVerifiedEvent(env, JSON.stringify(sub), sub);
  }
  return new Response(null, { status: 303, headers: { Location: `/order/${token}` } });
}
