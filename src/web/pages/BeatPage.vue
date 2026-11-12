<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LICENSE_NAMES, LICENSE_TERMS } from '../../shared/licenses';
import { beatPalette, formatMoney, formatTime, keyLabel } from '../../shared/music';
import type { Beat, LicenseId } from '../../shared/types';
import BeatRow from '../components/BeatRow.vue';
import CheckoutReceipt from '../components/CheckoutReceipt.vue';
import DiscSlot from '../components/DiscSlot.vue';
import LicenseCards from '../components/LicenseCards.vue';
import MiniWave from '../components/MiniWave.vue';
import { api } from '../lib/api';
import { lang, t } from '../lib/i18n';
import { player, toggle } from '../lib/player';
import { beats, currency, loadCatalog } from '../lib/store';

const props = defineProps<{ slug: string }>();
const beat = ref<Beat | null>(null);
const missing = ref(false);
const license = ref<LicenseId>('wav');
const paying = ref(false);
const copied = ref(false);

async function load() {
  missing.value = false;
  await loadCatalog();
  beat.value = beats.value.find((b) => b.slug === props.slug) ?? null;
  if (!beat.value) {
    try {
      beat.value = (await api<{ beat: Beat }>(`/api/beats/${encodeURIComponent(props.slug)}`)).beat;
    } catch {
      missing.value = true;
    }
  }
  if (beat.value) {
    license.value = beat.value.hasStems ? 'stems' : 'wav';
    document.title = `${beat.value.title} — ${beat.value.bpm} BPM ${beat.value.key} · LCSH`;
  }
}
watch(() => props.slug, load, { immediate: true });

const playing = computed(() => player.playing && player.current?.id === beat.value?.id);
const palette = computed(() => (beat.value ? beatPalette(beat.value.key, beat.value.seed) : null));
const disabled = computed<LicenseId[]>(() => (beat.value?.hasStems ? [] : ['stems', 'exclusive']));
const others = computed(() => beats.value.filter((b) => b.id !== beat.value?.id).slice(0, 4));
const sold = computed(() => beat.value?.status === 'sold');
const price = computed(() => (beat.value ? formatMoney(beat.value.prices[license.value], currency.value, lang.value) : ''));

async function share() {
  try {
    await navigator.clipboard.writeText(location.href);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  } catch { /* schránka nedostupná */ }
}
</script>

<template>
  <div v-if="beat" class="page wrap" :style="{ '--c': palette!.css }">
    <div class="art">
      <DiscSlot :priority="4" :tilt="0.42" :beat="beat" class="disc" />
      <p class="mono dim cap">{{ t.beat.artwork }}</p>
    </div>

    <div class="info">
      <RouterLink :to="{ path: '/', hash: '#beats' }" class="mono back">← {{ t.beat.back }}</RouterLink>
      <h1 class="display title">{{ beat.title }}</h1>
      <ul class="meta mono">
        <li><b>{{ beat.bpm }}</b> BPM</li>
        <li><i aria-hidden="true" />{{ keyLabel(beat.key, lang) }}</li>
        <li>{{ beat.genre }}</li>
        <li>{{ formatTime(beat.duration) }}</li>
        <li><button class="mono" @click="share">{{ copied ? t.beat.copied : t.beat.share }} ⧉</button></li>
      </ul>

      <div class="listen">
        <button class="pp" :aria-label="playing ? t.row.pause : t.row.play" @click="toggle(beat, beats)">
          <svg v-if="playing" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg>
        </button>
        <div class="wave"><MiniWave :beat="beat" :bar="3" :gap="2" /></div>
      </div>

      <template v-if="!sold">
        <h2 class="mono eyebrow choose">{{ t.beat.choose }}</h2>
        <LicenseCards v-model="license" :prices="beat.prices" :disabled="disabled" compact />
        <p v-if="!beat.hasStems" class="mono dim note">{{ t.beat.noStems }}</p>
        <div class="buy">
          <button class="btn buy-btn" @click="paying = true">
            {{ t.beat.buy }} — {{ price }}<small v-if="LICENSE_TERMS[license].subscription">&nbsp;{{ t.beat.perYear }}</small> <span class="arr">→</span>
          </button>
          <RouterLink :to="{ path: '/licence', hash: `#${license}` }" class="mono link">{{ t.beat.fullText }}: {{ LICENSE_NAMES[license] }} ↗</RouterLink>
        </div>
      </template>
      <p v-else class="sold display">{{ t.beat.sold }}</p>
    </div>

    <section v-if="others.length" class="others">
      <p class="mono eyebrow">{{ t.beat.more }}</p>
      <ul class="rows"><BeatRow v-for="(b, i) in others" :key="b.id" :beat="b" :index="i" /></ul>
    </section>

    <CheckoutReceipt v-if="paying" :beat="beat" :license="license" @close="paying = false" />
  </div>
  <div v-else-if="missing" class="wrap none">
    <h1 class="display">{{ t.beat.notFound }}</h1>
    <RouterLink to="/" class="btn">{{ t.notFound.back }}</RouterLink>
  </div>
  <div v-else class="wrap none" />
</template>

<style scoped>
.page { padding-top: clamp(88px, 11vh, 130px); display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(24px, 4vw, 72px); align-items: start; }
.art { position: sticky; top: 92px; display: grid; gap: 8px; justify-items: center; }
.disc { width: min(100%, 76vh); }
.cap { text-align: center; max-width: 36ch; }
.back { opacity: 0.6; transition: opacity 0.2s; }
.back:hover { opacity: 1; }
.title { font-size: clamp(44px, 7.4vw, 128px); margin: 14px 0 20px -0.04em; overflow-wrap: anywhere; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; }
.meta li { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.meta b { font-size: 13px; }
.meta i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
.listen { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; margin: 28px 0 36px; padding: 14px 18px 14px 14px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.pp { width: 64px; height: 64px; border-radius: 50%; background: var(--ink); color: var(--paper); display: grid; place-items: center; transition: background-color 0.25s, transform 0.3s var(--ease), color 0.25s; }
.pp:hover { background: var(--c); color: #0e0e0c; transform: scale(1.06); }
.pp svg { width: 24px; height: 24px; fill: currentColor; }
.wave { height: 56px; min-width: 0; }
.choose { margin-bottom: 14px; }
.note { margin-top: 12px; }
.buy { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; margin-top: 22px; }
.buy-btn { height: 64px; padding: 0 34px; font-size: 17px; background: var(--c); color: #0e0e0c; }
.buy-btn:hover { background: var(--ink); color: var(--paper); }
.buy-btn small { font-weight: 500; opacity: 0.75; font-size: 13px; }
.link { opacity: 0.65; text-decoration: underline; text-underline-offset: 4px; }
.link:hover { opacity: 1; }
.sold { font-size: clamp(26px, 3.4vw, 48px); padding: 28px 0; }
.others { grid-column: 1 / -1; margin-top: clamp(48px, 8vw, 110px); }
.rows { border-top: 1px solid var(--line); }
.none { min-height: 70vh; padding-top: 160px; display: grid; gap: 20px; align-content: start; justify-items: start; }
.none h1 { font-size: clamp(40px, 7vw, 110px); }
@media (max-width: 900px) {
  .page { grid-template-columns: 1fr; }
  .art { position: relative; top: 0; }
  .disc { width: min(84vw, 420px); }
  .buy-btn { width: 100%; padding: 0 18px; font-size: 15px; }
}
</style>
