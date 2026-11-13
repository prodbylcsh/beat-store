<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { GrooveRenderer, lookFor } from '../lib/groove';
import { meter, player, tick } from '../lib/player';
import { activeSlot, discRect, pointer, stage, stageBeat } from '../lib/stage';
import { artVersion } from '../lib/disc-art';
import { beats } from '../lib/store';
import type { Beat } from '../../shared/types';

const canvas = ref<HTMLCanvasElement | null>(null);
let renderer: GrooveRenderer | null = null;
let raf = 0;

// plynulý stav desky
const cur = { cx: 0, cy: 0, size: 0, tilt: 0, alpha: 0, live: 0, init: false, yaw: 0, px: 0 };
let spin = 0;
let speed = 0.25;
let shown: Beat | null = null;   // beat ve slotu A
let incoming: Beat | null = null; // beat ve slotu B (prolínání)
let mix = 0;
let last = performance.now();
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  const r = renderer;
  if (!r) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tick();

  void artVersion.value;
  // deska může „vyletět“ z katalogu: převezmi její polohu a beat
  if (stage.launch) {
    const l = stage.launch; stage.launch = null;
    cur.cx = l.cx; cur.cy = l.cy; cur.size = l.size; cur.tilt = 0; cur.yaw = 0; cur.alpha = 1; cur.init = true;
    shown = l.beat; incoming = null; mix = 0; r.setLook(0, lookFor(l.beat)); r.setLook(1, lookFor(l.beat));
  }
  const slot = activeSlot();
  const want = slot ? slot.beat() ?? player.current ?? beats.value[0] ?? null : null;
  stage.activePriority = slot ? slot.priority : -1;
  if (stageBeat.value !== want) stageBeat.value = want;

  // prolnutí na jiný beat
  if (want && !shown) { shown = want; r.setLook(0, lookFor(want)); r.setLook(1, lookFor(want)); }
  else if (want && want.id !== shown?.id && want.id !== incoming?.id) {
    if (incoming) { shown = incoming; r.setLook(0, lookFor(shown)); }
    incoming = want; mix = 0; r.setLook(1, lookFor(want));
    speed += 9; // deska se při výměně roztočí
  }
  if (incoming) {
    mix = Math.min(1, mix + dt / 0.55);
    if (mix >= 1) { shown = incoming; incoming = null; mix = 0; r.setLook(0, lookFor(shown)); }
  }

  const w = window.innerWidth, h = window.innerHeight;
  r.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
  r.clear();

  const k = reduce ? 1 : 1 - Math.exp(-dt * 9);
  let targetAlpha = 0;
  if (slot && want) {
    const b = slot.el.getBoundingClientRect();
    const size = Math.min(b.width, b.height);
    const tx = b.left + b.width / 2, ty = b.top + b.height / 2;
    if (!cur.init) { cur.cx = tx; cur.cy = ty; cur.size = size; cur.tilt = slot.tilt; cur.init = true; }
    cur.cx += (tx - cur.cx) * k; cur.cy += (ty - cur.cy) * k;
    cur.size += (size - cur.size) * k; cur.tilt += (slot.tilt - cur.tilt) * k;
    targetAlpha = 1;
  }
  cur.alpha += (targetAlpha - cur.alpha) * (reduce ? 1 : 1 - Math.exp(-dt * 12));
  cur.live += ((player.playing ? 1 : 0) - cur.live) * (1 - Math.exp(-dt * 4));

  const display = incoming ?? shown;
  const isCurrent = !!display && display.id === player.current?.id;
  const targetSpeed = stage.dragging ? 0 : isCurrent && player.playing ? 3.49 : 0.22; // 33⅓ ot./min
  speed += (targetSpeed - speed) * (1 - Math.exp(-dt * 3.2));
  if (!reduce || isCurrent) spin += speed * dt;

  // deska se naklání za kurzorem (jen když je velká)
  const big = cur.size > 200 ? 1 : 0;
  const ty = big * Math.max(-1, Math.min(1, (pointer.x - cur.cx) / (w * 0.5))) * 0.38;
  const tp = big * Math.max(-1, Math.min(1, (pointer.y - cur.cy) / (h * 0.5))) * 0.22;
  cur.yaw += (ty - cur.yaw) * (1 - Math.exp(-dt * 5));
  cur.px += (tp - cur.px) * (1 - Math.exp(-dt * 5));
  if (cur.alpha < 0.004 || !display || cur.size < 4) return;
  if (cur.cx < -cur.size || cur.cx > w + cur.size || cur.cy < -cur.size || cur.cy > h + cur.size) return;
  discRect.cx = cur.cx; discRect.cy = cur.cy; discRect.size = isCurrent && player.playing ? cur.size : 0;
  // looky se nastavují každý snímek – po načtení písem se tím obnoví i textura etikety
  r.setLook(0, lookFor(shown ?? display));
  r.setLook(1, lookFor(incoming ?? shown ?? display));
  r.draw({
    cx: cur.cx, cy: cur.cy, size: cur.size, pitch: cur.tilt + cur.px, yaw: cur.yaw,
    spin: -(spin + stage.spinOffset),
    progress: isCurrent ? meter.progress : -1,
    level: isCurrent ? meter.bass : 0,
    alpha: cur.alpha, live: cur.live, flat: cur.size < 90, mix: incoming ? mix : 0, shadow: 1, time: now / 1000,
  });
}

onMounted(() => {
  try {
    renderer = new GrooveRenderer(canvas.value!);
    raf = requestAnimationFrame(frame);
  } catch {
    stage.available = false;
  }
});
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <canvas ref="canvas" class="stage" aria-hidden="true" />
</template>

<style scoped>
.stage { position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; z-index: 45; pointer-events: none; }
</style>
