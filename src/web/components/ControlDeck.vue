<script setup lang="ts">
import { ref } from 'vue';
import { NOTE_NAMES, keyHue } from '../../shared/music';
import { t } from '../lib/i18n';
import { vTilt } from '../lib/tilt';
import { blip } from '../lib/player';
import { bpmRange, filtered, filters, genres, hasFilters, resetFilters } from '../lib/store';

/* TAP TEMPO: vyťukáš tempo a katalog se podle něj vyfiltruje */
const taps: number[] = [];
const hit = ref(false);
function tap() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2200) taps.length = 0;
  taps.push(now);
  if (taps.length > 6) taps.shift();
  hit.value = false;
  requestAnimationFrame(() => (hit.value = true));
  if (taps.length >= 3) {
    const gaps = taps.slice(1).map((v, i) => v - taps[i]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    filters.bpm = Math.min(220, Math.max(50, Math.round(60000 / avg)));
  }
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK: (number | null)[] = [1, 3, null, 6, 8, 10];
function pressKey(pc: number) {
  filters.pc = filters.pc === pc ? null : pc;
  blip(pc, filters.mode === 'minor');
}
const hue = (pc: number) => `oklch(0.72 0.17 ${keyHue(NOTE_NAMES[pc] + (filters.mode === 'minor' ? 'm' : ''))})`;
function toggleGenre(g: string) {
  const i = filters.genres.indexOf(g);
  if (i > -1) filters.genres.splice(i, 1);
  else filters.genres.push(g);
}
</script>

<template>
  <div v-tilt="3" class="deck glass">
    <section class="mod tempo">
      <header class="mono"><span>A</span>{{ t.deck.tempo }}</header>
      <div class="tempo-row">
        <button class="pad tex-rubber" :class="{ hit }" :aria-label="t.deck.tapHint" @pointerdown.prevent="tap" @keydown.enter.prevent="tap" @keydown.space.prevent="tap">
          <span class="mono">{{ t.deck.tap }}</span>
        </button>
        <div class="read">
          <output class="digits">{{ filters.bpm ?? '———' }}</output>
          <span class="mono dim">{{ filters.bpm ? `± ${filters.tolerance} BPM` : t.deck.tapHint }}</span>
        </div>
        <button v-if="filters.bpm !== null" class="x mono" :aria-label="t.deck.reset" @click="filters.bpm = null">×</button>
      </div>
      <input
        type="range" class="fader" :min="Math.min(60, bpmRange.min)" :max="Math.max(180, bpmRange.max)" step="1"
        :value="filters.bpm ?? 120" :aria-label="t.deck.tempo" :class="{ off: filters.bpm === null }"
        @input="filters.bpm = Number(($event.target as HTMLInputElement).value)"
      />
    </section>

    <section class="mod keys">
      <header class="mono"><span>B</span>{{ t.deck.key }}
        <span class="seg" role="group">
          <button v-for="m in (['any', 'minor', 'major'] as const)" :key="m" class="mono" :aria-pressed="filters.mode === m" @click="filters.mode = m">
            {{ m === 'any' ? t.deck.all : m === 'minor' ? t.deck.minor : t.deck.major }}
          </button>
        </span>
      </header>
      <div class="piano" role="group" :aria-label="t.deck.keyHint">
        <button
          v-for="pc in WHITE" :key="pc" class="w" :class="{ on: filters.pc === pc }" :aria-pressed="filters.pc === pc"
          :aria-label="NOTE_NAMES[pc]" :style="{ '--h': hue(pc) }" @click="pressKey(pc)"
        ><span class="mono">{{ NOTE_NAMES[pc] }}</span></button>
        <template v-for="(pc, i) in BLACK" :key="`b${i}`">
          <button
            v-if="pc !== null" class="b" :class="{ on: filters.pc === pc }" :aria-pressed="filters.pc === pc"
            :aria-label="NOTE_NAMES[pc]" :style="{ '--h': hue(pc), left: `${((i + 1) / 7) * 100}%` }" @click="pressKey(pc)"
          />
        </template>
      </div>
    </section>

    <section class="mod genre">
      <header class="mono"><span>C</span>{{ t.deck.genre }}</header>
      <div class="chips">
        <button v-for="g in genres" :key="g" class="chip" :aria-pressed="filters.genres.includes(g)" @click="toggleGenre(g)">{{ g }}</button>
      </div>
    </section>

    <section class="mod find">
      <header class="mono"><span>D</span>{{ t.deck.search }}</header>
      <input v-model="filters.q" class="input" type="search" :placeholder="t.deck.searchPh" :aria-label="t.deck.search" />
      <div class="find-row">
        <label class="sort mono">{{ t.deck.sort }}
          <select v-model="filters.sort">
            <option value="new">{{ t.deck.sortNew }}</option><option value="bpm">{{ t.deck.sortBpm }}</option>
            <option value="price">{{ t.deck.sortPrice }}</option><option value="title">{{ t.deck.sortTitle }}</option>
          </select>
        </label>
        <span class="mono count">{{ t.deck.count(filtered.length) }}</span>
        <button v-if="hasFilters" class="mono reset" @click="resetFilters">{{ t.deck.reset }} ×</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.deck { display: grid; grid-template-columns: 1.05fr 1.25fr 1.2fr 1fr; border-radius: 24px; }
.mod { padding: 18px 20px 20px; display: grid; gap: 14px; align-content: start; min-width: 0; }
.mod + .mod { border-left: 1px solid var(--line); }
header { display: flex; align-items: center; gap: 10px; color: var(--ink-2); min-height: 24px; }
header > span:first-child { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; background: var(--ink); color: var(--paper); font-size: 10px; }

.tempo-row { display: flex; align-items: center; gap: 14px; }
.pad {
  width: 74px; height: 74px; flex: none; border-radius: 14px; position: relative;
  box-shadow: 0 5px 0 color-mix(in srgb, var(--ink) 55%, var(--paper)); transition: transform 0.08s, box-shadow 0.08s; touch-action: manipulation;
}
.pad:active { transform: translateY(4px); box-shadow: 0 1px 0 color-mix(in srgb, var(--ink) 55%, var(--paper)); }
.pad::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--k); opacity: 0; }
.pad.hit::after { animation: flash 0.35s ease-out; }
.pad span { position: relative; z-index: 1; font-size: 12px; }
@keyframes flash { from { opacity: 0.95; } to { opacity: 0; } }
.read { display: grid; min-width: 0; }
.digits { font-family: var(--mono); font-size: 40px; font-weight: 600; line-height: 1; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.read .mono { font-size: 10px; margin-top: 6px; }
.x { margin-left: auto; width: 28px; height: 28px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line); font-size: 15px; }
.fader { -webkit-appearance: none; appearance: none; width: 100%; height: 22px; background: transparent; cursor: pointer; }
.fader::-webkit-slider-runnable-track { height: 2px; background: var(--line); }
.fader::-moz-range-track { height: 2px; background: var(--line); }
.fader::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 24px; margin-top: -11px; border-radius: 3px; background: linear-gradient(180deg, #d9d6cf, #8f8c85 48%, #c9c6be 52%, #77746e); box-shadow: 0 2px 4px rgb(0 0 0 / 0.4), inset 0 0 0 1px rgb(0 0 0 / 0.35); }
.fader::-moz-range-thumb { width: 12px; height: 22px; border: 0; border-radius: 3px; background: var(--ink); }
.fader.off::-webkit-slider-thumb { background: var(--ink-3); }
.fader.off::-moz-range-thumb { background: var(--ink-3); }

.seg { margin-left: auto; display: inline-flex; padding: 2px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.seg button { padding: 3px 9px; border-radius: 999px; font-size: 10px; color: var(--ink-2); }
.seg button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
.piano { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; height: 104px; }
.w { position: relative; border-radius: 4px 4px 8px 8px; background: linear-gradient(180deg, color-mix(in srgb, var(--glass-hi) 70%, transparent), color-mix(in srgb, var(--glass-hi) 95%, transparent)); box-shadow: inset 0 0 0 1px var(--line), inset 0 -6px 8px -6px rgb(0 0 0 / 0.25); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8px; transition: background-color 0.15s, transform 0.1s steps(2), color 0.15s; transform-origin: top; }
.w::before { content: ''; position: absolute; left: 22%; right: 22%; top: 8px; height: 3px; border-radius: 3px; background: var(--h); opacity: 0.85; }
.w span { font-size: 10px; color: var(--ink-2); }
.w:hover { background: color-mix(in srgb, var(--h) 22%, var(--paper)); }
.w:active { transform: perspective(300px) rotateX(-9deg); }
.w.on { background: var(--h); }
.w.on span { color: #0e0e0c; }
.w.on::before { background: #0e0e0c; }
.b { position: absolute; top: 0; width: 9.5%; height: 60%; transform: translateX(-50%); border-radius: 0 0 5px 5px; background: var(--ink); z-index: 2; transition: background-color 0.15s, height 0.1s; }
.b::after { content: ''; position: absolute; left: 25%; right: 25%; bottom: 7px; height: 3px; border-radius: 3px; background: var(--h); }
.b:hover { background: color-mix(in srgb, var(--h) 55%, var(--ink)); }
.b:active { height: 58%; }
.b.on { background: var(--h); }
.b.on::after { background: #0e0e0c; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.find-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sort { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); }
.sort select { background: transparent; border: 0; font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); padding: 4px 0; cursor: pointer; }
.sort select option { color: #000; }
.count { margin-left: auto; }
.reset { color: var(--k); width: 100%; text-align: left; }
@media (max-width: 1100px) {
  .deck { grid-template-columns: 1fr 1fr; }
  .mod:nth-child(3) { border-left: 0; }
  .mod:nth-child(n + 3) { border-top: 1px solid var(--line); }
}
@media (max-width: 640px) {
  .deck { grid-template-columns: 1fr; }
  .mod + .mod { border-left: 0; border-top: 1px solid var(--line); }
}
</style>
