<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ADDONS, ADDON_IDS, MAX_SONGS, SERVICES, SERVICE_IDS, servicePrice, volumeDiscount, type AddonId } from '../../shared/services';
import { formatMoney } from '../../shared/music';
import type { ServiceId } from '../../shared/types';
import { api } from '../lib/api';
import { lang, t } from '../lib/i18n';
import { vReveal } from '../lib/reveal';
import { vMagnet, vTilt } from '../lib/tilt';
import { currency, servicePayments } from '../lib/store';

const f = reactive({
  service: 'mixmaster' as ServiceId, songs: 1, addons: [] as AddonId[],
  name: '', email: '', project: '', filesUrl: '', referenceUrl: '', notes: '', consent: false, website: '',
});
const busy = ref(false);
const done = ref(false);
const error = ref(false);

const total = computed(() => servicePrice(f.service, f.songs, f.addons));
const money = (v: number) => formatMoney(v, currency.value, lang.value);
const discount = computed(() => volumeDiscount(f.songs));
const days = computed(() => Math.ceil(SERVICES[f.service].days * (f.addons.includes('express') ? 0.5 : 1)) + Math.floor((f.songs - 1) / 2));
function toggleAddon(a: AddonId) {
  const i = f.addons.indexOf(a);
  if (i > -1) f.addons.splice(i, 1);
  else f.addons.push(a);
}
const addonPrice = (a: AddonId) => (ADDONS[a].type === 'percent' ? `+${ADDONS[a].value} %` : `+${money(ADDONS[a].value)}`);

async function submit() {
  if (busy.value) return;
  busy.value = true; error.value = false;
  try {
    const r = await api<{ ok: boolean; url: string | null }>('/api/services', { method: 'POST', json: { ...f, lang: lang.value, payNow: servicePayments.value } });
    if (r.url) window.location.assign(r.url);
    else done.value = true;
  } catch {
    error.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="svc wrap">
    <header class="top">
      <p class="mono eyebrow">{{ t.svc.eyebrow }}</p>
      <h1 class="display title"><span>{{ t.svc.title1 }}</span><span class="boil-lg">{{ t.svc.title2 }}</span></h1>
      <p class="sub">{{ t.svc.sub }}</p>
    </header>

    <form v-tilt="2" class="console glass" @submit.prevent="submit">
      <section class="panel pick">
        <h2 class="mono"><span>1</span>{{ t.svc.pick }}</h2>
        <div class="services" role="radiogroup">
          <button v-for="s in SERVICE_IDS" :key="s" type="button" role="radio" :aria-checked="f.service === s" class="service" :class="{ on: f.service === s }" @click="f.service = s">
            <span class="led" aria-hidden="true" />
            <strong class="display">{{ t.svc.s[s].name }}</strong>
            <span class="desc">{{ t.svc.s[s].desc }}</span>
            <span class="mono foot">{{ money(SERVICES[s].price) }} {{ t.svc.perSong }} · {{ t.svc.days(SERVICES[s].days) }} · {{ t.svc.revisions(SERVICES[s].revisions) }}</span>
          </button>
        </div>
      </section>

      <section class="panel qty">
        <h2 class="mono"><span>2</span>{{ t.svc.songs }}</h2>
        <div class="songs">
          <output class="digits">{{ String(f.songs).padStart(2, '0') }}</output>
          <input v-model.number="f.songs" type="range" min="1" :max="MAX_SONGS" step="1" class="fader" :aria-label="t.svc.songs" :style="{ '--p': `${((f.songs - 1) / (MAX_SONGS - 1)) * 100}%` }" />
          <span class="mono dim">{{ discount ? t.svc.discount(discount) : ' ' }}</span>
        </div>
        <h2 class="mono second"><span>3</span>{{ t.svc.addons }}</h2>
        <div class="switches">
          <button v-for="a in ADDON_IDS" :key="a" type="button" role="switch" :aria-checked="f.addons.includes(a)" class="switch" @click="toggleAddon(a)">
            <i aria-hidden="true" /><span>{{ t.svc.a[a] }}</span><span class="mono dim">{{ addonPrice(a) }}</span>
          </button>
        </div>
      </section>

      <section class="panel lcd">
        <p class="mono">{{ t.svc.total }}</p>
        <output class="price">{{ money(total) }}</output>
        <p class="mono est">≈ {{ t.svc.days(days) }} · {{ t.svc.revisions(SERVICES[f.service].revisions) }}</p>
        <div class="meters" aria-hidden="true"><i v-for="n in 14" :key="n" :class="{ on: n <= 3 + f.songs + f.addons.length * 2 }" /></div>
      </section>

      <section class="panel brief">
        <h2 class="mono"><span>4</span>{{ t.svc.form }}</h2>
        <div v-if="done" class="done" role="status">
          <h3 class="display">{{ t.svc.okTitle }}</h3><p class="dim">{{ t.svc.okText }}</p>
        </div>
        <div v-else class="fields">
          <label class="field"><span>{{ t.svc.name }} *</span><input v-model="f.name" class="input" required maxlength="100" autocomplete="name" /></label>
          <label class="field"><span>{{ t.svc.email }} *</span><input v-model="f.email" class="input" type="email" required maxlength="200" autocomplete="email" /></label>
          <label class="field"><span>{{ t.svc.project }}</span><input v-model="f.project" class="input" maxlength="140" /></label>
          <label class="field"><span>{{ t.svc.files }}</span><input v-model="f.filesUrl" class="input" type="url" :placeholder="t.svc.filesPh" maxlength="600" /></label>
          <label class="field wide"><span>{{ t.svc.reference }}</span><input v-model="f.referenceUrl" class="input" type="url" placeholder="https://" maxlength="600" /></label>
          <label class="field wide"><span>{{ t.svc.notes }}</span><textarea v-model="f.notes" class="input" :placeholder="t.svc.notesPh" maxlength="3000" /></label>
          <label class="hp" aria-hidden="true">Website<input v-model="f.website" tabindex="-1" autocomplete="off" /></label>
          <label class="consent wide"><input v-model="f.consent" type="checkbox" required /><span>{{ t.svc.consent }} (<RouterLink to="/podminky">↗</RouterLink>)</span></label>
          <p v-if="error" class="error wide" role="alert">{{ t.svc.err }}</p>
          <button v-magnet="0.12" class="btn wide send" :disabled="busy">{{ busy ? t.svc.sending : servicePayments ? t.svc.sendPay : t.svc.send }} — {{ money(total) }} <span class="arr">→</span></button>
        </div>
      </section>
    </form>

    <section class="section process">
      <p class="mono eyebrow">{{ t.svc.process }}</p>
      <ol>
        <li v-for="([h, p], i) in t.svc.steps" :key="i" v-reveal="i * 90">
          <span class="mono n">{{ String(i + 1).padStart(2, '0') }}</span>
          <h3 class="display">{{ h }}</h3><p class="dim">{{ p }}</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.svc { padding-top: clamp(96px, 13vh, 150px); }
.top { display: grid; gap: 20px; margin-bottom: clamp(32px, 5vw, 72px); }
.title { font-size: clamp(64px, 15vw, 270px); display: flex; flex-wrap: wrap; gap: 0 0.22em; margin-left: -0.045em; }
.title span { animation: rise 1s var(--ease) both; display: inline-block; }
.title span + span { animation-delay: 0.1s; color: transparent; -webkit-text-stroke: 2px var(--ink); }
@keyframes rise { from { transform: translateY(40%); opacity: 0; } }
.sub { max-width: 46ch; font-size: clamp(16px, 1.4vw, 20px); color: var(--ink-2); }

.console { display: grid; grid-template-columns: 1.5fr 1fr 0.9fr; border-radius: 26px; }
.lcd { border-radius: 0 26px 0 0; }
.panel { padding: clamp(18px, 2.2vw, 30px); min-width: 0; }
.panel + .panel { border-left: 1px solid var(--line); }
.brief { grid-column: 1 / -1; border-left: 0 !important; border-top: 1px solid var(--line); }
h2 { display: flex; align-items: center; gap: 10px; color: var(--ink-2); margin-bottom: 16px; }
h2 span { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; background: var(--ink); color: var(--paper); font-size: 10px; }
h2.second { margin-top: 26px; }
.services { display: grid; gap: 8px; }
.service { position: relative; text-align: left; display: grid; gap: 4px; padding: 16px 18px 16px 44px; border-radius: 14px; box-shadow: inset 0 0 0 1px var(--line); transition: background-color 0.3s, color 0.3s, transform 0.4s var(--ease); }
.service:hover { transform: translateX(4px); }
.service.on { background: var(--ink); color: var(--paper); box-shadow: none; }
.service strong { font-size: clamp(24px, 2.6vw, 38px); }
.service .desc { font-size: 14px; opacity: 0.75; }
.service .foot { opacity: 0.65; margin-top: 6px; font-size: 10px; }
.led { position: absolute; left: 18px; top: 26px; width: 10px; height: 10px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--ink-3); }
.service.on .led { background: var(--k); box-shadow: 0 0 12px var(--k); }

.songs { display: grid; gap: 10px; }
.digits { font-family: var(--mono); font-size: clamp(54px, 6vw, 90px); font-weight: 600; letter-spacing: -0.05em; line-height: 0.9; font-variant-numeric: tabular-nums; }
.fader { -webkit-appearance: none; appearance: none; width: 100%; height: 34px; background: transparent; cursor: pointer; }
.fader::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, var(--k) var(--p), var(--line) var(--p)); }
.fader::-moz-range-track { height: 4px; border-radius: 2px; background: var(--line); }
.fader::-moz-range-progress { height: 4px; background: var(--k); }
.fader::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 34px; margin-top: -15px; border-radius: 5px; background: var(--ink); box-shadow: inset 0 0 0 1px var(--paper), inset 0 -14px 0 -11px var(--k); }
.fader::-moz-range-thumb { width: 22px; height: 34px; border: 0; border-radius: 5px; background: var(--ink); }
.switches { display: grid; gap: 4px; }
.switch { display: grid; grid-template-columns: 38px 1fr auto; gap: 12px; align-items: center; padding: 9px 0; text-align: left; font-size: 14.5px; }
.switch i { width: 38px; height: 22px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); position: relative; transition: background-color 0.25s; }
.switch i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: var(--ink); transition: transform 0.35s var(--ease), background-color 0.25s; }
.switch[aria-checked='true'] i { background: var(--k); box-shadow: none; }
.switch[aria-checked='true'] i::after { transform: translateX(16px); background: #0e0e0c; }

.lcd { background: #0b0b0a; color: #edebe6; display: grid; align-content: space-between; gap: 14px; }
.lcd .mono { color: rgb(237 235 230 / 0.6); }
.price { font-family: var(--mono); font-size: clamp(30px, 3.4vw, 54px); font-weight: 600; letter-spacing: -0.05em; line-height: 1; color: var(--k); text-shadow: 0 0 26px color-mix(in srgb, var(--k) 55%, transparent); overflow-wrap: anywhere; transition: color 0.5s; }
.meters { display: flex; gap: 4px; align-items: flex-end; height: 44px; }
.meters i { flex: 1; height: 100%; border-radius: 2px; background: rgb(237 235 230 / 0.12); transition: background-color 0.3s; }
.meters i.on { background: var(--k); }
.meters i.on:nth-child(n + 12) { background: #ff3b30; }

.fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.wide { grid-column: 1 / -1; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
.consent { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: var(--ink-2); cursor: pointer; }
.consent input { width: 18px; height: 18px; margin: 2px 0 0; accent-color: var(--ink); flex: none; }
.consent a { text-decoration: underline; }
.send { height: 60px; font-size: 16px; }
.error { color: #d6402c; font-weight: 600; }
.done { padding: 30px 0 14px; display: grid; gap: 10px; }
.done h3 { font-size: clamp(40px, 6vw, 90px); }

.process ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border-top: 1px solid var(--line); }
.process li { padding: 22px 22px 8px 0; display: grid; gap: 10px; align-content: start; }
.process li + li { padding-left: 22px; border-left: 1px solid var(--line); }
.process .n { color: var(--k); }
.process h3 { font-size: clamp(22px, 2.3vw, 34px); }
@media (max-width: 1000px) {
  .console { grid-template-columns: 1fr 1fr; }
  .pick { grid-column: 1 / -1; }
  .qty { border-left: 0 !important; border-top: 1px solid var(--line); }
  .lcd { border-top: 1px solid var(--line); }
  .process ol { grid-template-columns: 1fr 1fr; }
  .process li:nth-child(3) { padding-left: 0; border-left: 0; }
}
@media (max-width: 640px) {
  .console, .fields, .process ol { grid-template-columns: 1fr; }
  .panel + .panel { border-left: 0; border-top: 1px solid var(--line); }
  .process li + li { padding-left: 0; border-left: 0; border-top: 1px solid var(--line); }
  .title span + span { -webkit-text-stroke-width: 1.2px; }
}
</style>
