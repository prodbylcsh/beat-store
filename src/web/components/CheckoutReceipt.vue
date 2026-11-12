<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { BRAND } from '../../shared/brand';
import { LICENSE_NAMES, LICENSE_TERMS } from '../../shared/licenses';
import { formatMoney, keyLabel } from '../../shared/music';
import type { Beat, LicenseId } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { lang, t } from '../lib/i18n';
import { currency } from '../lib/store';

const props = defineProps<{ beat: Beat; license: LicenseId }>();
const emit = defineEmits<{ close: [] }>();

const artist = ref('');
const agree1 = ref(false);
const agree2 = ref(false);
const busy = ref(false);
const error = ref('');
const sub = computed(() => LICENSE_TERMS[props.license].subscription);
const price = computed(() => formatMoney(props.beat.prices[props.license], currency.value, lang.value));
const now = new Intl.DateTimeFormat(lang.value === 'cs' ? 'cs-CZ' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
// dekorativní čárový kód z ID beatu
const bars = computed(() => [...props.beat.id.replace(/-/g, '')].map((c) => (parseInt(c, 16) % 4) + 1));

async function pay() {
  if (!agree1.value || !agree2.value || busy.value) return;
  busy.value = true; error.value = '';
  try {
    const r = await api<{ url: string }>('/api/checkout', {
      method: 'POST',
      json: { beatId: props.beat.id, license: props.license, artistName: artist.value, consent: true, lang: lang.value },
    });
    window.location.assign(r.url);
  } catch (e) {
    const code = e instanceof ApiError ? e.code : '';
    const errs = t.value.receipt.err as Record<string, string>;
    error.value = errs[code] ?? errs.generic;
    busy.value = false;
  }
}
const esc = (e: KeyboardEvent) => e.key === 'Escape' && emit('close');
onMounted(() => { window.addEventListener('keydown', esc); document.documentElement.style.overflow = 'hidden'; });
onUnmounted(() => { window.removeEventListener('keydown', esc); document.documentElement.style.overflow = ''; });
</script>

<template>
  <div class="veil" @click.self="emit('close')">
    <div class="slot" aria-hidden="true" />
    <form class="paper" role="dialog" aria-modal="true" :aria-label="t.receipt.title" @submit.prevent="pay">
      <button type="button" class="close mono" @click="emit('close')">{{ t.receipt.close }} ×</button>
      <header>
        <strong class="brand">{{ BRAND.name }}®</strong>
        <span>{{ t.receipt.title }} · {{ now }}</span>
      </header>
      <div class="dash" />
      <dl>
        <div><dt>{{ t.receipt.item }}</dt><dd>{{ beat.title }}</dd></div>
        <div><dt /><dd class="sm">{{ beat.bpm }} BPM · {{ keyLabel(beat.key, lang) }} · {{ beat.genre }}</dd></div>
        <div><dt>{{ t.receipt.license }}</dt><dd>{{ LICENSE_NAMES[license] }}</dd></div>
        <div><dt>{{ t.receipt.term }}</dt><dd>{{ sub ? t.receipt.yearly : t.receipt.forever }}</dd></div>
      </dl>
      <div class="dash" />
      <div class="total"><span>{{ t.receipt.total }}</span><strong>{{ price }}<small v-if="sub"> {{ t.beat.perYear }}</small></strong></div>
      <div class="dash" />
      <p class="note">{{ sub ? t.receipt.renew : t.receipt.onceNote }}</p>

      <label class="f"><span>{{ t.receipt.artist }}</span>
        <input v-model="artist" maxlength="80" :placeholder="t.receipt.artistPh" autocomplete="nickname" />
      </label>
      <label class="check"><input v-model="agree1" type="checkbox" required /><i aria-hidden="true" />
        <span>{{ t.receipt.agree1a }} <a href="/licence" target="_blank">{{ t.receipt.agree1b }}</a> {{ t.receipt.agree1c }} <a href="/podminky" target="_blank">{{ t.receipt.agree1d }}</a>.</span>
      </label>
      <label class="check"><input v-model="agree2" type="checkbox" required /><i aria-hidden="true" /><span>{{ t.receipt.agree2 }}</span></label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="btn pay" :disabled="!agree1 || !agree2 || busy">{{ busy ? '…' : `${t.receipt.pay} ${price}` }} <span class="arr">→</span></button>
      <p class="note">{{ t.receipt.tax }}</p>
      <div class="barcode" aria-hidden="true"><i v-for="(w, i) in bars" :key="i" :style="{ width: `${w}px` }" /></div>
      <p class="thanks">*** {{ t.receipt.thanks }} ***</p>
    </form>
  </div>
</template>

<style scoped>
.veil { position: fixed; inset: 0; z-index: 120; background: rgb(0 0 0 / 0.55); backdrop-filter: blur(6px); display: grid; justify-items: center; align-items: start; overflow-y: auto; padding: 0 12px 40px; animation: fade 0.3s; }
@keyframes fade { from { opacity: 0; } }
/* štěrbina tiskárny, ze které účtenka vyjíždí */
.slot { position: sticky; top: 0; z-index: 2; width: min(440px, 100%); height: 16px; background: #111; border-radius: 0 0 10px 10px; box-shadow: 0 6px 14px rgb(0 0 0 / 0.5); }
.paper {
  --p: #f6f3ec; position: relative; width: min(400px, calc(100% - 24px)); margin-top: -4px; padding: 30px 26px 34px; background: var(--p); color: #111;
  font-family: var(--mono); font-size: 12.5px; line-height: 1.5; display: grid; gap: 12px;
  animation: print 0.9s steps(14, end) both; transform-origin: top;
  mask: conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 14px 51% repeat-x, linear-gradient(#000 0 0) top / 100% calc(100% - 7px) no-repeat;
}
@keyframes print { from { clip-path: inset(0 0 100% 0); transform: translateY(-30px); } to { clip-path: inset(0 0 0 0); transform: none; } }
.close { position: absolute; top: 10px; right: 12px; color: #777; font-size: 10px; }
.close:hover { color: #111; }
header { display: grid; justify-items: center; gap: 2px; text-align: center; color: #555; padding-top: 6px; }
.brand { font-family: var(--sans); font-size: 30px; font-weight: 800; font-variation-settings: 'wdth' 125; letter-spacing: -0.03em; color: #111; }
.dash { border-top: 1.5px dashed #111; opacity: 0.35; }
dl { margin: 0; display: grid; gap: 3px; }
dl div { display: flex; justify-content: space-between; gap: 14px; }
dt { color: #777; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.06em; }
dd { margin: 0; text-align: right; font-weight: 600; }
dd.sm { font-weight: 400; color: #666; font-size: 11px; }
.total { display: flex; justify-content: space-between; align-items: baseline; text-transform: uppercase; }
.total strong { font-size: 24px; letter-spacing: -0.03em; }
.total small { font-size: 11px; font-weight: 400; }
.note { color: #666; font-size: 11px; }
.f { display: grid; gap: 5px; }
.f span { text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; color: #777; }
.f input { height: 40px; padding: 0 10px; border: 1.5px solid #111; border-radius: 0; background: transparent; color: #111; font: inherit; }
.f input:focus { outline: 2px solid #111; outline-offset: 2px; }
.check { display: grid; grid-template-columns: 18px 1fr; gap: 10px; cursor: pointer; font-size: 11.5px; }
.check input { position: absolute; opacity: 0; }
.check i { width: 18px; height: 18px; border: 1.5px solid #111; margin-top: 1px; display: grid; place-items: center; font-style: normal; }
.check input:checked + i::after { content: '✕'; font-size: 13px; line-height: 1; }
.check input:focus-visible + i { outline: 2px solid #111; outline-offset: 2px; }
.check a { text-decoration: underline; text-underline-offset: 2px; }
.pay { width: 100%; background: #111; color: #f6f3ec; font-family: var(--sans); margin-top: 4px; }
.pay:hover { background: var(--k); color: #111; }
.error { color: #b3261e; font-weight: 600; }
.barcode { display: flex; gap: 2px; height: 38px; justify-content: center; margin-top: 6px; }
.barcode i { background: #111; height: 100%; }
.barcode i:nth-child(3n) { background: transparent; }
.thanks { text-align: center; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.08em; color: #555; padding-bottom: 6px; }
</style>
