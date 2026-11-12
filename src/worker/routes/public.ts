import type { CatalogResponse } from '../../shared/types';
import type { BeatRow, Env } from '../types';
import { toBeat } from '../lib/db';
import { HttpError, isMockPayments, json, serveR2 } from '../lib/http';

export async function listBeats(env: Env): Promise<Response> {
  const rows = await env.DB
    .prepare(`SELECT * FROM beats WHERE status = 'active' ORDER BY sort_order ASC, created_at DESC LIMIT 200`)
    .all<BeatRow>();
  const body: CatalogResponse = {
    beats: rows.results.map(toBeat),
    currency: env.CURRENCY,
    servicePayments: !!env.LEMON_VARIANT_SERVICE || isMockPayments(env),
  };
  return json(body, 200, { 'Cache-Control': 'public, max-age=30' });
}

export async function getBeat(env: Env, slug: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT * FROM beats WHERE slug = ? AND status IN ('active', 'sold')`).bind(slug).first<BeatRow>();
  if (!row) throw new HttpError(404, 'not_found');
  return json({ beat: toBeat(row), currency: env.CURRENCY });
}

/** Veřejné ukázky. Z bucketu se vydává POUZE prefix previews/. */
export async function servePreview(env: Env, request: Request, file: string): Promise<Response> {
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(file)) throw new HttpError(404, 'not_found');
  return serveR2(env.FILES, `previews/${file}`, request, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
}

export async function health(env: Env): Promise<Response> {
  let db = false;
  try {
    await env.DB.prepare('SELECT 1').first();
    db = true;
  } catch { /* noop */ }
  return json({ ok: db, env: env.APP_ENV, db, payments: isMockPayments(env) ? 'mock' : env.LEMONSQUEEZY_API_KEY ? 'configured' : 'missing' }, db ? 200 : 503);
}
