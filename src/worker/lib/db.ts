import type { AdminBeat, Beat, LicenseId } from '../../shared/types';
import type { BeatRow, Env } from '../types';

export function previewUrl(key: string | null): string | null {
  return key ? `/media/p/${key.replace(/^previews\//, '')}` : null;
}

export function toBeat(r: BeatRow): Beat {
  return {
    id: r.id, slug: r.slug, title: r.title, bpm: r.bpm, key: r.musical_key, genre: r.genre,
    duration: r.duration_sec, peaks: r.peaks, seed: r.seed,
    prices: { wav: r.price_wav, stems: r.price_stems, exclusive: r.price_exclusive },
    hasStems: !!r.stems_key, status: r.status, previewUrl: previewUrl(r.preview_key), createdAt: r.created_at,
  };
}

export function toAdminBeat(r: BeatRow): AdminBeat {
  return {
    ...toBeat(r), hasWav: !!r.wav_key, hasPreview: !!r.preview_key,
    wavName: r.wav_name, stemsName: r.stems_name, sortOrder: r.sort_order,
  };
}

export function variantFor(env: Env, license: LicenseId): string {
  const v = { wav: env.LEMON_VARIANT_WAV, stems: env.LEMON_VARIANT_STEMS, exclusive: env.LEMON_VARIANT_EXCLUSIVE }[license];
  if (v) return v;
  return env.APP_ENV === 'development' && !env.LEMONSQUEEZY_API_KEY ? `mock-${license}` : '';
}

export const nowIso = () => new Date().toISOString();

export function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString();
}
