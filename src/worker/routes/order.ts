import { BRAND } from '../../shared/brand';
import { buildLicense } from '../../shared/licenses';
import { formatMoney, slugify } from '../../shared/music';
import type { OrderView } from '../../shared/types';
import type { BeatRow, Env, IntentRow, OrderRow } from '../types';
import { sha256Hex } from '../lib/crypto';
import { HttpError, clientIp, html, json, rateLimit, serveR2 } from '../lib/http';
import { renderLicenseHtml } from '../lib/license-html';
import { isLicenseActive } from '../lib/orders';

/** Token z potvrzení objednávky identifikuje objednávku; o zaplacení rozhoduje jen stav v DB z webhooku. */
async function load(env: Env, request: Request, token: string): Promise<{ intent: IntentRow; order: OrderRow | null }> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) throw new HttpError(404, 'not_found');
  await rateLimit(env.DB, `order:${clientIp(request)}`, 240, 600);
  const intent = await env.DB.prepare('SELECT * FROM checkout_intents WHERE token_hash = ?').bind(await sha256Hex(token)).first<IntentRow>();
  if (!intent) throw new HttpError(404, 'not_found');
  const order = await env.DB.prepare('SELECT * FROM orders WHERE checkout_intent_id = ?').bind(intent.id).first<OrderRow>();
  return { intent, order };
}

export async function orderStatus(env: Env, request: Request, token: string): Promise<Response> {
  const { intent, order } = await load(env, request, token);
  if (!order) return json({ state: 'processing', kind: intent.kind } satisfies OrderView);
  if (order.kind === 'service') {
    return json({ state: order.payment_status === 'refunded' ? 'refunded' : 'service', kind: 'service', orderNumber: order.order_number ?? undefined, isTest: !!order.is_test } satisfies OrderView);
  }
  const active = isLicenseActive(order);
  const view: OrderView = {
    state: order.payment_status === 'refunded' ? 'refunded' : active ? 'ready' : 'ended',
    kind: 'license', beatTitle: order.beat_title ?? undefined, license: order.license ?? undefined,
    licenseStatus: order.license_status, orderNumber: order.order_number ?? undefined,
    termEndsAt: order.term_ends_at, isTest: !!order.is_test, files: [],
  };
  if (active && order.beat_id) {
    const beat = await env.DB.prepare('SELECT wav_name, stems_name, wav_key, stems_key FROM beats WHERE id = ?').bind(order.beat_id).first<BeatRow>();
    if (beat?.wav_key) view.files!.push({ kind: 'wav', name: beat.wav_name ?? 'beat.wav' });
    if (order.license !== 'wav' && beat?.stems_key) view.files!.push({ kind: 'stems', name: beat.stems_name ?? 'stems.zip' });
  }
  return json(view);
}

export async function orderDownload(env: Env, request: Request, token: string, kind: string): Promise<Response> {
  const { order } = await load(env, request, token);
  if (!order || order.kind !== 'license' || !order.beat_id) throw new HttpError(404, 'not_found');
  if (!isLicenseActive(order)) throw new HttpError(403, 'license_inactive');
  if (kind !== 'wav' && kind !== 'stems') throw new HttpError(404, 'not_found');
  if (kind === 'stems' && order.license === 'wav') throw new HttpError(403, 'not_in_license');
  const beat = await env.DB.prepare('SELECT * FROM beats WHERE id = ?').bind(order.beat_id).first<BeatRow>();
  const key = kind === 'wav' ? beat?.wav_key : beat?.stems_key;
  if (!beat || !key) throw new HttpError(404, 'not_found');
  const ext = kind === 'wav' ? 'wav' : 'zip';
  const filename = `${slugify(beat.title)}-${beat.bpm}bpm-${slugify(BRAND.credit)}${kind === 'stems' ? '-stems' : ''}.${ext}`;
  return serveR2(env.FILES, key, request, {
    'Content-Type': kind === 'wav' ? 'audio/wav' : 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });
}

const fmtDate = (iso: string | null, lang: 'cs' | 'en') =>
  iso ? new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', { dateStyle: 'long', timeZone: 'Europe/Prague' }).format(new Date(iso)) : '';

export async function orderLicense(env: Env, request: Request, token: string): Promise<Response> {
  const { intent, order } = await load(env, request, token);
  if (!order || order.kind !== 'license' || !order.license) throw new HttpError(404, 'not_found');
  const q = new URL(request.url).searchParams.get('lang');
  const lang = q === 'en' || q === 'cs' ? q : intent.lang === 'en' ? 'en' : 'cs';
  const doc = buildLicense(order.license, lang, {
    licensee: order.buyer_name ?? undefined, artist: order.artist_name ?? undefined, email: order.buyer_email ?? undefined,
    beatTitle: order.beat_title ?? undefined, date: fmtDate(order.term_started_at ?? order.created_at, lang),
    orderNo: order.order_number ?? order.lemon_order_id,
    price: formatMoney(intent.price_minor, intent.currency, lang),
    termEnds: order.license === 'exclusive' ? undefined : fmtDate(order.term_ends_at, lang),
  });
  let banner = '';
  if (order.payment_status === 'refunded' || order.license_status === 'revoked') banner = lang === 'cs' ? 'Licence zanikla (platba vrácena).' : 'License terminated (payment refunded).';
  else if (!isLicenseActive(order)) banner = lang === 'cs' ? 'Licenční období skončilo.' : 'The license term has ended.';
  else if (order.is_test) banner = lang === 'cs' ? 'TESTOVACÍ objednávka – není platnou licencí.' : 'TEST order – not a valid license.';
  return html(renderLicenseHtml(doc, lang, banner));
}
