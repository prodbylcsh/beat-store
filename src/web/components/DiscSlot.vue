<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { Beat } from '../../shared/types';
import { t } from '../lib/i18n';
import { player, seekBy, toggle } from '../lib/player';
import { registerSlot, stage, stageBeat } from '../lib/stage';
import { beats } from '../lib/store';
import BeatCover from './BeatCover.vue';

const props = withDefaults(defineProps<{ priority: number; tilt?: number; beat?: Beat | null; interactive?: boolean }>(), {
  tilt: 0, beat: null, interactive: true,
});
const el = ref<HTMLElement | null>(null);
let off: (() => void) | null = null;

const target = computed(() => props.beat ?? player.current ?? beats.value[0] ?? null);
const isPlaying = computed(() => player.playing && player.current?.id === target.value?.id);

onMounted(() => {
  off = registerSlot({ el: el.value!, priority: props.priority, tilt: props.tilt, beat: () => props.beat ?? null, visible: false });
});
onUnmounted(() => off?.());

// --- scratch: tažením se deska pootáčí a skladba přetáčí ---
let lastAngle = 0, moved = 0, active = false;
const SEC_PER_TURN = 14;
function angle(e: PointerEvent): number {
  const b = el.value!.getBoundingClientRect();
  return Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2));
}
function down(e: PointerEvent) {
  if (!props.interactive || e.button !== 0) return;
  active = true; moved = 0; lastAngle = angle(e);
  el.value!.setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (!active) return;
  const a = angle(e);
  let d = a - lastAngle;
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  lastAngle = a;
  moved += Math.abs(d);
  if (moved > 0.06) {
    stage.dragging = true;
    stage.spinOffset += d;
    if (player.current?.id === target.value?.id) seekBy((d / (2 * Math.PI)) * SEC_PER_TURN);
  }
}
function up() {
  if (!active) return;
  active = false;
  const wasDrag = stage.dragging;
  stage.dragging = false;
  if (!wasDrag && target.value) toggle(target.value, beats.value);
}
function key(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (target.value) toggle(target.value, beats.value); }
}
</script>

<template>
  <div
    ref="el" class="slot" :class="{ interactive, grabbing: stage.dragging }"
    :role="interactive ? 'button' : undefined" :tabindex="interactive ? 0 : undefined"
    :aria-label="interactive && target ? `${isPlaying ? t.row.pause : t.row.play}: ${target.title}` : undefined"
    :data-cursor="interactive ? (isPlaying ? 'pause' : 'play') : undefined"
    @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="key"
  >
    <!-- náhradní obal, když WebGL není k dispozici -->
    <BeatCover v-if="!stage.available && (stageBeat ?? target)" :beat="(stageBeat ?? target)!" class="fallback" />
    <slot />
  </div>
</template>

<style scoped>
.slot { position: relative; aspect-ratio: 1; border-radius: 50%; touch-action: none; -webkit-user-select: none; user-select: none; }
.slot.interactive { cursor: grab; }
.slot.grabbing { cursor: grabbing; }
.fallback { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
