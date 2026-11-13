<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { pointer, stage } from '../lib/stage';

/**
 * Přechod mezi stránkami: z místa kliknutí se po krocích (jako okénka filmu) rozjede
 * deska přes celou obrazovku, pod ní se vymění stránka a deska se středem zase otevře.
 */
const router = useRouter();
const phase = ref<'idle' | 'cover' | 'reveal'>('idle');
const origin = ref({ x: '50%', y: '50%' });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

onMounted(() => {
  router.beforeEach(async (to, from) => {
    // první načtení, změna jen kotvy a „let desky“ na detail se obejdou bez opony
    if (reduce || !from.matched.length || to.path === from.path || stage.launch) return;
    origin.value = pointer.x > -1 ? { x: `${pointer.x}px`, y: `${pointer.y}px` } : { x: '50%', y: '50%' };
    phase.value = 'cover';
    await wait(380);
  });
  router.afterEach(async () => {
    if (phase.value !== 'cover') return;
    await wait(60);
    phase.value = 'reveal';
    await wait(460);
    phase.value = 'idle';
  });
});
</script>

<template>
  <div v-if="phase !== 'idle'" class="curtain" :class="phase" :style="{ '--ox': origin.x, '--oy': origin.y }" aria-hidden="true"><i /></div>
</template>

<style scoped>
@property --hole { syntax: '<length>'; inherits: false; initial-value: 0px; }
.curtain {
  position: fixed; inset: 0; z-index: 140; pointer-events: all;
  background:
    repeating-radial-gradient(circle at var(--ox) var(--oy), transparent 0 9px, rgb(0 0 0 / 0.16) 9px 10px),
    radial-gradient(circle at var(--ox) var(--oy), #f1eee5 0 46px, #0e0e0c 46px 52px, var(--k) 52px);
}
.curtain i { position: absolute; left: var(--ox); top: var(--oy); width: 12px; height: 12px; margin: -6px; border-radius: 50%; background: #0e0e0c; }
.cover { animation: cover 0.38s steps(9, end) both; }
.reveal { -webkit-mask: radial-gradient(circle at 50% 50%, transparent var(--hole), #000 calc(var(--hole) + 1px)); mask: radial-gradient(circle at 50% 50%, transparent var(--hole), #000 calc(var(--hole) + 1px)); animation: hole 0.46s steps(10, end) both; }
@keyframes cover { from { clip-path: circle(0 at var(--ox) var(--oy)); } to { clip-path: circle(150vmax at var(--ox) var(--oy)); } }
@keyframes hole { from { --hole: 0px; } to { --hole: 120vmax; } }
</style>
