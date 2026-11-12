<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { peaksFromBase64 } from '../../shared/peaks';
import type { Beat } from '../../shared/types';
import { play, player, seek } from '../lib/player';
import { beats } from '../lib/store';

const props = withDefaults(defineProps<{ beat: Beat; bar?: number; gap?: number; seekable?: boolean }>(), { bar: 2, gap: 2, seekable: true });
const canvas = ref<HTMLCanvasElement | null>(null);
const isCurrent = computed(() => player.current?.id === props.beat.id);
const progress = computed(() => (isCurrent.value ? player.time / (player.duration || props.beat.duration || 1) : 0));
const hover = ref(-1);
let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;

function draw() {
  const c = canvas.value;
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const peaks = peaksFromBase64(props.beat.peaks);
  const stepPx = props.bar + props.gap;
  const n = Math.floor(w / stepPx);
  const cs = getComputedStyle(c);
  const ink = cs.getPropertyValue('--ink').trim() || '#000';
  const k = cs.getPropertyValue('--k').trim() || '#f40';
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i / n) * peaks.length), b = Math.max(a + 1, Math.floor(((i + 1) / n) * peaks.length));
    let v = 0;
    for (let j = a; j < b; j++) v = Math.max(v, peaks[j]);
    const bh = Math.max(2, (v / 255) * h);
    const frac = i / n;
    const played = isCurrent.value && frac < progress.value;
    ctx.globalAlpha = played ? 1 : hover.value >= 0 && frac < hover.value ? 0.6 : 0.26;
    ctx.fillStyle = played ? k : ink;
    ctx.fillRect(i * stepPx, (h - bh) / 2, props.bar, bh);
  }
}

function fracOf(e: PointerEvent): number {
  const b = canvas.value!.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
}
async function click(e: PointerEvent) {
  if (!props.seekable) return;
  e.stopPropagation();
  const f = fracOf(e);
  if (!isCurrent.value) await play(props.beat, beats.value);
  seek(f);
}

onMounted(() => {
  draw();
  ro = new ResizeObserver(draw);
  ro.observe(canvas.value!);
  // překreslit při zhasnutí / rozsvícení a změně barvy tóniny
  mo = new MutationObserver(() => setTimeout(draw, 350));
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-live', 'style'] });
});
onUnmounted(() => { ro?.disconnect(); mo?.disconnect(); });
watch([progress, isCurrent, hover, () => props.beat.id], draw);
</script>

<template>
  <canvas
    ref="canvas" class="wave" :class="{ seekable }"
    @click.stop @pointerup="click" @pointermove="hover = seekable ? fracOf($event) : -1" @pointerleave="hover = -1"
  />
</template>

<style scoped>
.wave { width: 100%; height: 100%; }
.wave.seekable { cursor: pointer; }
</style>
