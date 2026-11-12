import type { Env } from './types';
import { HttpError, json } from './lib/http';
import * as admin from './routes/admin';
import { checkout, serviceOrder } from './routes/checkout';
import { devCheckoutPage, devPay } from './routes/dev';
import { orderDownload, orderLicense, orderStatus } from './routes/order';
import { getBeat, health, listBeats, servePreview } from './routes/public';
import { lemonWebhook } from './routes/webhook';

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const p = url.pathname;
  const m = request.method;
  let x: RegExpMatchArray | null;

  if (m === 'GET' || m === 'HEAD') {
    if ((x = p.match(/^\/media\/p\/([^/]+)$/))) return servePreview(env, request, x[1]);
    if (p === '/api/health') return health(env);
    if (p === '/api/beats') return listBeats(env);
    if ((x = p.match(/^\/api\/beats\/([a-z0-9-]{1,80})$/))) return getBeat(env, x[1]);
    if ((x = p.match(/^\/api\/orders\/([^/]+)$/))) return orderStatus(env, request, x[1]);
    if ((x = p.match(/^\/api\/orders\/([^/]+)\/download\/(wav|stems)$/))) return orderDownload(env, request, x[1], x[2]);
    if ((x = p.match(/^\/api\/orders\/([^/]+)\/license$/))) return orderLicense(env, request, x[1]);
    if ((x = p.match(/^\/api\/dev\/checkout\/([0-9a-f-]{36})$/))) return devCheckoutPage(env, url, x[1]);
  }
  if (m === 'POST') {
    if (p === '/api/checkout') return checkout(env, request);
    if (p === '/api/services') return serviceOrder(env, request, ctx);
    if (p === '/api/webhooks/lemonsqueezy') return lemonWebhook(env, request, ctx);
    if (p === '/api/dev/pay') return devPay(env, request);
    if (p === '/api/admin/login') return admin.login(env, request);
    if (p === '/api/admin/logout') return admin.logout(request);
  }

  if (p.startsWith('/api/admin/')) {
    if (p === '/api/admin/me' && m === 'GET') return json({ admin: await admin.isAdmin(env, request), configured: !!env.ADMIN_PASSWORD });
    await admin.requireAdmin(env, request);
    if (p === '/api/admin/beats' && m === 'GET') return admin.adminListBeats(env);
    if (p === '/api/admin/beats' && m === 'POST') return admin.adminCreateBeat(env, request);
    if ((x = p.match(/^\/api\/admin\/beats\/([0-9a-f-]{36})$/))) {
      if (m === 'PATCH') return admin.adminUpdateBeat(env, request, x[1]);
      if (m === 'DELETE') return admin.adminDeleteBeat(env, x[1]);
    }
    if (p === '/api/admin/files' && m === 'PUT') return admin.adminPutFile(env, request, url);
    if (p === '/api/admin/uploads' && m === 'POST') return admin.adminMultipartCreate(env, request);
    if (p === '/api/admin/uploads/part' && m === 'PUT') return admin.adminMultipartPart(env, request, url);
    if (p === '/api/admin/uploads/complete' && m === 'POST') return admin.adminMultipartComplete(env, request);
    if (p === '/api/admin/orders' && m === 'GET') return admin.adminOrders(env);
    if ((x = p.match(/^\/api\/admin\/services\/([0-9a-f-]{36})$/)) && m === 'PATCH') return admin.adminUpdateService(env, request, x[1]);
    if (p === '/api/admin/tag') return admin.adminTag(env, request);
  }
  throw new HttpError(404, 'not_found');
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message !== e.code ? e.message : undefined }, e.status);
      // Detaily jen do logu; klient nikdy nedostane stack trace ani obsah proměnných.
      console.error('unhandled', e instanceof Error ? e.stack : String(e));
      return json({ error: 'internal_error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
