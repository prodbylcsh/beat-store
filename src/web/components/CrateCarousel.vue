<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { beatPalette, formatMoney, formatTime, keyLabel } from '../../shared/music';
import type { Beat } from '../../shared/types';
import { artVersion } from '../lib/disc-art';
import { fxBurst, startFlight } from '../lib/fx';
import { GrooveRenderer, lookFor } from '../lib/groove';
import { lang, t } from '../lib/i18n';
import { meter, player, toggle } from '../lib/player';
import { stage } from '../lib/stage';
import { vMagnet, vTilt } from '../lib/tilt';
import { currency } from '../lib/store';
import MiniWave from './MiniWave.vue';

/**
 * Katalog jako bedna s deskami. Vinyly jsou 3D objekty:
 *  – tažením za prostřední desku ji nakláníš a otáčíš (klidně i na rub), po puštění se zhoupne zpět,
 *  – tažením mimo ni (nebo šipkami / hřbety dole) listuješ,
 *  – klepnutím na prostřední desku ji „vyhodíš“ z bedny a otevře se detail beatu.
 */
const props = defineProps<{ beats: Beat[] }>();
const router = useRouter();
const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const index = ref(0);
const grabbing = ref<'' | 'tilt' | 'browse'>('');
const focus = computed(() => props.beats[Math.min(index.value, props.beats.length - 1)] ?? null);
const color = computed(() => (focus.value ? beatPalette(focus.value.key, focus.value.seed).css : 'var(--k)'));
const isPlaying = computed(() => !!focus.value && player.playing && player.current?.id === focus.value.id);
const colors = computed(() => props.beats.map((b) => beatPalette(b.key, b.seed).css));

let renderer: GrooveRenderer | null = null;
let raf = 0, visible = false, io: IntersectionObserver | null = null;
let pos = 0, target = 0, vel = 0, spin = 0, spinSpeed = 0.2, last = performance.now();
let hoverX = 0, hoverY = 0, hovering = false, hoverYaw = 0, hoverPitch = 0, lean = 0, lift = 0;
// ruční naklonění prostřední desky (pružina zpět do nuly)
const tilt = { yaw: 0, pitch: 0, vy: 0, vp: 0 };
let punch = 0, leaving = false;
let W = 0, H = 0;

function layout(d: number) {
  const size = Math.min(H * 0.84, W * 0.66, 540);
  const gap = Math.max(110, Math.min(W * 0.17, size * 0.5));
  const ad = Math.abs(d), sg = Math.sign(d);
  const near = Math.min(ad, 1);
  return {
    x: W / 2 + sg * (near * size * 0.7 + Math.max(0, ad - 1) * gap),
    yaw: -sg * (near * 1.08) - lean * (1 - near * 0.5),
    scale: 1 - near * 0.3,
    size,
  };
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  const r = renderer;
  if (!r || !visible || !props.beats.length) return;
  void artVersion.value;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (drag.mode !== 'browse') {
    vel += (target - pos) * 90 * dt;
    vel *= Math.exp(-dt * 13);
    pos += vel * dt;
  }
  const maxI = props.beats.length - 1;
  pos = Math.max(-0.35, Math.min(maxI + 0.35, pos));
  lean += (Math.max(-0.6, Math.min(0.6, vel * 0.09)) - lean) * (1 - Math.exp(-dt * 8));
  const idx = Math.max(0, Math.min(maxI, Math.round(pos)));
  if (idx !== index.value) { index.value = idx; tilt.vy += vel * 0.4; }

  // pružina naklonění: po puštění se deska zhoupne zpět čelem
  if (drag.mode !== 'tilt') {
    const home = Math.round(tilt.yaw / (2 * Math.PI)) * 2 * Math.PI;
    tilt.vy += (home - tilt.yaw) * 46 * dt; tilt.vy *= Math.exp(-dt * 5.5); tilt.yaw += tilt.vy * dt;
    tilt.vp += (0 - tilt.pitch) * 46 * dt; tilt.vp *= Math.exp(-dt * 5.5); tilt.pitch += tilt.vp * dt;
  }
  punch *= Math.exp(-dt * (leaving ? 1.5 : 7));

  const b = wrap.value!.getBoundingClientRect();
  W = b.width; H = b.height;
  r.resize(W, H, Math.min(2, window.devicePixelRatio || 1));
  r.clear();

  const calm = drag.mode ? 0 : 1;
  hoverYaw += ((hovering ? hoverX * 0.5 : 0) * calm - hoverYaw) * (1 - Math.exp(-dt * 7));
  hoverPitch += ((hovering ? hoverY * 0.3 : 0) * calm - hoverPitch) * (1 - Math.exp(-dt * 7));
  lift += ((hovering || drag.mode === 'tilt' ? 1 : 0) - lift) * (1 - Math.exp(-dt * 8));
  const cur = props.beats[idx];
  const playing = player.playing && player.current?.id === cur.id;
  spinSpeed += ((playing ? 3.49 : 0.12) + punch * 14 - spinSpeed) * (1 - Math.exp(-dt * 6));
  spin += spinSpeed * dt;
  const live = document.documentElement.dataset.live === '1' ? 1 : 0;

  const order = props.beats.map((_, i) => i).filter((i) => Math.abs(i - pos) < 5.5).sort((a, c) => Math.abs(c - pos) - Math.abs(a - pos));
  for (const i of order) {
    const d = i - pos;
    const L = layout(d);
    const centre = i === idx ? 1 - Math.min(1, Math.abs(d) * 1.6) : 0;
    if (i === idx && leaving) continue; // prostřední desku už převzalo jeviště a letí na detail
    const beat = props.beats[i];
    const mine = player.current?.id === beat.id;
    r.drawBeat(lookFor(beat), {
      cx: L.x, cy: H * 0.5 - centre * lift * 8, size: L.size * L.scale * (1 + centre * (lift * 0.04 + punch * 0.1)),
      pitch: -0.06 + centre * (hoverPitch + tilt.pitch), yaw: L.yaw + centre * (hoverYaw + tilt.yaw), roll: lean * 0.12,
      spin: -(mine || i === idx ? spin : (beat.seed % 628) / 100),
      progress: mine ? meter.progress : -1, level: mine && player.playing ? meter.bass : 0,
      alpha: Math.min(1, Math.max(0, 5.4 - Math.abs(d))) * (leaving ? Math.max(0, 1 - (1 - punch) * 1.4) : 1), live, shadow: 2, time: now / 1000,
    });
  }
}

/* --- ovládání --- */
const drag = { mode: '' as '' | 'tilt' | 'browse', x: 0, y: 0, pos: 0, moved: 0, t: 0, lastX: 0, lastY: 0 };
function go(i: number) { target = Math.max(0, Math.min(props.beats.length - 1, i)); }
function onCentre(e: PointerEvent): boolean {
  const b = wrap.value!.getBoundingClientRect();
  return Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) < layout(0).size * 0.47;
}
function down(e: PointerEvent) {
  if (e.button !== 0 || leaving) return;
  drag.mode = onCentre(e) ? 'tilt' : 'browse';
  grabbing.value = drag.mode;
  drag.x = drag.lastX = e.clientX; drag.y = drag.lastY = e.clientY; drag.pos = pos; drag.moved = 0; drag.t = performance.now();
  if (drag.mode === 'browse') vel = 0; else { tilt.vy = 0; tilt.vp = 0; }
  wrap.value!.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  const b = wrap.value!.getBoundingClientRect();
  const size = layout(0).size;
  hoverX = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (size / 2)));
  hoverY = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / (size / 2)));
  hovering = e.pointerType === 'mouse' && Math.hypot(hoverX, hoverY) < 1;
  if (!drag.mode) return;
  const now = performance.now();
  const dtt = Math.max(0.008, (now - drag.t) / 1000);
  const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
  drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
  if (drag.mode === 'tilt') {
    // deska se otáčí pod prstem: 1 šířka desky ≈ půl otáčky
    const k = Math.PI / size;
    tilt.yaw += dx * k; tilt.pitch = Math.max(-1.25, Math.min(1.25, tilt.pitch + dy * k));
    tilt.vy = (dx * k) / dtt; tilt.vp = (dy * k) / dtt;
  } else {
    const step = size * 0.62;
    pos = drag.pos - (e.clientX - drag.x) / step;
    vel = (-dx / step) / dtt;
  }
  drag.lastX = e.clientX; drag.lastY = e.clientY; drag.t = now;
}
function up(e: PointerEvent) {
  const mode = drag.mode;
  if (!mode) return;
  drag.mode = ''; grabbing.value = '';
  if (drag.moved < 7) {
    if (mode === 'tilt') return open();
    // klepnutí na krajní desku = přejet na ni
    const b = wrap.value!.getBoundingClientRect();
    const x = e.clientX - b.left;
    let best = index.value, bd = Infinity;
    for (let i = Math.max(0, index.value - 4); i <= Math.min(props.beats.length - 1, index.value + 4); i++) {
      if (i === index.value) continue;
      const L = layout(i - pos);
      const dd = Math.abs(L.x - x);
      if (dd < bd && dd < L.size * 0.35) { bd = dd; best = i; }
    }
    go(best);
    vel = 0;
  } else if (mode === 'browse') {
    go(Math.round(pos + Math.max(-2.2, Math.min(2.2, vel * 0.16))));
  } else {
    tilt.vy = Math.max(-14, Math.min(14, tilt.vy)); tilt.vp = Math.max(-8, Math.min(8, tilt.vp));
  }
}
function cancel() { drag.mode = ''; grabbing.value = ''; }
let wheelAcc = 0, wheelT = 0;
function wheel(e: WheelEvent) {
  const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
  if (!dx) return;
  e.preventDefault();
  wheelAcc += dx;
  const now = performance.now();
  if (Math.abs(wheelAcc) > 60 && now - wheelT > 140) { go(Math.round(target) + Math.sign(wheelAcc)); wheelAcc = 0; wheelT = now; }
}
function key(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(Math.round(target) + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(Math.round(target) - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); open(); }
  else if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (focus.value) toggle(focus.value, props.beats); }
}

/**
 * Otevření detailu: deska dostane „ránu“ (roztočí se a nafoukne), vyletí komiksové čárky,
 * pak ji převezme hlavní jeviště a s kreslenou stopou doletí na stránku beatu.
 */
function open() {
  const f = focus.value;
  if (!f || leaving) return;
  const b = wrap.value!.getBoundingClientRect();
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2, size = layout(0).size;
  punch = 1;
  fxBurst(cx, cy, 'launch', size * 0.5);
  window.setTimeout(() => {
    leaving = true;
    startFlight();
    stage.launch = { cx, cy, size: size * 1.08, beat: f };
    void router.push(`/beat/${f.slug}`);
  }, 170);
}

watch(() => props.beats.map((b) => b.id).join(), () => { target = 0; pos = Math.min(pos, 1.2); });
watch(() => player.current?.id, (id) => {
  const i = props.beats.findIndex((b) => b.id === id);
  if (i > -1 && i !== Math.round(target)) go(i);
});

onMounted(() => {
  try {
    renderer = new GrooveRenderer(canvas.value!);
  } catch {
    return;
  }
  io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { rootMargin: '200px' });
  io.observe(wrap.value!);
  wrap.value!.addEventListener('wheel', wheel, { passive: false });
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => { cancelAnimationFrame(raf); io?.disconnect(); });
</script>

<template>
  <div class="crate" :style="{ '--c': color }">
    <div
      ref="wrap" class="view" :class="grabbing" tabindex="0" role="listbox" :aria-label="t.deck.title" :aria-activedescendant="focus ? `crate-${focus.id}` : undefined"
      data-cursor="open"
      @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="cancel" @pointerleave="hovering = false" @keydown="key"
    >
      <canvas ref="canvas" aria-hidden="true" />
      <ul class="sr">
        <li v-for="(b, i) in beats" :id="`crate-${b.id}`" :key="b.id" role="option" :aria-selected="i === index">{{ b.title }}, {{ b.bpm }} BPM, {{ b.key }}, {{ b.genre }}</li>
      </ul>
      <button class="nav prev" :disabled="index === 0" aria-label="Previous" @pointerdown.stop @click.stop="go(index - 1)"><span>←</span></button>
      <button class="nav next" :disabled="index >= beats.length - 1" aria-label="Next" @pointerdown.stop @click.stop="go(index + 1)"><span>→</span></button>
    </div>

    <!-- hřbety desek: rychlé listování -->
    <div class="spines" role="tablist" :aria-label="t.crate.keys">
      <button
        v-for="(b, i) in beats" :key="b.id" role="tab" :aria-selected="i === index" :aria-label="b.title" :title="b.title"
        :class="{ on: i === index }" :style="{ '--s': colors[i] }" @click="go(i)"
      />
    </div>

    <div v-if="focus" v-tilt="5" class="info glass">
      <div class="text">
        <p class="head mono">
          <span class="count"><b>{{ String(index + 1).padStart(2, '0') }}</b> / {{ String(beats.length).padStart(2, '0') }}</span>
          <span class="chip2"><b>{{ focus.bpm }}</b> BPM</span>
          <span class="chip2"><i aria-hidden="true" />{{ keyLabel(focus.key, lang) }}</span>
          <span class="chip2">{{ focus.genre }}</span>
          <span class="chip2 dur">{{ formatTime(focus.duration) }}</span>
        </p>
        <Transition name="swap" mode="out-in">
          <h3 :key="focus.id" class="display">{{ focus.title }}</h3>
        </Transition>
        <div class="wave"><MiniWave :key="focus.id" :beat="focus" :bar="2" :gap="2" /></div>
      </div>
      <div class="act">
        <button class="pp tex-rubber" :class="{ on: isPlaying }" :aria-label="isPlaying ? t.row.pause : t.row.play" @click="toggle(focus, beats)">
          <svg v-if="isPlaying" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg>
          <span>{{ isPlaying ? t.row.pause : t.row.play }}</span>
        </button>
        <button v-magnet="0.15" class="btn buy" data-cursor="open" @click="open">
          <span class="lbl">{{ t.crate.open }}</span>
          <span class="price"><span class="mono from">{{ t.row.from }}</span> {{ formatMoney(focus.prices.wav, currency, lang) }}</span>
          <span class="arr">→</span>
        </button>
      </div>
    </div>
    <p class="hint mono dim"><span>✥ {{ t.crate.tilt }}</span><span>● {{ t.crate.tap }}</span><span>↔ {{ t.crate.drag }}</span></p>
  </div>
</template>

<style scoped>
.crate { position: relative; margin-inline: calc(var(--pad) * -1); }
.view { position: relative; height: clamp(320px, 64vh, 640px); cursor: grab; touch-action: pan-y; outline: none; -webkit-user-select: none; user-select: none; }
.view.tilt, .view.browse { cursor: grabbing; }
.view:focus-visible { box-shadow: inset 0 0 0 2px var(--c); }
.view > canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.nav { position: absolute; top: 50%; width: 54px; height: 54px; margin-top: -27px; border-radius: 50%; background: color-mix(in srgb, var(--glass-hi) 50%, transparent); backdrop-filter: blur(12px); box-shadow: inset 0 0 0 1px var(--line), inset 0 1px 0 rgb(255 255 255 / 0.4); font-size: 20px; transition: transform 0.3s var(--ease), opacity 0.3s, background-color 0.3s; z-index: 2; }
.nav span { display: block; transition: transform 0.25s steps(3); }
.nav:hover { background: var(--c); color: #0e0e0c; transform: scale(1.1); }
.nav.prev:hover span { transform: translateX(-4px); }
.nav.next:hover span { transform: translateX(4px); }
.nav[disabled] { opacity: 0; pointer-events: none; }
.prev { left: var(--pad); }
.next { right: var(--pad); }

.spines { display: flex; justify-content: center; align-items: flex-end; gap: 5px; height: 34px; padding-inline: var(--pad); margin-top: -6px; }
.spines button { width: clamp(8px, 1.6vw, 16px); height: 16px; border-radius: 3px 3px 0 0; background: var(--s); opacity: 0.55; transition: height 0.2s steps(3), opacity 0.2s; }
.spines button:hover { height: 24px; opacity: 1; }
.spines button.on { height: 34px; opacity: 1; box-shadow: 0 -8px 18px -4px var(--s); }

.info { position: relative; z-index: 3; width: min(1040px, calc(100% - var(--pad) * 2)); margin: 0 auto; padding: 22px 26px; border-radius: 28px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 18px 32px; }
.text { min-width: 0; display: grid; gap: 10px; }
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: var(--ink-2); }
.count { margin-right: 6px; }
.count b { color: var(--ink); font-size: 14px; }
.chip2 { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); white-space: nowrap; }
.chip2 b { color: var(--ink); }
.chip2 i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
h3 { font-size: clamp(30px, 4.4vw, 64px); overflow-wrap: anywhere; padding-block: 0.04em; transition: font-variation-settings 0.5s var(--ease); width: fit-content; }
h3:hover { font-variation-settings: 'wdth' 82; }
.wave { height: 40px; min-width: 0; }
.act { display: grid; gap: 10px; min-width: 250px; }
.pp { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 52px; padding: 0 22px; border-radius: 999px; font-weight: 650; font-variation-settings: 'wdth' 108; box-shadow: 0 4px 0 rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.18); transition: transform 0.1s steps(2), box-shadow 0.1s steps(2), background-color 0.25s, color 0.25s; }
.pp:active { transform: translateY(3px); box-shadow: 0 1px 0 rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.18); }
.pp.on { background-color: var(--c); color: #0e0e0c; }
.pp svg { width: 18px; height: 18px; fill: currentColor; }
.buy { height: 60px; padding: 0 22px; background: var(--c); color: #0e0e0c; justify-content: space-between; gap: 14px; }
.buy:hover { background: var(--ink); color: var(--paper); }
.buy .lbl { font-size: 16px; }
.buy .price { margin-left: auto; font-size: 13px; opacity: 0.8; }
.from { font-size: 9.5px; }
.hint { display: flex; justify-content: center; gap: 22px; margin-top: 16px; flex-wrap: wrap; }
/* výměna názvu po krocích – „filmové okénko“ */
.swap-enter-active, .swap-leave-active { transition: transform 0.22s steps(4), opacity 0.22s steps(4); }
.swap-enter-from { transform: translateY(60%) skewX(-14deg); opacity: 0; }
.swap-leave-to { transform: translateY(-60%) skewX(14deg); opacity: 0; }
@media (max-width: 760px) {
  /* na telefonu jde všechno pod sebe: údaje, název, vlna a až pod nimi tlačítka */
  .info { grid-template-columns: 1fr; padding: 18px; gap: 16px; border-radius: 24px; }
  .act { grid-template-columns: auto minmax(0, 1fr); min-width: 0; }
  .buy { min-width: 0; padding: 0 16px; gap: 8px; }
  .buy .lbl { font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .buy .price { white-space: nowrap; }
  .pp span { display: none; }
  .pp { width: 60px; height: 60px; padding: 0; }
  .dur { display: none; }
  .nav { width: 42px; height: 42px; margin-top: -21px; }
  .prev { left: 8px; }
  .next { right: 8px; }
  .hint span:last-child { display: none; }
}
</style>
