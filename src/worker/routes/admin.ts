import { LICENSE_TERMS } from '../../shared/licenses';
import { isValidKey, slugify } from '../../shared/music';
import type { BeatRow, Env } from '../types';
import { hmacHex, randomToken, timingSafeEqual, uuid } from '../lib/crypto';
import { toAdminBeat } from '../lib/db';
import { HttpError, clientIp, int, json, rateLimit, readJson, str } from '../lib/http';

const COOKIE = 'bs_admin';
const SESSION_HOURS = 12;

function secret(env: Env): string {
  const s = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  if (!s || !env.ADMIN_PASSWORD) throw new HttpError(503, 'admin_not_configured');
  return s;
}

async function sign(env: Env, exp: number): Promise<string> {
  return `${exp}.${await hmacHex(secret(env), `admin-session:${exp}`)}`;
}

export async function isAdmin(env: Env, request: Request): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)bs_admin=([^;]+)/);
  if (!m) return false;
  const [expStr] = m[1].split('.');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return timingSafeEqual(await sign(env, exp), m[1]);
}

export async function requireAdmin(env: Env, request: Request): Promise<void> {
  if (!(await isAdmin(env, request))) throw new HttpError(401, 'unauthorized');
  // Ochrana proti CSRF: cookie je SameSite=Strict a změnové požadavky musí nést vlastní hlavičku.
  if (request.method !== 'GET' && request.headers.get('x-admin') !== '1') throw new HttpError(403, 'forbidden');
}

function cookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? ' Secure;' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAge}`;
}

export async function login(env: Env, request: Request): Promise<Response> {
  if (!env.ADMIN_PASSWORD) throw new HttpError(503, 'admin_not_configured');
  await rateLimit(env.DB, `login:${clientIp(request)}`, 8, 900);
  const body = await readJson(request, 2000);
  const password = str(body.password, 300, { required: true, name: 'password' });
  // porovnáváme HMAC obou hodnot, aby délka hesla neovlivnila čas porovnání
  const [a, b] = await Promise.all([hmacHex(secret(env), password), hmacHex(secret(env), env.ADMIN_PASSWORD)]);
  if (!timingSafeEqual(a, b)) throw new HttpError(401, 'wrong_password');
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, await sign(env, exp), SESSION_HOURS * 3600) });
}

export function logout(request: Request): Response {
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
}

/* ------------------------------- beaty ------------------------------- */

function beatFields(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, string | number> = {};
  const has = (k: string) => body[k] !== undefined;
  if (!partial || has('title')) out.title = str(body.title, 80, { required: true, name: 'title' });
  if (!partial || has('bpm')) out.bpm = int(body.bpm, 30, 300, 'bpm');
  if (!partial || has('key')) {
    const key = str(body.key, 4, { required: true, name: 'key' });
    if (!isValidKey(key)) throw new HttpError(400, 'invalid_input', 'key');
    out.musical_key = key;
  }
  if (!partial || has('genre')) out.genre = str(body.genre, 40, { required: true, name: 'genre' });
  if (has('duration')) {
    const d = Number(body.duration);
    if (!Number.isFinite(d) || d < 0 || d > 3600) throw new HttpError(400, 'invalid_input', 'duration');
    out.duration_sec = d;
  }
  if (has('peaks')) {
    const p = str(body.peaks, 12_000, { name: 'peaks' });
    if (p && !/^[A-Za-z0-9+/=]+$/.test(p)) throw new HttpError(400, 'invalid_input', 'peaks');
    out.peaks = p;
  }
  if (has('seed')) out.seed = int(body.seed, 0, 2 ** 31 - 1, 'seed');
  const prices = (body.prices ?? {}) as Record<string, unknown>;
  for (const id of ['wav', 'stems', 'exclusive'] as const) {
    if (prices[id] !== undefined) out[`price_${id}`] = int(prices[id], 0, 100_000_000, `prices.${id}`);
    else if (!partial) out[`price_${id}`] = LICENSE_TERMS[id].defaultPrice;
  }
  if (has('sortOrder')) out.sort_order = int(body.sortOrder, 0, 100000, 'sortOrder');
  return out;
}

async function uniqueSlug(env: Env, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await env.DB.prepare('SELECT 1 FROM beats WHERE slug = ?').bind(slug).first();
    if (!hit) return slug;
  }
  return `${base}-${randomToken(4).toLowerCase()}`;
}

export async function adminListBeats(env: Env): Promise<Response> {
  const rows = await env.DB.prepare('SELECT * FROM beats ORDER BY sort_order ASC, created_at DESC').all<BeatRow>();
  return json({ beats: rows.results.map(toAdminBeat), currency: env.CURRENCY });
}

export async function adminCreateBeat(env: Env, request: Request): Promise<Response> {
  const f = beatFields(await readJson(request, 20_000), false);
  const id = uuid();
  const slug = await uniqueSlug(env, String(f.title));
  const cols = ['id', 'slug', ...Object.keys(f)];
  await env.DB
    .prepare(`INSERT INTO beats (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(id, slug, ...Object.values(f))
    .run();
  const row = await env.DB.prepare('SELECT * FROM beats WHERE id = ?').bind(id).first<BeatRow>();
  return json({ beat: toAdminBeat(row!) }, 201);
}

export async function adminUpdateBeat(env: Env, request: Request, id: string): Promise<Response> {
  const body = await readJson(request, 20_000);
  const row = await env.DB.prepare('SELECT * FROM beats WHERE id = ?').bind(id).first<BeatRow>();
  if (!row) throw new HttpError(404, 'not_found');
  const f = beatFields(body, true);
  if (body.status !== undefined) {
    const status = str(body.status, 10, { required: true, name: 'status' });
    if (!['draft', 'active', 'sold'].includes(status)) throw new HttpError(400, 'invalid_input', 'status');
    if (status === 'active' && (!row.wav_key || !row.preview_key)) throw new HttpError(409, 'files_missing', 'Beat potřebuje WAV i ukázku.');
    f.status = status;
  }
  const keys = Object.keys(f);
  if (keys.length) {
    await env.DB
      .prepare(`UPDATE beats SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(...Object.values(f), id)
      .run();
  }
  const updated = await env.DB.prepare('SELECT * FROM beats WHERE id = ?').bind(id).first<BeatRow>();
  return json({ beat: toAdminBeat(updated!) });
}

export async function adminDeleteBeat(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT * FROM beats WHERE id = ?').bind(id).first<BeatRow>();
  if (!row) throw new HttpError(404, 'not_found');
  const sold = await env.DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE beat_id = ?').bind(id).first<{ n: number }>();
  if ((sold?.n ?? 0) > 0) {
    // Beat s objednávkami se nemaže (kupující potřebují stahovat) – jen se skryje.
    await env.DB.prepare(`UPDATE beats SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
    return json({ ok: true, hidden: true });
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM checkout_intents WHERE beat_id = ?').bind(id),
    env.DB.prepare('DELETE FROM beats WHERE id = ?').bind(id),
  ]);
  const keys = [row.preview_key, row.wav_key, row.stems_key].filter((k): k is string => !!k);
  if (keys.length) await env.FILES.delete(keys);
  return json({ ok: true });
}

/* ------------------------------ soubory ------------------------------ */

type FileKind = 'wav' | 'stems' | 'preview';
const KIND: Record<FileKind, { ext: string; type: string; col: string; nameCol: string | null; prefix: (id: string) => string }> = {
  wav: { ext: 'wav', type: 'audio/wav', col: 'wav_key', nameCol: 'wav_name', prefix: (id) => `beats/${id}/wav/` },
  stems: { ext: 'zip', type: 'application/zip', col: 'stems_key', nameCol: 'stems_name', prefix: (id) => `beats/${id}/stems/` },
  preview: { ext: 'mp3', type: 'audio/mpeg', col: 'preview_key', nameCol: null, prefix: () => 'previews/' },
};

function parseKind(v: unknown): FileKind {
  if (v !== 'wav' && v !== 'stems' && v !== 'preview') throw new HttpError(400, 'invalid_input', 'kind');
  return v;
}

async function attach(env: Env, beat: BeatRow, kind: FileKind, key: string, filename: string): Promise<void> {
  const k = KIND[kind];
  const old = (beat as unknown as Record<string, string | null>)[k.col];
  const sets = k.nameCol ? `${k.col} = ?, ${k.nameCol} = ?` : `${k.col} = ?`;
  const binds = k.nameCol ? [key, filename.slice(0, 160)] : [key];
  await env.DB.prepare(`UPDATE beats SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(...binds, beat.id).run();
  if (old && old !== key) await env.FILES.delete(old);
}

async function getBeat(env: Env, id: string): Promise<BeatRow> {
  const beat = await env.DB.prepare('SELECT * FROM beats WHERE id = ?').bind(id).first<BeatRow>();
  if (!beat) throw new HttpError(404, 'not_found');
  return beat;
}

/** Malé soubory (ukázka MP3) jedním požadavkem. */
export async function adminPutFile(env: Env, request: Request, url: URL): Promise<Response> {
  const kind = parseKind(url.searchParams.get('kind'));
  const beat = await getBeat(env, str(url.searchParams.get('beatId'), 64, { required: true, name: 'beatId' }));
  const size = Number(request.headers.get('content-length') ?? '0');
  if (!request.body || size <= 0 || size > 95 * 1024 * 1024) throw new HttpError(413, 'use_multipart');
  const k = KIND[kind];
  const key = `${k.prefix(beat.id)}${kind === 'preview' ? `${beat.slug}-` : ''}${randomToken(9)}.${k.ext}`;
  await env.FILES.put(key, request.body, { httpMetadata: { contentType: k.type } });
  await attach(env, beat, kind, key, str(url.searchParams.get('name'), 200) || `${beat.slug}.${k.ext}`);
  return json({ ok: true, key });
}

/** Velké soubory (WAV, ZIP se stopami) po částech – obchází limit velikosti požadavku. */
export async function adminMultipartCreate(env: Env, request: Request): Promise<Response> {
  const body = await readJson(request, 2000);
  const kind = parseKind(body.kind);
  const beat = await getBeat(env, str(body.beatId, 64, { required: true, name: 'beatId' }));
  const k = KIND[kind];
  const key = `${k.prefix(beat.id)}${randomToken(9)}.${k.ext}`;
  const up = await env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: k.type } });
  return json({ key, uploadId: up.uploadId });
}

function checkKey(key: string): string {
  if (!/^(beats\/[0-9a-f-]{36}\/(wav|stems)\/|previews\/)[A-Za-z0-9._-]+$/.test(key)) throw new HttpError(400, 'invalid_input', 'key');
  return key;
}

export async function adminMultipartPart(env: Env, request: Request, url: URL): Promise<Response> {
  const key = checkKey(url.searchParams.get('key') ?? '');
  const uploadId = str(url.searchParams.get('uploadId'), 1200, { required: true, name: 'uploadId' });
  const partNumber = int(url.searchParams.get('part'), 1, 10000, 'part');
  if (!request.body) throw new HttpError(400, 'invalid_input', 'body');
  const up = env.FILES.resumeMultipartUpload(key, uploadId);
  const part = await up.uploadPart(partNumber, request.body as ReadableStream);
  return json({ partNumber: part.partNumber, etag: part.etag });
}

export async function adminMultipartComplete(env: Env, request: Request): Promise<Response> {
  const body = await readJson(request, 400_000);
  const kind = parseKind(body.kind);
  const beat = await getBeat(env, str(body.beatId, 64, { required: true, name: 'beatId' }));
  const key = checkKey(str(body.key, 300, { required: true, name: 'key' }));
  if (!key.startsWith(KIND[kind].prefix(beat.id))) throw new HttpError(400, 'invalid_input', 'key');
  const uploadId = str(body.uploadId, 1200, { required: true, name: 'uploadId' });
  const parts = Array.isArray(body.parts) ? (body.parts as { partNumber: number; etag: string }[]) : [];
  if (!parts.length) throw new HttpError(400, 'invalid_input', 'parts');
  const up = env.FILES.resumeMultipartUpload(key, uploadId);
  await up.complete(parts.map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })));
  await attach(env, beat, kind, key, str(body.name, 200) || key.split('/').pop()!);
  return json({ ok: true, key });
}

/* ------------------------- objednávky a poptávky ------------------------- */

export async function adminOrders(env: Env): Promise<Response> {
  const orders = await env.DB
    .prepare(
      `SELECT id, order_number, kind, beat_title, license, buyer_email, buyer_name, artist_name, currency, total_minor,
              payment_status, license_status, term_ends_at, needs_review, note, is_test, created_at
       FROM orders ORDER BY created_at DESC LIMIT 200`,
    )
    .all();
  const services = await env.DB.prepare('SELECT * FROM service_orders ORDER BY created_at DESC LIMIT 200').all();
  return json({ orders: orders.results, services: services.results });
}

export async function adminUpdateService(env: Env, request: Request, id: string): Promise<Response> {
  const body = await readJson(request, 1000);
  const status = str(body.status, 20, { required: true, name: 'status' });
  if (!['new', 'paid', 'in_progress', 'done', 'cancelled'].includes(status)) throw new HttpError(400, 'invalid_input', 'status');
  await env.DB.prepare('UPDATE service_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, id).run();
  return json({ ok: true });
}

/** Hlasová značka (tag), která se přimíchává do veřejných ukázek. */
export async function adminTag(env: Env, request: Request): Promise<Response> {
  if (request.method === 'GET') {
    const obj = await env.FILES.get('settings/tag');
    if (!obj) throw new HttpError(404, 'not_found');
    return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'audio/wav', 'Cache-Control': 'no-store' } });
  }
  if (request.method === 'DELETE') {
    await env.FILES.delete('settings/tag');
    return json({ ok: true });
  }
  const size = Number(request.headers.get('content-length') ?? '0');
  if (!request.body || size <= 0 || size > 20 * 1024 * 1024) throw new HttpError(413, 'payload_too_large');
  await env.FILES.put('settings/tag', request.body, { httpMetadata: { contentType: request.headers.get('content-type') ?? 'audio/wav' } });
  return json({ ok: true });
}
