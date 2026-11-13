<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { beatPalette } from '../../shared/music';
import type { Beat } from '../../shared/types';
import { artVersion } from '../lib/disc-art';
import { paintCover } from '../lib/groove';

const props = defineProps<{ beat: Beat }>();
const canvas = ref<HTMLCanvasElement | null>(null);
const ok = ref(true);
const paint = () => { if (canvas.value) ok.value = paintCover(canvas.value, props.beat); };
onMounted(paint);
watch([() => props.beat.id, () => props.beat.key, () => props.beat.title, artVersion], paint);
</script>

<template>
  <span class="cover" :style="ok ? undefined : { background: `radial-gradient(circle, #eee 0 12%, ${beatPalette(beat.key, beat.seed).css} 13% 100%)` }">
    <canvas ref="canvas" aria-hidden="true" />
  </span>
</template>

<style scoped>
.cover { display: block; aspect-ratio: 1; border-radius: 50%; }
canvas { width: 100%; height: 100%; }
</style>
