<script setup lang="ts">
import { computed } from 'vue';
import { beatPalette, formatMoney, formatTime, keyLabel } from '../../shared/music';
import type { Beat } from '../../shared/types';
import { lang, t } from '../lib/i18n';
import { player, toggle } from '../lib/player';
import { currency, filtered } from '../lib/store';
import BeatCover from './BeatCover.vue';
import MiniWave from './MiniWave.vue';

const props = defineProps<{ beat: Beat; index: number }>();
const active = computed(() => player.current?.id === props.beat.id);
const playing = computed(() => active.value && player.playing);
const color = computed(() => beatPalette(props.beat.key, props.beat.seed).css);
</script>

<template>
  <li class="row" :class="{ active, playing }" :style="{ '--c': color }" :data-cursor="playing ? 'pause' : 'play'" @click="toggle(beat, filtered)">
    <span class="idx mono">{{ String(index + 1).padStart(2, '0') }}</span>
    <button class="cover" :aria-label="`${playing ? t.row.pause : t.row.play}: ${beat.title}`" @click.stop="toggle(beat, filtered)">
      <BeatCover :beat="beat" />
      <span class="pp" aria-hidden="true">
        <svg v-if="playing" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M8 5v14l12-7z" /></svg>
      </span>
    </button>
    <div class="title">
      <RouterLink :to="`/beat/${beat.slug}`" class="name" @click.stop>{{ beat.title }}</RouterLink>
      <span class="mono dim">{{ beat.genre }}</span>
    </div>
    <div class="wave"><MiniWave :beat="beat" /></div>
    <span class="num mono"><b>{{ beat.bpm }}</b> BPM</span>
    <span class="num mono key"><i aria-hidden="true" />{{ keyLabel(beat.key, lang) }}</span>
    <span class="num mono dim dur">{{ formatTime(beat.duration) }}</span>
    <RouterLink :to="`/beat/${beat.slug}`" class="buy" data-cursor="open" @click.stop>
      <span class="mono dim">{{ t.row.from }}</span>
      <strong>{{ formatMoney(beat.prices.wav, currency, lang) }}</strong>
      <span class="go" aria-hidden="true">→</span>
    </RouterLink>
  </li>
</template>

<style scoped>
.row {
  position: relative; display: grid; align-items: center; gap: 0 20px; padding: 12px 14px; cursor: pointer;
  grid-template-columns: 26px 56px minmax(140px, 1.3fr) minmax(120px, 2fr) 76px 92px 44px minmax(150px, auto);
  border-bottom: 1px solid var(--line); transition: background-color 0.25s, border-color 0.7s;
}
.row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); transform: scaleY(0); transition: transform 0.4s var(--ease); }
.row:hover { background: var(--line-2); }
.row.active { background: color-mix(in srgb, var(--c) 9%, transparent); }
.row.active::before { transform: scaleY(1); }
.idx { color: var(--ink-3); }
.cover { position: relative; width: 56px; height: 56px; border-radius: 50%; transition: transform 0.5s var(--ease); }
.row:hover .cover { transform: rotate(40deg) scale(1.06); }
.row.playing .cover { animation: turn 1.8s linear infinite; }
@keyframes turn { to { transform: rotate(360deg); } }
.pp { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; transition: opacity 0.2s; }
.pp svg { width: 16px; height: 16px; fill: #0e0e0c; background: #f1eee6; border-radius: 50%; padding: 5px; box-sizing: content-box; }
.cover:focus-visible .pp { opacity: 1; }
.title { display: grid; gap: 3px; min-width: 0; }
.name { font-size: clamp(17px, 1.5vw, 22px); font-weight: 700; font-variation-settings: 'wdth' 114; letter-spacing: -0.015em; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color 0.3s; }
.row.active .name { color: var(--c); }
:root:not([data-live='1']) .row.active .name { color: color-mix(in srgb, var(--c) 62%, #000); }
.wave { height: 38px; min-width: 0; }
.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.num b { font-size: 14px; font-weight: 600; }
.key { display: inline-flex; align-items: center; gap: 7px; }
.key i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); flex: none; }
.buy { display: inline-flex; align-items: center; justify-content: flex-end; gap: 9px; height: 40px; padding: 0 6px 0 14px; border-radius: 999px; white-space: nowrap; transition: background-color 0.25s, color 0.25s, box-shadow 0.25s; box-shadow: inset 0 0 0 1px var(--line); justify-self: end; }
.buy strong { font-weight: 700; font-variation-settings: 'wdth' 110; }
.go { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--ink); color: var(--paper); transition: transform 0.35s var(--ease), background-color 0.25s, color 0.25s; }
.buy:hover { background: var(--ink); color: var(--paper); box-shadow: none; }
.buy:hover .dim { color: inherit; opacity: 0.6; }
.buy:hover .go { background: var(--c); color: #0e0e0c; transform: rotate(-45deg); }
@media (max-width: 1080px) {
  .row { grid-template-columns: 56px minmax(0, 1.4fr) minmax(80px, 1fr) 70px auto; }
  .idx, .dur, .key { display: none; }
}
@media (max-width: 640px) {
  .row { grid-template-columns: 48px minmax(0, 1fr) auto; gap: 0 12px; padding: 10px 6px; }
  .cover { width: 48px; height: 48px; }
  .wave, .num { display: none; }
  .buy .dim { display: none; }
  .buy { padding-left: 12px; }
}
</style>
