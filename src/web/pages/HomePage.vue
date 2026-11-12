<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { BRAND } from '../../shared/brand';
import { keyLabel } from '../../shared/music';
import BeatRow from '../components/BeatRow.vue';
import ControlDeck from '../components/ControlDeck.vue';
import DiscSlot from '../components/DiscSlot.vue';
import FaqList from '../components/FaqList.vue';
import LicenseCards from '../components/LicenseCards.vue';
import { lang, t } from '../lib/i18n';
import { meter, player } from '../lib/player';
import { vReveal } from '../lib/reveal';
import { stageBeat } from '../lib/stage';
import { beats, filtered, genres, hasFilters, loadCatalog, loadError, loaded, resetFilters } from '../lib/store';

const title = ref<HTMLElement | null>(null);
const onDeck = computed(() => stageBeat.value ?? player.current ?? beats.value[0] ?? null);
const marquee = computed(() => [...(genres.value.length ? genres.value : ['Trap', 'Drill', 'Boom Bap']), BRAND.credit, 'WAV', 'STEMS', 'EXCLUSIVE', 'Mix & Master']);

// typografie dýchá s kopákem: šířka písma se při úderu stáhne
let raf = 0;
function pulse() {
  raf = requestAnimationFrame(pulse);
  if (!title.value) return;
  title.value.style.setProperty('--w', (125 - meter.bass * 34).toFixed(1));
}
onMounted(() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(pulse); });
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <div>
    <section class="hero wrap">
      <div class="copy">
        <p class="mono eyebrow">{{ t.hero.eyebrow }}</p>
        <h1 ref="title" class="display title">
          <span class="ln"><span>{{ t.hero.l1 }}</span></span>
          <span class="ln"><span>{{ t.hero.l2 }}</span></span>
          <span class="ln"><span>{{ t.hero.l3 }}<i class="dot" aria-hidden="true" /></span></span>
        </h1>
        <div class="lead">
          <p>{{ t.hero.sub }}</p>
          <div class="cta">
            <a href="#beats" class="btn">{{ t.hero.cta }} <span class="arr">↓</span></a>
            <RouterLink to="/mix-master" class="btn ghost">{{ t.hero.cta2 }}</RouterLink>
          </div>
        </div>
      </div>

      <div class="deckzone">
        <DiscSlot :priority="3" :tilt="0.8" class="hero-disc" />
        <div v-if="onDeck" class="ondeck mono">
          <span class="dim">{{ player.playing ? t.status.playing : 'On deck' }}</span>
          <strong>{{ onDeck.title }}</strong>
          <span>{{ onDeck.bpm }} BPM · {{ keyLabel(onDeck.key, lang) }}</span>
        </div>
        <p class="hints mono dim"><span>● {{ t.hero.hintPlay }}</span><span>↻ {{ t.hero.hintDrag }}</span><span>␣ play / pause</span></p>
      </div>

      <ul class="stats mono">
        <li><b>{{ String(beats.length).padStart(2, '0') }}</b> {{ t.hero.stats[0] }}</li>
        <li>{{ t.hero.stats[1] }}</li>
        <li>{{ t.hero.stats[2] }}</li>
      </ul>
    </section>

    <div class="marquee" aria-hidden="true">
      <div class="track display"><span v-for="n in 2" :key="n"><template v-for="w in marquee" :key="w">{{ w }}<i /></template></span></div>
    </div>

    <section id="beats" class="section wrap">
      <div class="section-head">
        <div>
          <p class="mono eyebrow">01 — {{ t.deck.title }}</p>
          <h2 v-reveal class="display h2">{{ t.deck.title }}</h2>
        </div>
        <p class="dim sub">{{ t.deck.sub }}</p>
      </div>
      <ControlDeck v-if="beats.length" v-reveal />
      <ul v-if="filtered.length" class="rows">
        <BeatRow v-for="(b, i) in filtered" :key="b.id" :beat="b" :index="i" />
      </ul>
      <div v-else-if="loaded" class="empty">
        <template v-if="loadError">
          <h3 class="display">{{ t.deck.error }}</h3>
          <button class="btn" @click="loadCatalog(true)">{{ t.deck.retry }}</button>
        </template>
        <template v-else-if="hasFilters">
          <h3 class="display">{{ t.deck.empty }}</h3><p class="dim">{{ t.deck.emptySub }}</p>
          <button class="btn ghost" @click="resetFilters">{{ t.deck.reset }}</button>
        </template>
        <template v-else><h3 class="display">{{ t.deck.none }}</h3><p class="dim">{{ t.deck.noneSub }}</p></template>
      </div>
    </section>

    <section class="section wrap">
      <div class="section-head">
        <div>
          <p class="mono eyebrow">02 — {{ t.lic.title }}</p>
          <h2 v-reveal class="display h2">{{ t.lic.title }}</h2>
        </div>
        <p class="dim sub">{{ t.lic.sub }}</p>
      </div>
      <LicenseCards v-reveal />
      <p class="more"><RouterLink to="/licence" class="btn ghost">{{ t.lic.read }} <span class="arr">→</span></RouterLink></p>
    </section>

    <section class="section wrap svc">
      <RouterLink to="/mix-master" class="svc-card" data-cursor="open">
        <div>
          <p class="mono eyebrow">03 — {{ t.svc.eyebrow }}</p>
          <h2 class="display big">{{ t.svc.title1 }}<br />{{ t.svc.title2 }}</h2>
        </div>
        <div class="faders" aria-hidden="true"><span v-for="n in 9" :key="n" :style="{ '--v': [62, 38, 80, 55, 71, 30, 66, 48, 76][n - 1] + '%' }"><i /></span></div>
        <p class="svc-sub">{{ t.svc.sub }}<span class="btn small">{{ t.nav.services }} <span class="arr">→</span></span></p>
      </RouterLink>
    </section>

    <section id="faq" class="section wrap faq-sec">
      <div><p class="mono eyebrow">04 — FAQ</p><h2 v-reveal class="display h2">{{ t.faq.title }}</h2></div>
      <FaqList />
    </section>
  </div>
</template>

<style scoped>
.hero { position: relative; min-height: 100svh; padding-top: clamp(96px, 13vh, 150px); display: grid; grid-template-rows: 1fr auto; }
.copy { position: relative; }
/* Titulek leží NAD deskou a prolíná se s ní (difference) – zůstane čitelný a obarví se podle beatu. */
.title { position: relative; z-index: 46; pointer-events: none; color: #fff; mix-blend-mode: difference; font-size: clamp(60px, 13.6vw, 250px); font-variation-settings: 'wdth' var(--w, 125); margin-left: -0.045em; }
:root[data-live='1'] .title { color: #f1efe9; }
.ln { display: block; overflow: hidden; padding-block: 0.06em; margin-block: -0.06em; }
.ln > span { display: inline-block; white-space: nowrap; animation: rise 1.1s var(--ease) both; }
.ln:nth-child(2) > span { animation-delay: 0.09s; }
.ln:nth-child(3) > span { animation-delay: 0.18s; }
@keyframes rise { from { transform: translateY(105%); } }
.dot { display: inline-block; width: 0.17em; height: 0.17em; border-radius: 50%; background: var(--k); margin-left: 0.06em; transition: background-color 0.5s; }
.lead { position: relative; z-index: 3; margin-top: clamp(24px, 3.4vw, 48px); max-width: min(430px, 100%); display: grid; gap: 26px; animation: in 1s 0.45s var(--ease) both; }
.lead p { font-size: clamp(16px, 1.3vw, 19px); color: var(--ink-2); }
.cta { display: flex; gap: 10px; flex-wrap: wrap; }
@keyframes in { from { opacity: 0; transform: translateY(16px); } }

.deckzone { position: absolute; right: -3.5vw; top: clamp(84px, 11vh, 130px); width: min(54vw, 88vh); z-index: 2; pointer-events: none; animation: in 1.2s 0.3s var(--ease) both; }
.hero-disc { width: 100%; pointer-events: auto; }
.ondeck { position: absolute; right: 9%; top: 7%; display: grid; gap: 3px; padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--paper) 80%, transparent); backdrop-filter: blur(10px); box-shadow: inset 0 0 0 1px var(--line); z-index: 50; }
.ondeck strong { font-family: var(--sans); font-size: 17px; font-weight: 750; font-variation-settings: 'wdth' 114; text-transform: none; letter-spacing: -0.01em; }
.hints { position: absolute; right: 9%; bottom: 8%; display: flex; gap: 18px; z-index: 50; white-space: nowrap; }

.stats { position: relative; z-index: 3; display: flex; gap: clamp(18px, 4vw, 64px); flex-wrap: wrap; padding-block: 22px; border-top: 1px solid var(--line); margin-top: 48px; color: var(--ink-2); }
.stats b { color: var(--ink); font-size: 13px; }

.marquee { overflow: hidden; border-block: 1px solid var(--line); padding-block: 14px; }
.track { display: flex; width: max-content; font-size: clamp(22px, 3.2vw, 44px); animation: slide 38s linear infinite; }
.track span { display: flex; align-items: center; white-space: nowrap; }
.track i { width: 0.34em; height: 0.34em; border-radius: 50%; background: var(--k); margin-inline: 0.6em; transition: background-color 0.5s; }
@keyframes slide { to { transform: translateX(-50%); } }

.sub { max-width: 34ch; }
.rows { margin-top: 22px; border-top: 1px solid var(--line); }
.empty { padding: 80px 0; display: grid; gap: 14px; justify-items: start; }
.empty h3 { font-size: clamp(30px, 5vw, 64px); }
.more { margin-top: 26px; }

.svc-card { display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px; align-items: end; padding: clamp(24px, 4vw, 56px); border-radius: 26px; background: var(--ink); color: var(--paper); overflow: hidden; transition: background-color 0.7s var(--ease), color 0.7s var(--ease); }
.svc-card .eyebrow { opacity: 0.7; }
.big { font-size: clamp(54px, 10.5vw, 180px); }
.faders { display: flex; gap: clamp(8px, 1.4vw, 20px); height: clamp(150px, 20vw, 290px); justify-self: end; align-items: stretch; }
.faders span { position: relative; width: 2px; background: color-mix(in srgb, var(--paper) 28%, transparent); }
.faders i { position: absolute; left: 50%; bottom: var(--v); width: clamp(18px, 2.3vw, 34px); height: clamp(30px, 3.6vw, 52px); margin-left: clamp(-17px, -1.15vw, -9px); border-radius: 5px; background: var(--paper); transition: bottom 0.7s var(--ease), background-color 0.3s; box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.25); }
.faders i::after { content: ''; position: absolute; left: 3px; right: 3px; top: 50%; height: 2px; margin-top: -1px; background: var(--k); }
.svc-card:hover .faders span:nth-child(odd) i { bottom: calc(100% - var(--v) - 10%); }
.svc-card:hover .faders span:nth-child(even) i { bottom: calc(var(--v) + 14%); }
.svc-sub { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; padding-top: 24px; border-top: 1px solid color-mix(in srgb, var(--paper) 22%, transparent); max-width: none; opacity: 0.9; }
.svc-sub .btn { background: var(--paper); color: var(--ink); }
.svc-card:hover .svc-sub .btn { background: var(--k); color: #0e0e0c; }

.faq-sec { display: grid; grid-template-columns: 1fr 1.6fr; gap: 32px; align-items: start; }

@media (max-width: 900px) {
  .hero { min-height: 0; grid-template-rows: auto auto auto; }
  .title { font-size: clamp(40px, 14.4vw, 150px); }
  .deckzone { position: relative; right: auto; top: auto; width: min(100%, 560px); margin: 8px auto -8px; }
  .hints { right: 50%; transform: translateX(50%); bottom: 2%; gap: 12px; }
  .hints span:last-child { display: none; }
  .ondeck { right: 0; top: 2%; }
  .stats { margin-top: 12px; }
  .svc-card { grid-template-columns: 1fr; }
  .faders { justify-self: start; height: 130px; }
  .faq-sec { grid-template-columns: 1fr; }
}
</style>
