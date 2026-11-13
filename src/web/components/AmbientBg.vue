<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/** Barevné mlhoviny za obsahem – dávají sklu co lámat. Barví se tóninou a uhýbají kurzoru. */
const el = ref<HTMLElement | null>(null);
let raf = 0, tx = 0, ty = 0, x = 0, y = 0;
const move = (e: PointerEvent) => { tx = e.clientX / window.innerWidth - 0.5; ty = e.clientY / window.innerHeight - 0.5; };
function loop() {
  raf = requestAnimationFrame(loop);
  if (Math.abs(tx - x) + Math.abs(ty - y) < 0.0005) return;
  x += (tx - x) * 0.05; y += (ty - y) * 0.05;
  el.value?.style.setProperty('--ax', x.toFixed(4));
  el.value?.style.setProperty('--ay', y.toFixed(4));
}
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.addEventListener('pointermove', move, { passive: true });
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); });
</script>

<template>
  <div ref="el" class="ambient" aria-hidden="true"><i class="a" /><i class="b" /><i class="c" /></div>
</template>

<style scoped>
.ambient { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; --ax: 0; --ay: 0; }
i { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.3; transition: background-color 1.2s, opacity 0.8s; will-change: transform; }
.a { width: 52vmax; height: 52vmax; left: -14vmax; top: 18vh; background: var(--k); transform: translate(calc(var(--ax) * -90px), calc(var(--ay) * -70px)); animation: drift 26s ease-in-out infinite alternate; }
.b { width: 44vmax; height: 44vmax; right: -12vmax; top: -16vmax; background: var(--k2, var(--k-soft)); transform: translate(calc(var(--ax) * 130px), calc(var(--ay) * 90px)); animation: drift 34s ease-in-out infinite alternate-reverse; }
.c { width: 36vmax; height: 36vmax; right: 18vw; bottom: -20vmax; background: var(--k-soft); transform: translate(calc(var(--ax) * -60px), calc(var(--ay) * 120px)); animation: drift 30s ease-in-out infinite alternate; }
@keyframes drift { from { margin: 0 0 0 0; scale: 1; } to { margin: 9vh 0 0 7vw; scale: 1.18; } }
:root[data-live='1'] i { opacity: 0.26; }
:root[data-live='1'] .c { background: var(--k); }
</style>
