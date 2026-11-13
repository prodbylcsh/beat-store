<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { beatPalette, formatMoney, formatTime, keyLabel } from '../../shared/music';
import type { Beat } from '../../shared/types';
import { artVersion } from '../lib/disc-art';
import { GrooveRenderer, lookFor } from '../lib/groove';
import { lang, t } from '../lib/i18n';
import { meter, player, toggle } from '../lib/player';
import { stage } from '../lib/stage';
import { vTilt } from '../lib/tilt';
import { currency } from '../lib/store';
import MiniWave from './MiniWave.vue';

/**
 * Katalog jako bedna s deskami: vinyly stojí vedle sebe, prostřední je čelem.
 * Táhni / koluj / šipky = listování, klik na prostřední = play, klik na krajní = přesun.
 */
const props = defineProps<{ beats: Beat[] }>();
const router = useRouter();
const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const index = ref(0);
const focus = computed(() => props.beats[Math.min(index.value, props.beats.length - 1)] ?? null);
const color = computed(() => (focus.value ? beatPalette(focus.value.key, focus.value.seed).css : 'var(--k)'));
const isPlaying = computed(() => !!focus.value && player.playing && player.current?.id === focus.value.id);

let renderer: GrooveRenderer | null = null;
let raf = 0, visible = false, io: IntersectionObserver | null = null;
let pos = 0, target = 0, vel = 0, spin = 0, spinSpeed = 0.2, last = performance.now();
let hoverX = 0, hoverY = 0, hovering = false, hoverYaw = 0, hoverPitch = 0, lean = 0, lift = 0;
let W = 0, H = 0;
const failed = ref(false);

function layout(d: number) {
  const size = Math.min(H * 0.82, W * 0.62, 520);
  const gap = Math.max(120, Math.min(W * 0.17, size * 0.5));
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
  if (!drag.on) {
    // pružina k cílové desce
    vel += (target - pos) * 90 * dt;
    vel *= Math.exp(-dt * 13);
    pos += vel * dt;
  }
  const maxI = props.beats.length - 1;
  pos = Math.max(-0.35, Math.min(maxI + 0.35, pos));
  lean += (Math.max(-0.6, Math.min(0.6, vel * 0.09)) - lean) * (1 - Math.exp(-dt * 8));
  const idx = Math.max(0, Math.min(maxI, Math.round(pos)));
  if (idx !== index.value) index.value = idx;

  const b = wrap.value!.getBoundingClientRect();
  W = b.width; H = b.height;
  r.resize(W, H, Math.min(2, window.devicePixelRatio || 1));
  r.clear();

  hoverYaw += ((hovering ? hoverX * 0.5 : 0) - hoverYaw) * (1 - Math.exp(-dt * 7));
  hoverPitch += ((hovering ? hoverY * 0.3 : 0) - hoverPitch) * (1 - Math.exp(-dt * 7));
  lift += ((hovering ? 1 : 0) - lift) * (1 - Math.exp(-dt * 8));
  const cur = props.beats[idx];
  const playing = player.playing && player.current?.id === cur.id;
  spinSpeed += ((playing ? 3.49 : 0.12) - spinSpeed) * (1 - Math.exp(-dt * 3));
  spin += spinSpeed * dt;
  const live = document.documentElement.dataset.live === '1' ? 1 : 0;

  // vzdálené desky první, prostřední nakonec
  const order = props.beats.map((_, i) => i).filter((i) => Math.abs(i - pos) < 5.5).sort((a, c) => Math.abs(c - pos) - Math.abs(a - pos));
  for (const i of order) {
    const d = i - pos;
    const L = layout(d);
    const centre = i === idx ? 1 - Math.min(1, Math.abs(d) * 1.6) : 0;
    const beat = props.beats[i];
    const mine = player.current?.id === beat.id;
    r.drawBeat(lookFor(beat), {
      cx: L.x, cy: H * 0.5 - centre * lift * 8, size: L.size * L.scale * (1 + centre * lift * 0.04),
      pitch: -0.06 + centre * hoverPitch, yaw: L.yaw + centre * hoverYaw, roll: lean * 0.12,
      spin: -(mine || i === idx ? spin : (beat.seed % 628) / 100),
      progress: mine ? meter.progress : -1, level: mine && player.playing ? meter.bass : 0,
      alpha: Math.min(1, Math.max(0, 5.4 - Math.abs(d))), live, shadow: 2, time: now / 1000,
    });
  }
}

/* --- ovládání --- */
const drag = { on: false, x: 0, pos: 0, moved: 0, t: 0, lastX: 0 };
function go(i: number) { target = Math.max(0, Math.min(props.beats.length - 1, i)); }
function down(e: PointerEvent) {
  if (e.button !== 0) return;
  drag.on = true; drag.x = drag.lastX = e.clientX; drag.pos = pos; drag.moved = 0; drag.t = performance.now(); vel = 0;
  wrap.value!.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  const b = wrap.value!.getBoundingClientRect();
  const size = layout(0).size;
  hoverX = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (size / 2)));
  hoverY = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / (size / 2)));
  hovering = e.pointerType === 'mouse' && Math.abs(hoverX) < 1 && Math.abs(hoverY) < 1 && !drag.on;
  if (!drag.on) return;
  const dx = e.clientX - drag.x;
  drag.moved = Math.max(drag.moved, Math.abs(dx));
  const now = performance.now();
  const step = size * 0.62;
  pos = drag.pos - dx / step;
  vel = (-(e.clientX - drag.lastX) / step) / Math.max(0.008, (now - drag.t) / 1000);
  drag.lastX = e.clientX; drag.t = now;
}
function up(e: PointerEvent) {
  if (!drag.on) return;
  drag.on = false;
  if (drag.moved < 6) {
    // klik: na prostřední desku = přehrát, jinam = přejet tam
    const b = wrap.value!.getBoundingClientRect();
    const x = e.clientX - b.left;
    let best = index.value, bd = Infinity;
    for (let i = Math.max(0, index.value - 4); i <= Math.min(props.beats.length - 1, index.value + 4); i++) {
      const L = layout(i - pos);
      const dd = Math.abs(L.x - x) - (L.size * L.scale * (i === index.value ? 0.5 : 0.22));
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best === index.value && focus.value) toggle(focus.value, props.beats);
    else go(best);
    vel = 0;
  } else {
    go(Math.round(pos + Math.max(-2.2, Math.min(2.2, vel * 0.16))));
  }
}
let wheelAcc = 0, wheelT = 0;
function wheel(e: WheelEvent) {
  // jen vodorovné kolečko / trackpad nebo Shift – svislý scroll stránky nechávám být
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
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (focus.value) toggle(focus.value, props.beats); }
}

/** Otevření detailu: deska „vyletí“ z bedny a doletí na stránku beatu. */
function open() {
  const f = focus.value;
  if (!f) return;
  const b = wrap.value!.getBoundingClientRect();
  stage.launch = { cx: b.left + b.width / 2, cy: b.top + b.height / 2, size: layout(0).size, beat: f };
  void router.push(`/beat/${f.slug}`);
}

watch(() => props.beats.map((b) => b.id).join(), () => { target = 0; pos = Math.min(pos, 1.2); });
// přehrávání odjinud (J/K, automatický přechod) posune bednu na hrající desku
watch(() => player.current?.id, (id) => {
  const i = props.beats.findIndex((b) => b.id === id);
  if (i > -1 && i !== Math.round(target)) go(i);
});

onMounted(() => {
  try {
    renderer = new GrooveRenderer(canvas.value!);
  } catch {
    failed.value = true;
    return;
  }
  io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { rootMargin: '200px' });
  io.observe(wrap.value!);
  wrap.value!.addEventListener('wheel', wheel, { passive: false });
  raf = requestAnimationFrame(frame);
});
onUnmounted(() => { cancelAnimationFrame(raf); io?.disconnect(); });
defineExpose({ failed });
</script>

<template>
  <div class="crate" :style="{ '--c': color }">
    <div
      ref="wrap" class="view" tabindex="0" role="listbox" :aria-label="t.deck.title" :aria-activedescendant="focus ? `crate-${focus.id}` : undefined"
      :data-cursor="isPlaying ? 'pause' : 'play'"
      @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @pointerleave="hovering = false" @keydown="key"
    >
      <canvas ref="canvas" aria-hidden="true" />
      <ul class="sr">
        <li v-for="(b, i) in beats" :id="`crate-${b.id}`" :key="b.id" role="option" :aria-selected="i === index">{{ b.title }}, {{ b.bpm }} BPM, {{ b.key }}, {{ b.genre }}</li>
      </ul>
      <button class="nav prev" :disabled="index === 0" aria-label="Previous" @pointerdown.stop @click.stop="go(index - 1)"><span>←</span></button>
      <button class="nav next" :disabled="index >= beats.length - 1" aria-label="Next" @pointerdown.stop @click.stop="go(index + 1)"><span>→</span></button>
    </div>

    <div v-if="focus" v-tilt="5" class="info glass">
      <div class="count mono"><b>{{ String(index + 1).padStart(2, '0') }}</b><i /> {{ String(beats.length).padStart(2, '0') }}</div>
      <Transition name="swap" mode="out-in">
        <div :key="focus.id" class="main">
          <h3 class="display">{{ focus.title }}</h3>
          <ul class="meta mono">
            <li><b>{{ focus.bpm }}</b> BPM</li><li><i aria-hidden="true" />{{ keyLabel(focus.key, lang) }}</li><li>{{ focus.genre }}</li><li>{{ formatTime(focus.duration) }}</li>
          </ul>
        </div>
      </Transition>
      <div class="wave"><MiniWave :key="focus.id" :beat="focus" :bar="2" :gap="2" /></div>
      <div class="act">
        <button class="pp" :aria-label="isPlaying ? t.row.pause : t.row.play" @click="toggle(focus, beats)">
          <svg v-if="isPlaying" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg>
        </button>
        <button class="btn buy" data-cursor="open" @click="open">
          <span class="mono from">{{ t.row.from }}</span> {{ formatMoney(focus.prices.wav, currency, lang) }} <span class="arr">→</span>
        </button>
      </div>
    </div>
    <p class="hint mono dim"><span>↔ {{ t.crate.drag }}</span><span>● {{ t.hero.hintPlay }}</span><span>← → {{ t.crate.keys }}</span></p>
  </div>
</template>

<style scoped>
.crate { position: relative; margin-inline: calc(var(--pad) * -1); }
.view { position: relative; height: clamp(300px, 62vh, 620px); cursor: grab; touch-action: pan-y; outline: none; -webkit-user-select: none; user-select: none; }
.view:active { cursor: grabbing; }
.view:focus-visible { box-shadow: inset 0 0 0 2px var(--c); }
.view > canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.nav { position: absolute; top: 50%; width: 54px; height: 54px; margin-top: -27px; border-radius: 50%; background: color-mix(in srgb, var(--paper) 60%, transparent); backdrop-filter: blur(12px); box-shadow: inset 0 0 0 1px var(--line), inset 0 1px 0 rgb(255 255 255 / 0.4); font-size: 20px; transition: transform 0.3s var(--ease), opacity 0.3s, background-color 0.3s; z-index: 2; }
.nav span { display: block; transition: transform 0.25s steps(3); }
.nav:hover { background: var(--c); color: #0e0e0c; transform: scale(1.1); }
.nav.prev:hover span { transform: translateX(-4px); }
.nav.next:hover span { transform: translateX(4px); }
.nav[disabled] { opacity: 0; pointer-events: none; }
.prev { left: var(--pad); }
.next { right: var(--pad); }

.info { position: relative; z-index: 3; width: min(980px, calc(100% - var(--pad) * 2)); margin: -34px auto 0; padding: 18px 22px; border-radius: 26px; display: grid; grid-template-columns: auto minmax(0, 1.2fr) minmax(120px, 1fr) auto; align-items: center; gap: 22px; }
.count { display: flex; align-items: center; gap: 8px; color: var(--ink-2); }
.count b { color: var(--ink); font-size: 15px; }
.count i { width: 22px; height: 1px; background: currentColor; }
.main { min-width: 0; }
h3 { font-size: clamp(24px, 3vw, 44px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-block: 0.06em; }
.meta { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 6px; color: var(--ink-2); }
.meta b { color: var(--ink); }
.meta li { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.meta i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
.wave { height: 44px; min-width: 0; }
.act { display: flex; align-items: center; gap: 10px; }
.pp { width: 52px; height: 52px; border-radius: 50%; background: var(--ink); color: var(--paper); display: grid; place-items: center; transition: background-color 0.25s, transform 0.3s var(--ease), color 0.25s; flex: none; }
.pp:hover { background: var(--c); color: #0e0e0c; transform: scale(1.08) rotate(-8deg); }
.pp svg { width: 20px; height: 20px; fill: currentColor; }
.buy { background: var(--c); color: #0e0e0c; }
.buy:hover { background: var(--ink); color: var(--paper); }
.from { opacity: 0.6; font-size: 10px; }
.hint { display: flex; justify-content: center; gap: 22px; margin-top: 16px; flex-wrap: wrap; }
/* výměna textu po krocích – „filmové okénko“ */
.swap-enter-active, .swap-leave-active { transition: transform 0.22s steps(4), opacity 0.22s steps(4); }
.swap-enter-from { transform: translateY(60%) skewX(-14deg); opacity: 0; }
.swap-leave-to { transform: translateY(-60%) skewX(14deg); opacity: 0; }
@media (max-width: 860px) {
  .info { grid-template-columns: 1fr auto; gap: 12px 14px; margin-top: -18px; }
  .count, .wave { display: none; }
  h3 { white-space: normal; overflow-wrap: anywhere; font-size: clamp(22px, 7vw, 34px); }
  .nav { width: 42px; height: 42px; margin-top: -21px; }
  .hint span:last-child { display: none; }
}
@media (max-width: 480px) { .buy .from { display: none; } .buy { padding: 0 16px; } }
</style>
