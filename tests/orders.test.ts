import { beforeEach, describe, expect, it } from 'vitest';
import { hmacHex, verifyLemonSignature } from '../src/worker/lib/crypto';
import { isLicenseActive, processLemonEvent, type LemonEvent } from '../src/worker/lib/orders';
import { handleVerifiedEvent, lemonWebhook } from '../src/worker/routes/webhook';
import type { Env } from '../src/worker/types';
import { createD1 } from './d1-shim';

let env: Env;
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

async function seed() {
  env = { DB: createD1(), APP_ENV: 'test', APP_ORIGIN: 'https://x.test', CURRENCY: 'CZK', LEMON_STORE_ID: '77', LEMONSQUEEZY_WEBHOOK_SECRET: 'whsec' } as unknown as Env;
  await env.DB.prepare(`INSERT INTO beats (id, slug, title, bpm, musical_key, genre, price_wav, price_stems, price_exclusive, wav_key, stems_key, preview_key, status) VALUES ('b1','b1','Beat',140,'Am','Trap',69000,149000,1200000,'w','s','p','active')`).run();
  for (const [id, lic, variant] of [['i-wav', 'wav', '11'], ['i-wav2', 'wav', '11'], ['i-ex', 'exclusive', '33'], ['i-ex2', 'exclusive', '33']]) {
    await env.DB.prepare(`INSERT INTO checkout_intents (id, token_hash, kind, beat_id, license, lemon_variant_id, price_minor, currency, expires_at) VALUES (?, ?, 'license', 'b1', ?, ?, 69000, 'CZK', '2099-01-01')`).bind(id, `h-${id}`, lic, variant).run();
  }
}
beforeEach(seed);

const order = (id: string, intent: string, variant: number, over: Record<string, unknown> = {}): LemonEvent => ({
  meta: { event_name: 'order_created', custom_data: { intent_id: intent } },
  data: { type: 'orders', id, attributes: { store_id: 77, test_mode: true, status: 'paid', order_number: 5, user_email: 'a@b.cz', user_name: 'A B', currency: 'CZK', total: 69000, created_at: '2026-11-12T10:00:00Z', first_order_item: { variant_id: variant }, ...over } },
});
const sub = (name: string, orderId: number, status: string, over: Record<string, unknown> = {}): LemonEvent => ({
  meta: { event_name: name },
  data: { type: 'subscriptions', id: `s${orderId}`, attributes: { store_id: 77, test_mode: true, order_id: orderId, status, renews_at: '2027-11-12T10:00:00Z', ends_at: null, ...over } },
});
const refund = (id: string, status = 'refunded'): LemonEvent => ({ meta: { event_name: 'order_refunded' }, data: { type: 'orders', id, attributes: { store_id: 77, test_mode: true, status, refunded: true } } });
const row = (id: string) => env.DB.prepare('SELECT * FROM orders WHERE lemon_order_id = ?').bind(id).first<any>();
const count = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM orders').first<{ n: number }>())!.n;

describe('podpis webhooku', () => {
  it('přijme správný HMAC a odmítne špatný nebo chybějící', async () => {
    const body = new TextEncoder().encode('{"a":1}').buffer as ArrayBuffer;
    const sig = await hmacHex('whsec', body);
    expect(await verifyLemonSignature(body, sig, 'whsec')).toBe(true);
    expect(await verifyLemonSignature(body, sig.replace(/.$/, '0') === sig ? sig.replace(/.$/, '1') : sig.replace(/.$/, '0'), 'whsec')).toBe(false);
    expect(await verifyLemonSignature(body, null, 'whsec')).toBe(false);
    expect(await verifyLemonSignature(body, sig, undefined)).toBe(false);
  });

  it('neplatný podpis nic nezmění (401)', async () => {
    const body = JSON.stringify(order('100', 'i-wav', 11));
    const res = await lemonWebhook(env, new Request('https://x.test/api/webhooks/lemonsqueezy', { method: 'POST', body, headers: { 'x-signature': 'deadbeef' } }), ctx);
    expect(res.status).toBe(401);
    expect(await count()).toBe(0);
  });

  it('platný podpis uloží právě jednu objednávku i při 10× doručení', async () => {
    const body = JSON.stringify(order('100', 'i-wav', 11));
    const sig = await hmacHex('whsec', body);
    for (let i = 0; i < 10; i++) {
      const res = await lemonWebhook(env, new Request('https://x.test/h', { method: 'POST', body, headers: { 'x-signature': sig } }), ctx);
      expect(res.status).toBe(200);
    }
    expect(await count()).toBe(1);
    expect((await row('100')).payment_status).toBe('paid');
  });
});

describe('order_created', () => {
  it('uhrazená objednávka aktivuje roční lease', async () => {
    const r = await processLemonEvent(env, order('100', 'i-wav', 11));
    expect(r.outcome).toBe('processed');
    const o = await row('100');
    expect(o.license_status).toBe('active');
    expect(o.term_ends_at).toBe('2027-11-12T10:00:00.000Z');
  });
  it.each([
    ['cizí store', { store_id: 1 }], ['live event v testu', { test_mode: false }],
  ])('odmítne: %s', async (_n, over) => {
    expect((await processLemonEvent(env, order('100', 'i-wav', 11, over))).outcome).toBe('rejected');
    expect(await count()).toBe(0);
  });
  it('neznámý intent nebo jiná varianta neudělí licenci', async () => {
    expect((await processLemonEvent(env, order('100', 'nope', 11))).outcome).toBe('rejected');
    expect((await processLemonEvent(env, order('101', 'i-wav', 33))).detail).toBe('variant_mismatch');
    expect(await count()).toBe(0);
  });
  it.each(['pending', 'failed', 'fraudulent'])('status %s nevede na paid', async (status) => {
    expect((await processLemonEvent(env, order('100', 'i-wav', 11, { status }))).outcome).toBe('ignored');
    expect(await count()).toBe(0);
  });
});

describe('refund', () => {
  it('plný refund licenci zruší a pozdní order_created ji neobnoví', async () => {
    await processLemonEvent(env, order('100', 'i-wav', 11));
    await processLemonEvent(env, refund('100'));
    await processLemonEvent(env, order('100', 'i-wav', 11));
    const o = await row('100');
    expect(o.payment_status).toBe('refunded');
    expect(o.license_status).toBe('revoked');
    expect(isLicenseActive(o)).toBe(false);
    expect(o.note).toContain('refunded');
  });
  it('částečný refund licenci ponechá', async () => {
    await processLemonEvent(env, order('100', 'i-wav', 11));
    await processLemonEvent(env, refund('100', 'partial_refund'));
    const o = await row('100');
    expect(o.payment_status).toBe('partial_refund');
    expect(isLicenseActive(o, Date.parse('2026-12-01'))).toBe(true);
  });
  it('refund neznámé objednávky žádá opakování', async () => {
    expect((await processLemonEvent(env, refund('999'))).outcome).toBe('retry');
  });
});

describe('předplatné (lease)', () => {
  it('událost před objednávkou vrátí 503 a po objednávce projde', async () => {
    const ev = sub('subscription_created', 100, 'active');
    expect((await handleVerifiedEvent(env, JSON.stringify(ev), ev)).outcome).toBe('retry');
    await processLemonEvent(env, order('100', 'i-wav', 11));
    expect((await handleVerifiedEvent(env, JSON.stringify(ev), ev)).outcome).toBe('processed');
    expect((await row('100')).lemon_subscription_id).toBe('s100');
  });
  it('obnova prodlouží období, zrušení doběhne, expirace ukončí', async () => {
    await processLemonEvent(env, order('100', 'i-wav', 11));
    await processLemonEvent(env, sub('subscription_updated', 100, 'active', { renews_at: '2028-11-12T10:00:00Z' }));
    expect((await row('100')).term_ends_at).toBe('2028-11-12T10:00:00Z');
    await processLemonEvent(env, sub('subscription_cancelled', 100, 'cancelled', { ends_at: '2028-11-12T10:00:00Z' }));
    let o = await row('100');
    expect(o.license_status).toBe('cancelled');
    expect(isLicenseActive(o, Date.parse('2028-06-01'))).toBe(true);
    expect(isLicenseActive(o, Date.parse('2028-12-01'))).toBe(false);
    await processLemonEvent(env, sub('subscription_expired', 100, 'expired', { ends_at: '2028-11-12T10:00:00Z' }));
    o = await row('100');
    expect(o.license_status).toBe('expired');
    expect(isLicenseActive(o, Date.parse('2028-06-01'))).toBe(false);
  });
});

describe('exkluzivita', () => {
  it('prodá beat, zruší běžící lease předplatná a druhý nákup označí k refundu', async () => {
    await processLemonEvent(env, order('100', 'i-wav', 11));
    await processLemonEvent(env, sub('subscription_created', 100, 'active'));
    const r = await processLemonEvent(env, order('200', 'i-ex', 33));
    expect(r.cancelSubscriptions).toEqual(['s100']);
    expect((await env.DB.prepare(`SELECT status FROM beats WHERE id='b1'`).first<any>()).status).toBe('sold');
    expect((await row('200')).term_ends_at).toBeNull();
    await processLemonEvent(env, order('201', 'i-ex2', 33));
    expect((await row('201')).needs_review).toBe(1);
    await processLemonEvent(env, order('102', 'i-wav2', 11));
    expect((await row('102')).needs_review).toBe(1);
  });
});

