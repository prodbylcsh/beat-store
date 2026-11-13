import { ref } from 'vue';
import { BRAND } from '../../shared/brand';
import { beatPalette, keyLabel, rgbCss } from '../../shared/music';
import type { Beat } from '../../shared/types';

/**
 * Textura desky: uprostřed etiketa (název, BPM, tónina, žánr), kolem ní text „vyrytý“ do vinylu.
 * RGB = etiketa, alfa mimo etiketu = maska rytiny. Kreslí se 2D plátnem z údajů beatu.
 */
export const ART_SIZE = 768;
export const LABEL_R = 0.292;
/** zvýší se po načtení písem – obaly a textury se pak překreslí správným fontem */
export const artVersion = ref(0);

const cache = new Map<string, HTMLCanvasElement>();
if (typeof document !== 'undefined' && document.fonts) {
  void Promise.all([document.fonts.load("800 40px 'Archivo Variable'"), document.fonts.load("500 20px 'JetBrains Mono Variable'")])
    .then(() => document.fonts.ready)
    .then(() => { cache.clear(); artVersion.value++; });
}

type Ctx = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

function font(ctx: Ctx, weight: number, px: number, wide = true, mono = false) {
  ctx.font = `${weight} ${px}px ${mono ? "'JetBrains Mono Variable', monospace" : "'Archivo Variable', Arial, sans-serif"}`;
  if ('fontStretch' in ctx) ctx.fontStretch = wide && !mono ? 'extra-expanded' : 'normal';
}

/** Text po kružnici (střed c, poloměr r), začíná nahoře a jde po směru hodin. */
function arcText(ctx: Ctx, text: string, c: number, r: number, startAngle = -Math.PI / 2, spacing = 0) {
  let a = startAngle;
  for (const ch of text) {
    const w = ctx.measureText(ch).width + spacing;
    a += w / 2 / r;
    ctx.save();
    ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += w / 2 / r;
  }
  return a - startAngle;
}

export function discArt(beat: Pick<Beat, 'id' | 'title' | 'bpm' | 'key' | 'genre' | 'seed'>): HTMLCanvasElement {
  const key = `${beat.id}|${beat.title}|${beat.bpm}|${beat.key}|${beat.genre}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = ART_SIZE, c = S / 2, R = S / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d') as Ctx;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pal = beatPalette(beat.key, beat.seed);
  const title = beat.title.toUpperCase();
  const keyTxt = keyLabel(beat.key, 'en').toUpperCase();

  /* --- rytina ve vinylu: název a údaje dokola přes drážky --- */
  ctx.fillStyle = '#fff';
  const ring = `${title}  ✦  ${beat.bpm} BPM  ✦  ${keyTxt}  ✦  ${beat.genre.toUpperCase()}  ✦  `;
  let px = 128;
  const rText = R * 0.655;
  for (;;) {
    font(ctx, 800, px);
    const w = ctx.measureText(ring).width;
    // text se musí vejít na obvod jednou; kratší názvy se zopakují
    if (w <= 2 * Math.PI * rText * 0.99 || px <= 44) break;
    px -= 4;
  }
  const once = ctx.measureText(ring).width;
  const reps = Math.max(1, Math.floor((2 * Math.PI * rText) / once));
  const gap = (2 * Math.PI * rText - once * reps) / (ring.length * reps);
  arcText(ctx, ring.repeat(reps), c, rText, -Math.PI / 2 + ((beat.seed % 628) / 100), gap);
  // drobná „matrice“ u okraje jako na skutečném lisu
  font(ctx, 500, 15, false, true);
  ctx.globalAlpha = 0.75;
  arcText(ctx, `${BRAND.name}-${String(beat.seed % 10000).padStart(4, '0')} · 33⅓ RPM · ${BRAND.credit.toUpperCase()} · `.repeat(3), c, R * 0.925, 0.4, 2.2);
  ctx.globalAlpha = 1;

  /* --- etiketa --- */
  const rl = R * LABEL_R;
  const kind = Math.floor(beat.seed / 7) % 4;
  const paper = '#f1eee5', ink = '#0f0f0d';
  const main = rgbCss(pal.main), alt = rgbCss(pal.alt);
  const bg = [paper, ink, main, paper][kind];
  const fg = [ink, paper, ink, ink][kind];
  const accent = [main, main, paper, alt][kind];
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, rl + 1.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  // barevný půlkruh / pruh podle otisku
  ctx.fillStyle = accent;
  if (kind === 0 || kind === 3) { ctx.beginPath(); ctx.arc(c, c, rl, Math.PI, 0); ctx.fill(); }
  else { ctx.fillRect(c - rl, c + rl * 0.42, rl * 2, rl * 0.3); }
  // obvodový text
  ctx.fillStyle = fg;
  font(ctx, 600, 10.5, false, true);
  arcText(ctx, `${BRAND.credit.toUpperCase()} · SIDE A · STEREO · `.repeat(2), c, rl * 0.9, -Math.PI * 0.98, 1.6);
  // název (max 2 řádky, zmenšuje se podle délky)
  const words = title.split(/\s+/);
  let lines = [title];
  if (words.length > 1 && title.length > 9) {
    let best = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const m = Math.max(a.length, b.length);
      if (m < best) { best = m; lines = [a, b]; }
    }
  }
  let tp = 40;
  const maxW = rl * 1.42;
  for (;;) {
    font(ctx, 800, tp);
    if (Math.max(...lines.map((l) => ctx.measureText(l).width)) <= maxW || tp <= 13) break;
    tp -= 1;
  }
  const lh = tp * 0.92;
  const top = c - rl * 0.4 - ((lines.length - 1) * lh) / 2;
  ctx.fillStyle = kind === 0 || kind === 3 ? ink : fg;
  lines.forEach((l, i) => ctx.fillText(l, c, top + i * lh));
  // údaje pod středem
  ctx.fillStyle = fg;
  font(ctx, 700, 15, false, true);
  ctx.fillText(`${beat.bpm} BPM`, c - rl * 0.42, c + rl * 0.2);
  ctx.fillText(keyTxt, c + rl * 0.42, c + rl * 0.2);
  font(ctx, 500, 11.5, false, true);
  ctx.fillStyle = kind === 1 || kind === 2 ? ink : fg;
  if (kind === 1) ctx.fillStyle = ink;
  ctx.fillText(beat.genre.toUpperCase(), c, c + rl * 0.57);
  // střed
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(c, c, rl * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  cache.set(key, cv);
  return cv;
}
