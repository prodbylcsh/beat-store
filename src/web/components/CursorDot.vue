<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

/** Vlastní kurzor: tečka, která se nad deskou a řádky změní v popisek akce. Jen pro myš. */
const el = ref<HTMLElement | null>(null);
const label = ref('');
const on = ref(false);
const fine = window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
const LABELS: Record<string, string> = { play: '▶', pause: '❚❚', open: '→' };

function move(e: PointerEvent) {
  tx = e.clientX; ty = e.clientY;
  if (!on.value) { x = tx; y = ty; on.value = true; }
  const hit = (e.target as HTMLElement | null)?.closest?.('[data-cursor]') as HTMLElement | null;
  label.value = hit ? LABELS[hit.dataset.cursor ?? ''] ?? '' : '';
}
function loop() {
  raf = requestAnimationFrame(loop);
  x += (tx - x) * 0.22; y += (ty - y) * 0.22;
  if (el.value) el.value.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}
onMounted(() => {
  if (!fine) return;
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', () => (on.value = false));
  raf = requestAnimationFrame(loop);
});
onUnmounted(() => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); });
</script>

<template>
  <div v-if="fine" ref="el" class="cursor" :class="{ on, big: !!label }" aria-hidden="true"><span>{{ label }}</span></div>
</template>

<style scoped>
.cursor { position: fixed; left: 0; top: 0; z-index: 300; pointer-events: none; opacity: 0; transition: opacity 0.3s; mix-blend-mode: difference; }
.cursor.big { mix-blend-mode: normal; }
.cursor.on { opacity: 1; }
.cursor span {
  position: absolute; left: 0; top: 0; width: 12px; height: 12px; margin: -6px; border-radius: 50%;
  background: #fff; display: grid; place-items: center; color: transparent; font-size: 15px;
  transition: width 0.35s var(--ease), height 0.35s var(--ease), margin 0.35s var(--ease), color 0.2s;
}
.cursor.big span { width: 76px; height: 76px; margin: -38px; color: #000; background: var(--k); }
</style>
