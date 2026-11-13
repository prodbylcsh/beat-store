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
const SHORT: Record<AddonId, string> = { express: 'EXPRES', tuning: 'TUNE', stemsOut: 'STEMS' };
const SVC_SHORT: Record<ServiceId, string> = { mix: 'MIX', master: 'MASTER', mixmaster: 'MIX+MST' };
const level = computed(() => Math.min(14, 4 + f.songs + f.addons.length * 2));
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

    <form class="mixer" @submit.prevent="submit">
      <div class="rack-head mono"><span><i class="pwr" />{{ t.svc.mixer }}</span><span>{{ t.svc.pick }} → {{ t.svc.addons }} → {{ t.svc.songs }}</span></div>
      <div class="strips">
        <!-- inserty = služby (vybereš jednu) -->
        <button
          v-for="(s, i) in SERVICE_IDS" :key="s" type="button" role="radio" :aria-checked="f.service === s" :aria-label="t.svc.s[s].name"
          class="strip" :class="{ on: f.service === s }" @click="f.service = s"
        >
          <span class="slot mono">INS {{ i + 1 }}</span>
          <span class="plate">{{ SVC_SHORT[s] }}</span>
          <span class="knob" :style="{ '--a': f.service === s ? '40deg' : '-120deg' }" />
          <span class="chan">
            <span class="vu"><i /><i /></span>
            <span class="track"><span class="cap tex-metal" :style="{ bottom: f.service === s ? '72%' : '18%' }" /></span>
          </span>
          <span class="led" />
          <span class="val mono">{{ money(SERVICES[s].price) }}</span>
        </button>
        <span class="gap" aria-hidden="true" />
        <!-- efektové sloty = doplňky (zapínáš / vypínáš) -->
        <button
          v-for="(a, i) in ADDON_IDS" :key="a" type="button" role="switch" :aria-checked="f.addons.includes(a)" :aria-label="t.svc.a[a]"
          class="strip fx" :class="{ on: f.addons.includes(a) }" @click="toggleAddon(a)"
        >
          <span class="slot mono">FX {{ i + 1 }}</span>
          <span class="plate">{{ SHORT[a] }}</span>
          <span class="knob" :style="{ '--a': f.addons.includes(a) ? '120deg' : '-130deg' }" />
          <span class="chan">
            <span class="vu"><i /><i /></span>
            <span class="track"><span class="cap tex-metal" :style="{ bottom: f.addons.includes(a) ? '60%' : '8%' }" /></span>
          </span>
          <span class="led" />
          <span class="val mono">{{ addonPrice(a) }}</span>
        </button>
        <span class="gap" aria-hidden="true" />
        <!-- skutečný fader: počet skladeb -->
        <div class="strip songs on">
          <span class="slot mono">QTY</span>
          <span class="plate">{{ t.svc.songsShort }}</span>
          <output class="digits">{{ String(f.songs).padStart(2, '0') }}</output>
          <span class="chan">
            <span class="scale mono" aria-hidden="true"><b>12</b><b>9</b><b>6</b><b>3</b><b>1</b></span>
            <input v-model.number="f.songs" type="range" min="1" :max="MAX_SONGS" step="1" class="vfader" :aria-label="t.svc.songs" />
          </span>
          <span class="led" />
          <span class="val mono">{{ discount ? `−${discount} %` : '—' }}</span>
        </div>
        <!-- master: výsledná cena -->
        <div class="strip master on">
          <span class="slot mono">MASTER OUT</span>
          <span class="lcd">
            <span class="mono">{{ t.svc.total }}</span>
            <output class="price">{{ money(total) }}</output>
            <span class="mono est">≈ {{ t.svc.days(days) }} · {{ t.svc.revisions(SERVICES[f.service].revisions) }}</span>
          </span>
          <span class="big-vu" aria-hidden="true">
            <span v-for="ch in 2" :key="ch" class="col"><i v-for="n in 14" :key="n" :class="{ lit: 15 - n <= level - (ch - 1) }" /></span>
          </span>
          <span class="val mono">L&nbsp;&nbsp;&nbsp;R</span>
        </div>
      </div>

      <div class="inspector">
        <div>
          <p class="mono">{{ t.svc.selected }}</p>
          <h2 class="display">{{ t.svc.s[f.service].name }}</h2>
          <p class="desc">{{ t.svc.s[f.service].desc }}</p>
        </div>
        <ul class="legend mono">
          <li v-for="a in ADDON_IDS" :key="a" :class="{ on: f.addons.includes(a) }"><i />{{ SHORT[a] }} — {{ t.svc.a[a] }} <span>{{ addonPrice(a) }}</span></li>
        </ul>
      </div>

      <section v-tilt="2" class="brief glass">
        <h2 class="mono"><span>→</span>{{ t.svc.form }}</h2>
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
.svc { padding-top: clamp(40px, 7vh, 84px); }
.top { display: grid; gap: 20px; margin-bottom: clamp(32px, 5vw, 72px); }
.title { font-size: clamp(64px, 15vw, 270px); display: flex; flex-wrap: wrap; gap: 0 0.22em; margin-left: -0.045em; }
.title span { animation: rise 1s var(--ease) both; display: inline-block; }
.title span + span { animation-delay: 0.1s; color: transparent; -webkit-text-stroke: 2px var(--ink); }
@keyframes rise { from { transform: translateY(40%); opacity: 0; } }
.sub { max-width: 46ch; font-size: clamp(16px, 1.4vw, 20px); color: var(--ink-2); }

/* ------------------------------ MIXÁŽNÍ PULT ------------------------------ */
.mixer { --m1: #30353b; --m2: #1f2327; --m-line: #0d0f11; --m-text: #c9ced4; --led: #7dff6a; display: grid; gap: 18px; }
.rack-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 10px 16px; border-radius: 12px 12px 0 0; background: linear-gradient(#3a4047, #2a2f34); color: var(--m-text); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12), inset 0 -1px 0 var(--m-line); margin-bottom: -18px; }
.rack-head span { display: inline-flex; align-items: center; gap: 8px; }
.pwr { width: 8px; height: 8px; border-radius: 50%; background: var(--led); box-shadow: 0 0 10px var(--led); animation: blink 1.2s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0.35; } }
.strips { display: flex; align-items: stretch; gap: 0; padding: 14px; overflow-x: auto; border-radius: 0 0 18px 18px; background: #15181b; box-shadow: inset 0 2px 10px rgb(0 0 0 / 0.6), 0 40px 60px -40px rgb(0 0 0 / 0.7); scrollbar-width: thin; }
.gap { flex: 0 0 12px; }
.strip {
  position: relative; flex: 0 0 96px; display: grid; grid-template-rows: auto auto auto 1fr auto auto; justify-items: center; gap: 10px; padding: 10px 8px 12px; height: 460px; color: var(--m-text); text-align: center;
  background: linear-gradient(180deg, var(--m1), var(--m2)); box-shadow: inset 1px 0 0 rgb(255 255 255 / 0.07), inset -1px 0 0 var(--m-line), inset 0 1px 0 rgb(255 255 255 / 0.1);
  background-image: linear-gradient(180deg, var(--m1), var(--m2)), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.02) 0 1px, transparent 1px 3px);
  transition: filter 0.2s steps(2), transform 0.15s steps(2);
}
.strip:first-child { border-radius: 8px 0 0 8px; }
button.strip { cursor: pointer; }
button.strip:hover { filter: brightness(1.18); }
button.strip:active { transform: translateY(2px); }
.strip.on { --m1: #3b434b; --m2: #262b30; }
.slot { font-size: 9px; opacity: 0.6; }
.plate { width: 100%; padding: 5px 2px; border-radius: 3px; background: #0c0e10; color: #8f979f; font-family: var(--mono); font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; box-shadow: inset 0 1px 3px #000; transition: color 0.2s, background-color 0.2s; white-space: nowrap; overflow: hidden; }
.strip.on .plate { color: #0e0e0c; background: var(--k); }
.knob { width: 38px; height: 38px; border-radius: 50%; background: conic-gradient(from 210deg, #6b737b, #2a2e33 40%, #555c64 75%, #6b737b); box-shadow: 0 3px 5px rgb(0 0 0 / 0.6), inset 0 1px 1px rgb(255 255 255 / 0.3); position: relative; transform: rotate(var(--a)); transition: transform 0.4s steps(6); }
.knob::after { content: ''; position: absolute; left: 50%; top: 3px; width: 3px; height: 12px; margin-left: -1.5px; border-radius: 2px; background: #fff; }
.strip.on .knob::after { background: var(--k); box-shadow: 0 0 6px var(--k); }
.chan { display: flex; gap: 8px; align-items: stretch; height: 100%; min-height: 0; }
.vu { display: flex; gap: 2px; width: 12px; padding: 2px; border-radius: 2px; background: #07090a; box-shadow: inset 0 1px 3px #000; }
.vu i { flex: 1; align-self: flex-end; height: 6%; background: linear-gradient(0deg, #2ee35c 0 62%, #f2d43a 62% 84%, #ff3b30 84%); background-size: 100% 240px; background-position: bottom; }
/* ukazatele hlasitosti běží trhaně (12 fps) */
.strip.on .vu i { animation: vu 0.75s steps(9) infinite alternate; }
.strip.on .vu i:last-child { animation-duration: 0.58s; animation-delay: -0.2s; }
@keyframes vu { 0% { height: 22%; } 35% { height: 78%; } 60% { height: 46%; } 100% { height: 92%; } }
.track { position: relative; width: 26px; border-radius: 3px; background: linear-gradient(90deg, transparent 11px, #060708 11px 15px, transparent 15px), repeating-linear-gradient(0deg, rgb(255 255 255 / 0.18) 0 1px, transparent 1px 12.5%); }
.cap { position: absolute; left: -3px; right: -3px; height: 34px; margin-bottom: -17px; border-radius: 3px; box-shadow: 0 4px 6px rgb(0 0 0 / 0.6), inset 0 0 0 1px rgb(0 0 0 / 0.5); transition: bottom 0.45s steps(7); }
.cap::after { content: ''; position: absolute; left: 2px; right: 2px; top: 50%; height: 2px; margin-top: -1px; background: #111; }
.led { width: 26px; height: 9px; border-radius: 2px; background: #0b2a10; box-shadow: inset 0 1px 2px #000; transition: background-color 0.1s, box-shadow 0.1s; }
.strip.on .led { background: var(--led); box-shadow: 0 0 12px var(--led), inset 0 1px 1px rgb(255 255 255 / 0.6); }
.val { font-size: 9.5px; white-space: nowrap; opacity: 0.85; }
.strip.fx { --led: #ffb84a; }

.songs { flex-basis: 112px; }
.digits { font-family: var(--mono); font-size: 30px; font-weight: 700; line-height: 1; color: var(--k); text-shadow: 0 0 14px color-mix(in srgb, var(--k) 60%, transparent); padding: 4px 8px; border-radius: 4px; background: #07090a; box-shadow: inset 0 1px 4px #000; font-variant-numeric: tabular-nums; }
.scale { display: grid; align-content: space-between; font-size: 8.5px; opacity: 0.55; padding-block: 6px; }
.scale b { font-weight: 500; }
.vfader { -webkit-appearance: none; appearance: none; writing-mode: vertical-lr; direction: rtl; width: 34px; height: 100%; background: transparent; cursor: ns-resize; margin: 0; }
.vfader::-webkit-slider-runnable-track { width: 5px; border-radius: 3px; background: #060708; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08); }
.vfader::-moz-range-track { width: 5px; border-radius: 3px; background: #060708; }
.vfader::-webkit-slider-thumb { -webkit-appearance: none; width: 34px; height: 40px; margin-left: -14.5px; border-radius: 4px; background: linear-gradient(180deg, #e6e3dc, #8f8c85 46%, #111 46% 54%, #c9c6be 54%, #77746e); box-shadow: 0 5px 8px rgb(0 0 0 / 0.7), inset 0 0 0 1px rgb(0 0 0 / 0.5); }
.vfader::-moz-range-thumb { width: 34px; height: 40px; border: 0; border-radius: 4px; background: linear-gradient(180deg, #e6e3dc, #8f8c85 46%, #111 46% 54%, #c9c6be 54%, #77746e); }

.master { flex: 1 0 230px; grid-template-rows: auto auto 1fr auto; border-radius: 0 8px 8px 0; padding-inline: 14px; }
.lcd { width: 100%; display: grid; gap: 6px; padding: 14px; border-radius: 6px; background: #060807; box-shadow: inset 0 2px 8px #000, 0 1px 0 rgb(255 255 255 / 0.08); text-align: left; }
.lcd .mono { color: rgb(201 206 212 / 0.6); font-size: 9.5px; }
.price { font-family: var(--mono); font-size: clamp(26px, 2.6vw, 40px); font-weight: 700; letter-spacing: -0.05em; line-height: 1; color: var(--k); text-shadow: 0 0 22px color-mix(in srgb, var(--k) 55%, transparent); overflow-wrap: anywhere; }
.big-vu { display: flex; gap: 10px; width: 100%; justify-content: center; align-items: stretch; min-height: 0; }
.big-vu .col { display: grid; gap: 3px; width: 34px; }
.big-vu i { border-radius: 2px; background: #0c2412; transition: background-color 0.1s steps(1); }
.big-vu i.lit { background: #2ee35c; box-shadow: 0 0 8px rgb(46 227 92 / 0.6); }
.big-vu i:nth-child(-n + 4).lit { background: #f2d43a; box-shadow: 0 0 8px rgb(242 212 58 / 0.6); }
.big-vu i:nth-child(-n + 2).lit { background: #ff3b30; box-shadow: 0 0 8px rgb(255 59 48 / 0.7); }

.inspector { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 8px 4px; align-items: end; }
.inspector h2 { font-size: clamp(34px, 5vw, 72px); margin: 6px 0; }
.inspector .mono { color: var(--ink-2); }
.desc { color: var(--ink-2); max-width: 44ch; }
.legend { display: grid; gap: 8px; color: var(--ink-2); }
.legend li { display: flex; align-items: center; gap: 8px; }
.legend i { width: 8px; height: 8px; border-radius: 2px; background: var(--line); }
.legend li.on { color: var(--ink); }
.legend li.on i { background: #ffb84a; box-shadow: 0 0 8px #ffb84a; }
.legend span { margin-left: auto; }

.brief { padding: clamp(18px, 2.4vw, 32px); border-radius: 26px; }
.brief h2 { display: flex; align-items: center; gap: 10px; color: var(--ink-2); margin-bottom: 16px; }
.brief h2 span { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 4px; background: var(--ink); color: var(--paper); font-size: 10px; }
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
@media (max-width: 1000px) { .process ol { grid-template-columns: 1fr 1fr; } .process li:nth-child(3) { padding-left: 0; border-left: 0; } }
@media (max-width: 640px) {
  .fields, .process ol, .inspector { grid-template-columns: 1fr; }
  .process li + li { padding-left: 0; border-left: 0; border-top: 1px solid var(--line); }
  .title span + span { -webkit-text-stroke-width: 1.2px; }
  .strip { flex-basis: 78px; height: 400px; }
  .songs { flex-basis: 96px; }
  .master { flex-basis: 190px; }
  .mixer { margin-inline: calc(var(--pad) * -1 + 6px); }
}
</style>
