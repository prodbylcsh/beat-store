/** Tóniny, žánry a odvození barvy desky z tóniny. Sdílí web i worker. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const ALL_KEYS: string[] = [
  ...NOTE_NAMES.map((n) => n),
  ...NOTE_NAMES.map((n) => `${n}m`),
];

export const DEFAULT_GENRES = [
  'Trap', 'Drill', 'Boom Bap', 'R&B', 'Hyperpop', 'Rage', 'Lo-fi', 'Afrobeats', 'Pop', 'House',
];

export function parseKey(key: string): { pc: number; minor: boolean } {
  const minor = /m$/.test(key);
  const root = key.replace(/m$/, '');
  const pc = Math.max(0, NOTE_NAMES.indexOf(root as (typeof NOTE_NAMES)[number]));
  return { pc, minor };
}

export function isValidKey(key: string): boolean {
  return ALL_KEYS.includes(key);
}

/** "F#m" -> "F♯ minor" */
export function keyLabel(key: string, lang: 'cs' | 'en' = 'en'): string {
  const { minor } = parseKey(key);
  const root = key.replace(/m$/, '').replace('#', '♯');
  if (lang === 'cs') return `${root} ${minor ? 'moll' : 'dur'}`;
  return `${root} ${minor ? 'min' : 'maj'}`;
}

/**
 * Tónina -> odstín. Kvintový kruh rozprostřený po barevném kole,
 * takže harmonicky blízké tóniny mají blízké barvy. Moll je chladnější a tmavší.
 */
export function keyHue(key: string): number {
  const { pc, minor } = parseKey(key);
  const fifths = (pc * 7) % 12;
  return (fifths * 30 + 28 + (minor ? -14 : 0) + 360) % 360;
}

export interface Rgb { r: number; g: number; b: number }

/** OKLCH -> sRGB (0..1), gamut-clamped. */
export function oklch(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
  const [r, g, bl] = lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  });
  return { r, g, b: bl };
}

export function rgbCss({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}

export interface BeatPalette { hue: number; main: Rgb; alt: Rgb; deep: Rgb; css: string; cssSoft: string }

/** Paleta desky: hlavní barva z tóniny, druhá barva z otisku zvuku. */
export function beatPalette(key: string, seed: number): BeatPalette {
  const hue = keyHue(key);
  const { minor } = parseKey(key);
  const shift = 28 + (seed % 5) * 14;
  const dir = seed % 2 ? 1 : -1;
  const main = oklch(minor ? 0.66 : 0.74, minor ? 0.19 : 0.18, hue);
  const alt = oklch(minor ? 0.52 : 0.84, 0.15, hue + dir * shift);
  const deep = oklch(0.3, 0.09, hue - dir * 12);
  return { hue, main, alt, deep, css: rgbCss(main), cssSoft: rgbCss(oklch(0.86, 0.09, hue)) };
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'beat';
}

export function formatMoney(minor: number, currency: string, lang: 'cs' | 'en' = 'cs'): string {
  const value = minor / 100;
  try {
    return new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-US', {
      style: 'currency', currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
