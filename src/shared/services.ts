import type { ServiceId } from './types';

/** Ceník mixu a masteringu (v nejmenší jednotce měny, tj. haléřích). Uprav podle sebe. */
export const SERVICES: Record<ServiceId, { price: number; days: number; revisions: number }> = {
  master: { price: 120000, days: 3, revisions: 2 },
  mix: { price: 320000, days: 6, revisions: 3 },
  mixmaster: { price: 390000, days: 7, revisions: 3 },
};

export const SERVICE_IDS: ServiceId[] = ['mix', 'master', 'mixmaster'];

export const ADDONS = {
  /** Expresní dodání: +50 % */
  express: { type: 'percent', value: 50 },
  /** Ladění vokálů: za skladbu */
  tuning: { type: 'perSong', value: 60000 },
  /** Dodání stems (bounce po skupinách): za skladbu */
  stemsOut: { type: 'perSong', value: 40000 },
} as const;

export type AddonId = keyof typeof ADDONS;
export const ADDON_IDS = Object.keys(ADDONS) as AddonId[];

export const MAX_SONGS = 12;

/** Množstevní sleva: 3+ skladeb −10 %, 6+ −15 %. */
export function volumeDiscount(songs: number): number {
  if (songs >= 6) return 15;
  if (songs >= 3) return 10;
  return 0;
}

export function servicePrice(service: ServiceId, songs: number, addons: AddonId[]): number {
  const n = Math.min(MAX_SONGS, Math.max(1, Math.floor(songs)));
  let perSong = SERVICES[service].price;
  for (const a of addons) {
    const def = ADDONS[a];
    if (def.type === 'perSong') perSong += def.value;
  }
  let total = perSong * n;
  total = Math.round(total * (1 - volumeDiscount(n) / 100));
  if (addons.includes('express')) total = Math.round(total * (1 + ADDONS.express.value / 100));
  return Math.round(total / 100) * 100;
}
