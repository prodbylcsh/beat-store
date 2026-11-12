/** Obálka waveformu: z ní vzniká drážka desky i proužek v katalogu. Bez importů – používá ji i Node skript. */

export const PEAK_COUNT = 2048;

export function computePeaks(channels: Float32Array[], count = PEAK_COUNT): Uint8Array {
  const len = channels[0]?.length ?? 0;
  const out = new Uint8Array(count);
  if (!len) return out;
  const raw = new Float32Array(count);
  const step = len / count;
  let max = 0;
  for (let i = 0; i < count; i++) {
    const a = Math.floor(i * step);
    const b = Math.min(len, Math.floor((i + 1) * step) + 1);
    // RMS + špička: RMS drží "tělo" zvuku, špička zachová údery bicích
    let sum = 0, peak = 0, n = 0;
    const stride = Math.max(1, Math.floor((b - a) / 400));
    for (let j = a; j < b; j += stride) {
      let v = 0;
      for (const ch of channels) v += ch[j];
      v = Math.abs(v / channels.length);
      sum += v * v;
      if (v > peak) peak = v;
      n++;
    }
    const v = 0.65 * Math.sqrt(sum / Math.max(1, n)) + 0.35 * peak;
    raw[i] = v;
    if (v > max) max = v;
  }
  for (let i = 0; i < count; i++) out[i] = Math.round(255 * Math.pow(raw[i] / (max || 1), 0.8));
  return out;
}

export function peaksToBase64(peaks: Uint8Array): string {
  let s = '';
  for (let i = 0; i < peaks.length; i++) s += String.fromCharCode(peaks[i]);
  return btoa(s);
}

export function peaksFromBase64(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(PEAK_COUNT);
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Deterministický otisk zvuku (FNV-1a nad obálkou) – řídí vzhled desky. */
export function seedFromPeaks(peaks: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < peaks.length; i++) {
    h ^= peaks[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 2147483647;
}
