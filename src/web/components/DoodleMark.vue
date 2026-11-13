<script setup lang="ts">
/** Ručně kreslené značky. Čára „vaří“ na 12 fps (filtr #boil) – záměrný kreslený kontrast k plynulým animacím. */
defineProps<{ kind: 'underline' | 'circle' | 'arrow' | 'star' | 'spark' | 'squiggle' }>();
const PATHS: Record<string, { vb: string; d: string[] }> = {
  underline: { vb: '0 0 300 30', d: ['M4 18 C 60 6, 120 26, 180 12 S 270 8, 296 16', 'M22 26 C 90 18, 190 28, 280 22'] },
  circle: { vb: '0 0 200 110', d: ['M100 8 C 40 4, 6 28, 8 58 C 10 92, 60 104, 108 102 C 160 100, 196 80, 192 50 C 188 20, 140 6, 84 12'] },
  arrow: { vb: '0 0 140 90', d: ['M6 12 C 40 4, 90 18, 118 66', 'M96 58 L 120 70 L 126 42'] },
  star: { vb: '0 0 80 80', d: ['M40 6 L48 30 L74 32 L53 47 L61 72 L40 57 L19 72 L27 47 L6 32 L32 30 Z'] },
  spark: { vb: '0 0 80 80', d: ['M40 4 L40 26', 'M40 54 L40 76', 'M4 40 L26 40', 'M54 40 L76 40', 'M15 15 L28 28', 'M52 52 L65 65', 'M65 15 L52 28', 'M28 52 L15 65'] },
  squiggle: { vb: '0 0 160 30', d: ['M4 16 q 10 -14 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0 t 20 0'] },
};
</script>

<template>
  <svg class="doodle boil" :viewBox="PATHS[kind].vb" fill="none" aria-hidden="true" preserveAspectRatio="none">
    <path v-for="(d, i) in PATHS[kind].d" :key="i" :d="d" pathLength="1" :style="{ animationDelay: `${i * 0.18}s` }" />
  </svg>
</template>

<style scoped>
.doodle { overflow: visible; pointer-events: none; }
path { stroke: currentColor; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 0.6s steps(7) 0.5s forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
</style>
