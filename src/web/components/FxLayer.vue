<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { meter, player } from '../lib/player';
import { discRect } from '../lib/stage';

/**
 * Kreslené efekty na 12 fps: „pop“ čárky při kliknutí a rázové čárky kolem desky na každý kopák.
 * Schválně trhané – vedle plynulých 60fps animací to dělá komiksový dojem.
 */
const canvas = ref<HTMLCanvasElement | null>(null);
interface Burst { x: number; y: number; f: number; kind: 'pop' | 'hit'; seed: number; r: number }
const bursts: Burst[] = [];
let timer = 0, lastBass = 0, cool = 0;
const FRAMES = 6;

const rnd = (s: number) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

function down(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  bursts.push({ x: e.clientX, y: e.clientY, f: 0, kind: 'pop', seed: Math.random() * 1000, r: 14 });
}

function draw() {
  const c = canvas.value;
  if (!c) return;
  // kopák: skok basů nahoru
  cool--;
  if (player.playing && meter.bass > 0.42 && meter.bass - lastBass > 0.09 && cool <= 0 && discRect.size > 120) {
    bursts.push({ x: discRect.cx, y: discRect.cy, f: 0, kind: 'hit', seed: Math.random() * 1000, r: discRect.size / 2 });
    cool = 3;
  }
  lastBass = meter.bass;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!bursts.length) return;
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--ink').trim(), k = cs.getPropertyValue('--k').trim();
  ctx.lineCap = 'round';
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const p = b.f / FRAMES;
    if (b.kind === 'pop') {
      const n = 9;
      ctx.strokeStyle = b.f % 2 ? k : ink;
      ctx.lineWidth = 3 - p * 1.5;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + rnd(b.seed + j + b.f) * 0.5;
        const r0 = b.r + p * 26 + rnd(b.seed + j * 3) * 6, r1 = r0 + 12 + rnd(b.seed + j * 7 + b.f) * 14 * (1 - p);
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(a) * r0, b.y + Math.sin(a) * r0);
        ctx.lineTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1);
        ctx.stroke();
      }
    } else {
      // krátké obloučky po obvodu desky, pokaždé jinde
      ctx.strokeStyle = k;
      ctx.lineWidth = 4 - p * 2;
      for (let j = 0; j < 5; j++) {
        const a = rnd(b.seed + j) * Math.PI * 2;
        const rr = b.r * (1.08 + p * 0.16) + rnd(b.seed + j + b.f) * 6;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, rr, rr * 0.72, 0, a, a + 0.22 + rnd(b.seed + j * 5) * 0.2);
        ctx.stroke();
      }
    }
    if (++b.f > FRAMES) bursts.splice(i, 1);
  }
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('pointerdown', down, { passive: true });
  timer = window.setInterval(draw, 1000 / 12);
});
onUnmounted(() => { window.removeEventListener('pointerdown', down); clearInterval(timer); });
</script>

<template>
  <canvas ref="canvas" class="fx" aria-hidden="true" />
</template>

<style scoped>
.fx { position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh; z-index: 150; pointer-events: none; }
</style>
