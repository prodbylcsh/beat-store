<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { bursts, fly, fxBurst } from '../lib/fx';
import { meter, player } from '../lib/player';
import { discRect } from '../lib/stage';

/**
 * Kreslené efekty na 12 fps: „pop“ čárky při kliknutí a rázové čárky kolem desky na každý kopák.
 * Schválně trhané – vedle plynulých 60fps animací to dělá komiksový dojem.
 */
const canvas = ref<HTMLCanvasElement | null>(null);
const trail: { x: number; y: number; s: number }[] = [];
let timer = 0, lastBass = 0, cool = 0;
const FRAMES = 6;

const rnd = (s: number) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

function down(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  fxBurst(e.clientX, e.clientY, 'pop');
}

function draw() {
  const c = canvas.value;
  if (!c) return;
  // kopák: skok basů nahoru
  cool--;
  if (player.playing && discRect.live && meter.bass > 0.42 && meter.bass - lastBass > 0.09 && cool <= 0 && discRect.size > 120) {
    fxBurst(discRect.cx, discRect.cy, 'hit', discRect.size / 2);
    cool = 3;
  }
  lastBass = meter.bass;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const flying = performance.now() < fly.until;
  if (flying) { trail.push({ x: discRect.cx, y: discRect.cy, s: discRect.size }); if (trail.length > 5) trail.shift(); }
  else if (trail.length) trail.shift();
  if (!bursts.length && trail.length < 2) return;
  const cs = getComputedStyle(document.documentElement);
  const ink = cs.getPropertyValue('--ink').trim(), k = cs.getPropertyValue('--k').trim();
  ctx.lineCap = 'round';
  // stopa za letící deskou: přerušované obrysy dřívějších poloh + rychlostní čárky
  for (let i = 0; i < trail.length - 1; i++) {
    const g = trail[i], n = trail[trail.length - 1];
    const a = (i + 1) / trail.length;
    ctx.strokeStyle = i % 2 ? k : ink;
    ctx.globalAlpha = a * 0.8;
    ctx.lineWidth = 2 + a * 2;
    ctx.setLineDash([10 + i * 6, 14]);
    ctx.lineDashOffset = rnd(i + g.x) * 40;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.s / 2, (g.s / 2) * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const dx = g.x - n.x, dy = g.y - n.y, len = Math.hypot(dx, dy);
    if (len > 12) {
      for (let j = 0; j < 3; j++) {
        const o = (rnd(g.x + j * 7) - 0.5) * g.s * 0.7;
        const px = -dy / len * o, py = dx / len * o;
        ctx.beginPath();
        ctx.moveTo(g.x + px, g.y + py);
        ctx.lineTo(g.x + px + (dx / len) * (30 + rnd(j + g.y) * 50), g.y + py + (dy / len) * (30 + rnd(j + g.y) * 50));
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    const p = b.f / FRAMES;
    if (b.kind === 'pop' || b.kind === 'launch') {
      const n = b.kind === 'launch' ? 18 : 9;
      ctx.strokeStyle = b.f % 2 ? k : ink;
      ctx.lineWidth = (b.kind === 'launch' ? 6 : 3) * (1 - p * 0.5);
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + rnd(b.seed + j + b.f) * 0.5;
        const big = b.kind === 'launch' ? 3.2 : 1;
        const r0 = b.r + p * 26 * big + rnd(b.seed + j * 3) * 6 * big, r1 = r0 + (12 + rnd(b.seed + j * 7 + b.f) * 14 * (1 - p)) * big;
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
