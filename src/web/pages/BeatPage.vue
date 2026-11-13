<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { LICENSE_NAMES, LICENSE_TERMS } from '../../shared/licenses';
import { beatPalette, formatMoney, formatTime, keyLabel } from '../../shared/music';
import type { Beat, LicenseId } from '../../shared/types';
import DoodleMark from '../components/DoodleMark.vue';
import CheckoutReceipt from '../components/CheckoutReceipt.vue';
import DiscSlot from '../components/DiscSlot.vue';
import LicenseCards from '../components/LicenseCards.vue';
import MiniWave from '../components/MiniWave.vue';
import { api } from '../lib/api';
import { fxBurst, startFlight } from '../lib/fx';
import { stage } from '../lib/stage';
import { lang, t } from '../lib/i18n';
import { player, toggle } from '../lib/player';
import { beats, currency, loadCatalog } from '../lib/store';
import { vMagnet } from '../lib/tilt';

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
// --- řetěz beatů: na konci stránky čeká další deska, doscrollováním se na ni přejde ---
const router = useRouter();
const next = computed(() => {
  const list = beats.value;
  const i = list.findIndex((b) => b.id === beat.value?.id);
  return list.length > 1 ? list[(i + 1) % list.length] : null;
});
const nextPalette = computed(() => (next.value ? beatPalette(next.value.key, next.value.seed) : null));
const chain = ref<HTMLElement | null>(null);
const progress = ref(0);
let jumped = false;
function onScroll() {
  const el = chain.value;
  if (!el || jumped || !next.value) return;
  const r = el.getBoundingClientRect();
  const span = Math.max(1, r.height - window.innerHeight);
  progress.value = Math.min(1, Math.max(0, -r.top / span));
  if (progress.value >= 0.985) {
    jumped = true;
    const d = el.querySelector('.next-disc')!.getBoundingClientRect();
    const cx = d.left + d.width / 2, cy = d.top + d.height / 2;
    fxBurst(cx, cy, 'launch', d.width / 2);
    startFlight();
    stage.launch = { cx, cy, size: d.width, beat: next.value };
    void router.push(`/beat/${next.value.slug}`);
  }
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', onScroll));
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
    <div class="upper">
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

      <div class="listen glass">
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
          <button v-magnet="0.18" class="btn buy-btn" @click="paying = true">
            {{ t.beat.buy }} — {{ price }}<small v-if="LICENSE_TERMS[license].subscription">&nbsp;{{ t.beat.perYear }}</small> <span class="arr">→</span>
          </button>
          <RouterLink :to="{ path: '/licence', hash: `#${license}` }" class="mono link">{{ t.beat.fullText }}: {{ LICENSE_NAMES[license] }} ↗</RouterLink>
        </div>
      </template>
      <p v-else class="sold display">{{ t.beat.sold }}</p>
    </div>

    </div>

    <section v-if="next" ref="chain" class="chain" :style="{ '--n': nextPalette!.css, '--p': progress }">
      <div class="chain-inner">
        <p class="mono eyebrow chain-eyebrow">{{ t.chain.next }}</p>
        <h2 class="display chain-title" :style="{ fontVariationSettings: `'wdth' ${(62 + progress * 63).toFixed(1)}` }">{{ next.title }}</h2>
        <div class="next-wrap">
          <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="48.5" pathLength="1" class="track" />
            <circle cx="50" cy="50" r="48.5" pathLength="1" class="fill boil" :style="{ strokeDashoffset: 1 - progress }" />
          </svg>
          <DiscSlot :priority="5" :tilt="0.55 * (1 - progress)" :beat="next" :interactive="false" class="next-disc" />
        </div>
        <ul class="meta mono chain-meta">
          <li><b>{{ next.bpm }}</b> BPM</li><li><i aria-hidden="true" :style="{ background: 'var(--n)' }" />{{ keyLabel(next.key, lang) }}</li><li>{{ next.genre }}</li>
        </ul>
        <p class="mono chain-hint"><DoodleMark kind="arrow" class="chain-arrow" />{{ progress > 0.7 ? t.chain.almost : t.chain.keep }} · {{ Math.round(progress * 100) }} %</p>
      </div>
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
.page { padding-top: clamp(32px, 6vh, 72px); }
.upper { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: clamp(24px, 4vw, 72px); align-items: start; }
.art { position: sticky; top: 28px; display: grid; gap: 8px; justify-items: center; }
.disc { width: min(100%, 76vh); }
.cap { text-align: center; max-width: 36ch; }
.back { opacity: 0.6; transition: opacity 0.2s; }
.back:hover { opacity: 1; }
.title { font-size: clamp(38px, 5.4vw, 100px); margin: 14px 0 20px -0.04em; overflow-wrap: break-word; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; }
.meta li { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.meta b { font-size: 13px; }
.meta i { width: 9px; height: 9px; border-radius: 50%; background: var(--c); }
.listen { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; margin: 28px 0 36px; padding: 14px 18px 14px 14px; border-radius: 999px; }
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
.chain { height: 210vh; margin: clamp(60px, 10vw, 140px) calc(var(--pad) * -1) 0; }
.chain-inner { position: sticky; top: 0; height: 100vh; height: 100svh; display: grid; grid-template-rows: auto auto 1fr auto auto; justify-items: center; align-content: center; gap: 14px; padding: 5vh var(--pad) calc(var(--dock-h) + 12px); overflow: hidden;
  background: radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--n) calc(var(--p) * 55%), transparent), transparent 70%); }
.chain-eyebrow::before { background: var(--n); }
.chain-title { font-size: clamp(40px, 11vw, 190px); text-align: center; line-height: 0.9; transform: none !important; max-width: 100%; overflow-wrap: anywhere; }
.next-wrap { position: relative; width: min(52vh, 78vw); aspect-ratio: 1; align-self: center; scale: calc(0.72 + var(--p) * 0.28); }
.next-disc { width: 100%; }
.ring { position: absolute; inset: -5%; width: 110%; height: 110%; transform: rotate(-90deg); overflow: visible; }
.ring circle { fill: none; stroke-width: 1.4; vector-effect: non-scaling-stroke; }
.ring .track { stroke: var(--line); stroke-width: 1; stroke-dasharray: 0.004 0.012; }
.ring .fill { stroke: var(--n); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 1; }
.chain-meta { justify-content: center; }
.chain-hint { display: inline-flex; align-items: center; gap: 12px; color: var(--ink-2); }
.chain-arrow { width: 46px; height: 30px; color: var(--n); transform: rotate(70deg); }
.none { min-height: 70vh; padding-top: 160px; display: grid; gap: 20px; align-content: start; justify-items: start; }
.none h1 { font-size: clamp(40px, 7vw, 110px); }
@media (max-width: 900px) {
  .upper { grid-template-columns: 1fr; }
  .art { position: relative; top: 0; }
  .disc { width: min(84vw, 420px); }
  .chain { height: 190vh; }
  .buy-btn { width: 100%; padding: 0 18px; font-size: 15px; }
}
</style>
