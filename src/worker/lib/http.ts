import type { Env } from '../types';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...BASE_HEADERS, ...headers },
  });
}

export function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', ...BASE_HEADERS, ...headers },
  });
}

export async function readJson<T = Record<string, unknown>>(request: Request, maxBytes = 64_000): Promise<T> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > maxBytes) throw new HttpError(413, 'payload_too_large');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'payload_too_large');
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not object');
    return v as T;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function str(v: unknown, max: number, { required = false, name = 'field' } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, 'invalid_input', `${name} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpError(400, 'invalid_input', `${name} must be a string`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, 'invalid_input', `${name} is required`);
  if (s.length > max) throw new HttpError(400, 'invalid_input', `${name} is too long`);
  return s;
}

export function int(v: unknown, min: number, max: number, name = 'field'): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || Math.round(n) !== n || n < min || n > max) {
    throw new HttpError(400, 'invalid_input', `${name} must be an integer ${min}-${max}`);
  }
  return n;
}

export function safeUrl(v: unknown, name: string, required = false): string {
  const s = str(v, 600, { required, name });
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('proto');
    return u.toString();
  } catch {
    throw new HttpError(400, 'invalid_input', `${name} must be a valid URL`);
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

/** Veřejný origin webu. V produkci vždy z konfigurace (žádné přebírání z požadavku). */
export function appOrigin(env: Env, request: Request): string {
  if (env.APP_ENV === 'development') {
    const o = request.headers.get('origin');
    if (o && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
    return new URL(request.url).origin;
  }
  return env.APP_ORIGIN.replace(/\/+$/, '');
}

/** Jednoduchý limit požadavků v pevném okně nad D1. */
export async function rateLimit(db: D1Database, bucket: string, limit: number, windowSec: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?1, ?2, 1)
       ON CONFLICT(bucket) DO UPDATE SET
         hits = CASE WHEN window_start = ?2 THEN hits + 1 ELSE 1 END,
         window_start = ?2
       RETURNING hits`,
    )
    .bind(bucket, windowStart)
    .first<{ hits: number }>();
  if ((row?.hits ?? 0) > limit) throw new HttpError(429, 'rate_limited');
}

/** Streamuje objekt z R2 včetně podpory Range (kvůli přetáčení audia). */
export async function serveR2(bucket: R2Bucket, key: string, request: Request, headers: Record<string, string>): Promise<Response> {
  const rangeHeader = request.headers.get('range');
  const obj = await bucket.get(key, rangeHeader ? { range: request.headers } : undefined);
  if (!obj) throw new HttpError(404, 'not_found');
  const h = new Headers({ ...BASE_HEADERS, ...headers, 'Accept-Ranges': 'bytes', ETag: obj.httpEtag });
  if (obj.range && rangeHeader && 'offset' in obj.range) {
    const offset = obj.range.offset ?? 0;
    const length = obj.range.length ?? obj.size - offset;
    h.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    h.set('Content-Length', String(length));
    return new Response(obj.body, { status: 206, headers: h });
  }
  if (obj.range && rangeHeader && 'suffix' in obj.range) {
    const length = Math.min(obj.range.suffix, obj.size);
    h.set('Content-Range', `bytes ${obj.size - length}-${obj.size - 1}/${obj.size}`);
    h.set('Content-Length', String(length));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers: h });
}

export async function notify(env: Env, text: string): Promise<void> {
  if (!env.NOTIFY_WEBHOOK_URL) return;
  try {
    await fetch(env.NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, text }),
    });
  } catch {
    /* upozornění je best-effort */
  }
}

export function isMockPayments(env: Env): boolean {
  return env.APP_ENV === 'development' && !env.LEMONSQUEEZY_API_KEY;
}
