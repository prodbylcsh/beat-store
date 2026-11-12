import { BRAND } from '../../shared/brand';
import { LICENSE_NAMES } from '../../shared/licenses';
import { ADDON_IDS, MAX_SONGS, SERVICE_IDS, servicePrice, type AddonId } from '../../shared/services';
import { LICENSE_IDS, type LicenseId, type ServiceId } from '../../shared/types';
import type { BeatRow, Env } from '../types';
import { randomToken, sha256Hex, uuid } from '../lib/crypto';
import { variantFor } from '../lib/db';
import { HttpError, appOrigin, clientIp, int, isMockPayments, json, notify, rateLimit, readJson, safeUrl, str } from '../lib/http';
import { createCheckout } from '../lib/lemon';

const TEXT = {
  cs: { button: 'Stáhnout soubory a licenci', note: (url: string) => `Díky! Soubory a licenční smlouvu najdeš tady: ${url} — odkaz si ulož, je to tvůj klíč k objednávce.`, year: '1 rok, automatická obnova', service: 'Mix & Master' },
  en: { button: 'Download files & license', note: (url: string) => `Thank you! Your files and license agreement are here: ${url} — keep this link, it is the key to your order.`, year: '1 year, auto-renewing', service: 'Mix & Master' },
};

async function startCheckout(
  env: Env, request: Request,
  p: { kind: 'license' | 'service'; beatId?: string; license?: LicenseId; serviceOrderId?: string; variantId: string; price: number; artist: string; lang: 'cs' | 'en'; name: string; description: string },
): Promise<string> {
  const token = randomToken(32);
  const intentId = uuid();
  const ipHash = (await sha256Hex(`${clientIp(request)}:${env.SESSION_SECRET ?? ''}`)).slice(0, 32);
  await env.DB
    .prepare(
      `INSERT INTO checkout_intents (id, token_hash, kind, beat_id, license, service_order_id, lemon_variant_id, price_minor, currency, artist_name, lang, ip_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(intentId, await sha256Hex(token), p.kind, p.beatId ?? null, p.license ?? null, p.serviceOrderId ?? null, p.variantId, p.price, env.CURRENCY, p.artist, p.lang, ipHash, new Date(Date.now() + 24 * 3600_000).toISOString())
    .run();

  const origin = appOrigin(env, request);
  const orderUrl = `${origin}/order/${token}`;
  if (isMockPayments(env)) return `${origin}/api/dev/checkout/${intentId}?t=${token}`;
  const t = TEXT[p.lang];
  try {
    return await createCheckout(env, {
      variantId: p.variantId, priceMinor: p.price, name: p.name, description: p.description,
      intentId, orderUrl, buttonText: t.button, thankYouNote: t.note(orderUrl),
    });
  } catch (e) {
    await env.DB.prepare(`UPDATE checkout_intents SET status = 'failed' WHERE id = ?`).bind(intentId).run();
    throw e;
  }
}

/** POST /api/checkout — klient posílá jen ID beatu a typ licence. Cenu i variantu určuje server. */
export async function checkout(env: Env, request: Request): Promise<Response> {
  await rateLimit(env.DB, `checkout:${clientIp(request)}`, 12, 600);
  const body = await readJson(request, 4000);
  const beatId = str(body.beatId, 64, { required: true, name: 'beatId' });
  const license = str(body.license, 16, { required: true, name: 'license' }) as LicenseId;
  if (!LICENSE_IDS.includes(license)) throw new HttpError(400, 'invalid_input', 'license');
  if (body.consent !== true) throw new HttpError(400, 'consent_required');
  const artist = str(body.artistName, 80, { name: 'artistName' });
  const lang = body.lang === 'en' ? 'en' : 'cs';

  const beat = await env.DB.prepare(`SELECT * FROM beats WHERE id = ?`).bind(beatId).first<BeatRow>();
  if (!beat || beat.status === 'draft') throw new HttpError(404, 'not_found');
  if (beat.status === 'sold') throw new HttpError(409, 'beat_sold');
  if (!beat.wav_key) throw new HttpError(409, 'unavailable');
  if (license !== 'wav' && !beat.stems_key) throw new HttpError(409, 'unavailable');

  const variantId = variantFor(env, license);
  if (!variantId) throw new HttpError(503, 'payments_not_configured');
  const price = { wav: beat.price_wav, stems: beat.price_stems, exclusive: beat.price_exclusive }[license];
  const t = TEXT[lang];
  const name = `${beat.title} — ${LICENSE_NAMES[license]}`;
  const description = license === 'exclusive'
    ? `${BRAND.credit} · ${beat.bpm} BPM · ${beat.musical_key} · Exclusive license`
    : `${BRAND.credit} · ${beat.bpm} BPM · ${beat.musical_key} · ${LICENSE_NAMES[license]} (${t.year})`;

  const url = await startCheckout(env, request, { kind: 'license', beatId: beat.id, license, variantId, price, artist, lang, name, description });
  return json({ url });
}

/** POST /api/services — poptávka/objednávka mixu a masteringu. */
export async function serviceOrder(env: Env, request: Request, ctx: ExecutionContext): Promise<Response> {
  await rateLimit(env.DB, `service:${clientIp(request)}`, 6, 3600);
  const body = await readJson(request, 12_000);
  const service = str(body.service, 16, { required: true, name: 'service' }) as ServiceId;
  if (!SERVICE_IDS.includes(service)) throw new HttpError(400, 'invalid_input', 'service');
  const songs = int(body.songs, 1, MAX_SONGS, 'songs');
  const addons = Array.isArray(body.addons) ? [...new Set(body.addons.filter((a): a is AddonId => ADDON_IDS.includes(a as AddonId)))] : [];
  const name = str(body.name, 100, { required: true, name: 'name' });
  const email = str(body.email, 200, { required: true, name: 'email' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'invalid_input', 'email');
  if (body.consent !== true) throw new HttpError(400, 'consent_required');
  const project = str(body.project, 140, { name: 'project' });
  const filesUrl = safeUrl(body.filesUrl, 'filesUrl');
  const referenceUrl = safeUrl(body.referenceUrl, 'referenceUrl');
  const notes = str(body.notes, 3000, { name: 'notes' });
  const lang = body.lang === 'en' ? 'en' : 'cs';
  // honeypot proti botům
  if (str(body.website, 200)) return json({ ok: true, id: 'ok' });

  const price = servicePrice(service, songs, addons);
  const id = uuid();
  await env.DB
    .prepare(
      `INSERT INTO service_orders (id, service, songs, addons, name, email, project, files_url, reference_url, notes, price_minor, currency, lang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, service, songs, JSON.stringify(addons), name, email, project, filesUrl, referenceUrl, notes, price, env.CURRENCY, lang)
    .run();
  ctx.waitUntil(notify(env, `🎚️ Nová poptávka ${service} ×${songs} — ${name} <${email}> ${project ? `· ${project}` : ''}`));

  let url: string | null = null;
  const variantId = env.LEMON_VARIANT_SERVICE || (isMockPayments(env) ? 'mock-service' : '');
  if (body.payNow === true && variantId) {
    const label = { mix: 'Mixing', master: 'Mastering', mixmaster: 'Mix + Master' }[service];
    url = await startCheckout(env, request, {
      kind: 'service', serviceOrderId: id, variantId, price, artist: name, lang,
      name: `${label} × ${songs}`, description: `${BRAND.name} · ${label}${project ? ` · ${project}` : ''}`,
    });
  }
  return json({ ok: true, id, url });
}
