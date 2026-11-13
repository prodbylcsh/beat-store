import { reactive, watch } from 'vue';
import { beatPalette, rgbCss } from '../../shared/music';
import type { Beat } from '../../shared/types';

/** Přehrávač: jeden <audio> pro celý web + analyzér, který rozhýbává desku a typografii. */

export const player = reactive({
  current: null as Beat | null,
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  queue: [] as Beat[],
});

/** Hodnoty čtené každý snímek – záměrně mimo reaktivitu. */
export const meter = { bass: 0, level: 0, progress: 0 };

let audio: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let bins: Uint8Array<ArrayBuffer> | null = null;

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('playing', () => { player.playing = true; player.loading = false; });
  audio.addEventListener('pause', () => { player.playing = false; });
  audio.addEventListener('waiting', () => { player.loading = true; });
  audio.addEventListener('durationchange', () => { if (Number.isFinite(audio!.duration)) player.duration = audio!.duration; });
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('error', () => { player.loading = false; player.playing = false; });
  return audio;
}

function ensureGraph(): void {
  if (ctx || !audio) return;
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    ctx.createMediaElementSource(audio).connect(analyser);
    analyser.connect(ctx.destination);
    bins = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    ctx = null; // bez analyzéru se jen nehýbe grafika
  }
}

export function getContext(): AudioContext | null {
  return ctx;
}

/** Volá se jednou za snímek z vykreslovací smyčky. */
export function tick(): void {
  if (audio && player.current) {
    const d = audio.duration || player.current.duration || 1;
    meter.progress = Math.min(1, audio.currentTime / d);
    if (Math.abs(audio.currentTime - player.time) > 0.2) player.time = audio.currentTime;
  }
  let bass = 0, all = 0;
  if (analyser && bins && player.playing) {
    analyser.getByteFrequencyData(bins);
    for (let i = 1; i < 7; i++) bass += bins[i];
    bass /= 6 * 255;
    for (let i = 0; i < 96; i++) all += bins[i];
    all /= 96 * 255;
  }
  const target = Math.pow(bass, 1.6);
  meter.bass += (target - meter.bass) * (target > meter.bass ? 0.55 : 0.12);
  meter.level += (all - meter.level) * 0.2;
}

export async function play(beat: Beat, queue?: Beat[]): Promise<void> {
  const a = ensureAudio();
  if (queue) player.queue = queue;
  if (player.current?.id !== beat.id) {
    if (!beat.previewUrl) return;
    player.current = beat;
    player.time = 0;
    player.duration = beat.duration;
    meter.progress = 0;
    a.src = beat.previewUrl;
  }
  player.loading = true;
  ensureGraph();
  if (ctx?.state === 'suspended') await ctx.resume();
  try {
    await a.play();
  } catch {
    player.loading = false;
  }
}

export function pause(): void {
  audio?.pause();
}

export function toggle(beat?: Beat | null, queue?: Beat[]): void {
  const target = beat ?? player.current;
  if (!target) return;
  if (player.current?.id === target.id && player.playing) pause();
  else void play(target, queue);
}

export function seek(frac: number): void {
  if (!audio || !player.current) return;
  const d = audio.duration || player.current.duration;
  audio.currentTime = Math.max(0, Math.min(d - 0.05, frac * d));
  player.time = audio.currentTime;
  meter.progress = audio.currentTime / d;
}

export function seekBy(sec: number): void {
  if (!audio || !player.current) return;
  const d = audio.duration || player.current.duration;
  seek((audio.currentTime + sec) / d);
}

export function next(auto = false): void {
  const q = player.queue;
  const i = q.findIndex((b) => b.id === player.current?.id);
  if (i === -1 || !q.length) { if (auto) player.playing = false; return; }
  void play(q[(i + 1) % q.length]);
}

export function prev(): void {
  const q = player.queue;
  const i = q.findIndex((b) => b.id === player.current?.id);
  if (audio && audio.currentTime > 3) return seek(0);
  if (i === -1 || !q.length) return;
  void play(q[(i - 1 + q.length) % q.length]);
}

/** Krátký tón klávesy (filtr tóniny je zároveň malý nástroj). */
export function blip(pc: number, minor: boolean): void {
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    const c = ctx ?? (blipCtx ??= new AC());
    if (c.state === 'suspended') void c.resume();
    const now = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    g.connect(c.destination);
    for (const semi of [0, minor ? 3 : 4, 7]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 261.63 * 2 ** ((pc + semi) / 12);
      o.connect(g);
      o.start(now);
      o.stop(now + 0.95);
    }
  } catch { /* zvuk je jen bonus */ }
}
let blipCtx: AudioContext | undefined;

/* --- světla: když hraje hudba, web zhasne a rozsvítí se barvou tóniny --- */
let lightsTimer: number | undefined;
watch(() => player.playing, (on) => {
  window.clearTimeout(lightsTimer);
  const root = document.documentElement;
  if (on) root.dataset.live = '1';
  else lightsTimer = window.setTimeout(() => delete root.dataset.live, 900);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', on ? '#0b0b0a' : '#eceae4');
});

watch(() => player.current, (b) => {
  if (!b) return;
  const p = beatPalette(b.key, b.seed);
  const s = document.documentElement.style;
  s.setProperty('--k', p.css);
  s.setProperty('--k-soft', p.cssSoft);
  s.setProperty('--k2', rgbCss(p.alt));
});
