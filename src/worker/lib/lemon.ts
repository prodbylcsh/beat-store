import type { Env } from '../types';
import { HttpError } from './http';

const API = 'https://api.lemonsqueezy.com/v1';

function headers(env: Env): Record<string, string> {
  return {
    Authorization: `Bearer ${env.LEMONSQUEEZY_API_KEY}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  };
}

export interface CheckoutInput {
  variantId: string;
  priceMinor: number;
  name: string;
  description: string;
  intentId: string;
  /** Stránka objednávky s tajným tokenem – cíl po zaplacení i tlačítka v potvrzení. */
  orderUrl: string;
  buttonText: string;
  thankYouNote: string;
}

/** Vytvoří hosted checkout pro jednu variantu s cenou a názvem určeným serverem. */
export async function createCheckout(env: Env, input: CheckoutInput): Promise<string> {
  if (!env.LEMONSQUEEZY_API_KEY || !env.LEMON_STORE_ID) throw new HttpError(503, 'payments_not_configured');
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        custom_price: input.priceMinor,
        product_options: {
          name: input.name,
          description: input.description,
          redirect_url: input.orderUrl,
          receipt_button_text: input.buttonText,
          receipt_link_url: input.orderUrl,
          receipt_thank_you_note: input.thankYouNote,
          enabled_variants: [Number(input.variantId)],
        },
        checkout_options: { embed: false },
        checkout_data: { custom: { intent_id: input.intentId } },
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
        test_mode: env.APP_ENV !== 'production',
      },
      relationships: {
        store: { data: { type: 'stores', id: String(env.LEMON_STORE_ID) } },
        variant: { data: { type: 'variants', id: String(input.variantId) } },
      },
    },
  };
  let res: Response;
  try {
    res = await fetch(`${API}/checkouts`, { method: 'POST', headers: headers(env), body: JSON.stringify(body) });
  } catch {
    throw new HttpError(502, 'payments_unavailable');
  }
  if (!res.ok) {
    console.error('lemon checkout failed', res.status, (await res.text()).slice(0, 500));
    throw new HttpError(502, 'payments_unavailable');
  }
  const data = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = data.data?.attributes?.url;
  if (!url || !/^https:\/\/[a-z0-9.-]+\.lemonsqueezy\.com\//.test(url)) throw new HttpError(502, 'payments_unavailable');
  return url;
}

/** Zruší předplatné – doběhne do konce zaplaceného období a už se neobnoví. */
export async function cancelSubscription(env: Env, subscriptionId: string): Promise<boolean> {
  if (!env.LEMONSQUEEZY_API_KEY) return false;
  try {
    const res = await fetch(`${API}/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'DELETE', headers: headers(env) });
    if (!res.ok) console.error('lemon cancel failed', subscriptionId, res.status);
    return res.ok;
  } catch {
    return false;
  }
}
