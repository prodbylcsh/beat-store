const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? enc.encode(input) : input;
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

export async function hmacHex(secret: string, message: string | ArrayBuffer): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const data = typeof message === 'string' ? enc.encode(message) : message;
  return toHex(await crypto.subtle.sign('HMAC', key, data));
}

/** Porovnání v konstantním čase (délka se může prozradit, obsah ne). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Ověření podpisu Lemon Squeezy: HMAC-SHA256 nad syrovým tělem, hex v hlavičce X-Signature. */
export async function verifyLemonSignature(rawBody: ArrayBuffer, signature: string | null, secret: string | undefined): Promise<boolean> {
  if (!signature || !secret) return false;
  const expected = await hmacHex(secret, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

export function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function uuid(): string {
  return crypto.randomUUID();
}
