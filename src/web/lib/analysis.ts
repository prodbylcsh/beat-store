import { NOTE_NAMES } from '../../shared/music';
import { computePeaks, peaksToBase64, seedFromPeaks } from '../../shared/peaks';

/** Analýza nahraného WAV v prohlížeči: obálka pro artwork, odhad BPM a tóniny, ukázka MP3. */

export interface Analysis {
  buffer: AudioBuffer;
  duration: number;
  peaks: string;
  seed: number;
  bpm: number;
  key: string;
}

export async function analyze(file: File): Promise<Analysis> {
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  const ctx: AudioContext = new AC();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const peaks = computePeaks(channels);
  const mono = downmix(channels, buffer.sampleRate, 11025);
  return {
    buffer, duration: buffer.duration, peaks: peaksToBase64(peaks), seed: seedFromPeaks(peaks),
    bpm: detectBpm(mono, 11025), key: detectKey(mono, 11025),
  };
}

/** Mono + hrubé převzorkování (průměrováním) – pro analýzu stačí. Bere nejvýše 90 s ze středu. */
function downmix(channels: Float32Array[], sr: number, target: number): Float32Array {
  const ratio = Math.max(1, Math.round(sr / target));
  const total = channels[0].length;
  const span = Math.min(total, Math.floor(90 * sr));
  const start = Math.floor((total - span) / 2);
  const out = new Float32Array(Math.floor(span / ratio));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let j = 0; j < ratio; j++) for (const ch of channels) s += ch[start + i * ratio + j];
    out[i] = s / (ratio * channels.length);
  }
  return out;
}

/** Tempo: autokorelace obálky nástupů. Výsledek držíme v pásmu 70–180 BPM. */
export function detectBpm(x: Float32Array, sr: number): number {
  const hop = 128;
  const n = Math.floor(x.length / hop);
  if (n < 200) return 120;
  const env = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = 0; j < hop; j++) { const v = x[i * hop + j]; e += v * v; }
    e = Math.log1p(e * 100);
    env[i] = Math.max(0, e - prev);
    prev = e;
  }
  const fps = sr / hop;
  let best = 120, bestScore = -Infinity;
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let score = 0;
    // sečti korelaci na 1×, 2× a 4× periodě – stabilní tempo má silné všechny
    for (const [mult, w] of [[1, 1], [2, 0.8], [4, 0.6], [0.5, 0.4]] as const) {
      const L = lag * mult;
      const l0 = Math.floor(L), frac = L - l0;
      let c = 0;
      for (let i = 0; i + l0 + 1 < n; i++) c += env[i] * (env[i + l0] * (1 - frac) + env[i + l0 + 1] * frac);
      score += (w * c) / (n - l0);
    }
    if (score > bestScore) { bestScore = score; best = bpm; }
  }
  return Math.round(best);
}

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Tónina: chromagram (Goertzel přes 5 oktáv) porovnaný s Krumhansl–Schmucklerovými profily. */
export function detectKey(x: Float32Array, sr: number): string {
  const frame = 4096;
  const chroma = new Float64Array(12);
  const frames = Math.min(160, Math.floor(x.length / frame));
  const stride = Math.max(1, Math.floor(x.length / frame / Math.max(1, frames)));
  for (let f = 0; f < frames; f++) {
    const off = f * stride * frame;
    for (let midi = 36; midi < 96; midi++) {
      const freq = 440 * 2 ** ((midi - 69) / 12);
      if (freq > sr / 2.2) break;
      const w = (2 * Math.PI * freq) / sr;
      const coeff = 2 * Math.cos(w);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < frame; i++) {
        const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));
        const s0 = x[off + i] * win + coeff * s1 - s2;
        s2 = s1; s1 = s0;
      }
      chroma[midi % 12] += Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
    }
  }
  const corr = (profile: number[], shift: number) => {
    let mx = 0, my = 0;
    for (let i = 0; i < 12; i++) { mx += chroma[i]; my += profile[i]; }
    mx /= 12; my /= 12;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < 12; i++) {
      const a = chroma[(i + shift) % 12] - mx, b = profile[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    return num / Math.sqrt(dx * dy || 1);
  };
  let best = 'C', bestScore = -Infinity;
  for (let pc = 0; pc < 12; pc++) {
    const maj = corr(MAJOR, pc), min = corr(MINOR, pc);
    if (maj > bestScore) { bestScore = maj; best = NOTE_NAMES[pc]; }
    if (min > bestScore) { bestScore = min; best = `${NOTE_NAMES[pc]}m`; }
  }
  return best;
}

/** Vyrenderuje ukázku na 44,1 kHz stereo a volitelně do ní přimíchá hlasovou značku. */
export async function renderPreview(buffer: AudioBuffer, tag: AudioBuffer | null): Promise<{ left: Float32Array; right: Float32Array }> {
  const sr = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(buffer.duration * sr), sr);
  const src = off.createBufferSource();
  src.buffer = buffer;
  src.connect(off.destination);
  src.start();
  if (tag) {
    for (let t = 5; t < buffer.duration - tag.duration; t += 24) {
      const s = off.createBufferSource();
      const g = off.createGain();
      g.gain.value = 0.85;
      s.buffer = tag;
      s.connect(g).connect(off.destination);
      s.start(t);
    }
  }
  const out = await off.startRendering();
  return { left: out.getChannelData(0), right: out.getChannelData(1) };
}

export function encodeMp3(pcm: { left: Float32Array; right: Float32Array }, onProgress: (p: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ progress?: number; blob?: Blob; error?: string }>) => {
      if (e.data.progress !== undefined) onProgress(e.data.progress);
      if (e.data.blob) { worker.terminate(); resolve(e.data.blob); }
      if (e.data.error) { worker.terminate(); reject(new Error(e.data.error)); }
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
    worker.postMessage({ left: pcm.left, right: pcm.right, sampleRate: 44100, kbps: 128 }, [pcm.left.buffer, pcm.right.buffer]);
  });
}
