<script setup lang="ts">
import { LICENSE_NAMES, LICENSE_TERMS } from '../../shared/licenses';
import { formatMoney } from '../../shared/music';
import { LICENSE_IDS, type LicenseId } from '../../shared/types';
import { lang, t } from '../lib/i18n';
import { licenseDesc, licenseRows, licenseTag } from '../lib/license-view';
import { currency } from '../lib/store';

/** Bez `modelValue` = přehled (úvodní stránka), s ním = výběr licence na detailu beatu. */
const props = defineProps<{ modelValue?: LicenseId | null; prices?: Record<LicenseId, number>; disabled?: LicenseId[]; compact?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [LicenseId] }>();
const selectable = () => props.modelValue !== undefined;
const price = (id: LicenseId) => props.prices?.[id] ?? LICENSE_TERMS[id].defaultPrice;
</script>

<template>
  <div class="cards" :class="{ selectable: selectable(), compact }" :role="selectable() ? 'radiogroup' : undefined">
    <component
      :is="selectable() ? 'button' : 'article'" v-for="id in LICENSE_IDS" :key="id" class="card" :class="[id, { on: modelValue === id }]"
      :role="selectable() ? 'radio' : undefined" :aria-checked="selectable() ? modelValue === id : undefined"
      :disabled="selectable() && disabled?.includes(id) ? true : undefined" @click="selectable() && emit('update:modelValue', id)"
    >
      <span class="notch l" aria-hidden="true" /><span class="notch r" aria-hidden="true" />
      <header>
        <span class="mono tag">{{ licenseTag(id) }}</span>
        <span v-if="id === 'stems'" class="mono star">{{ t.beat.popular }}</span>
      </header>
      <h3 class="display">{{ LICENSE_NAMES[id] }}</h3>
      <p class="price">
        <span v-if="!prices" class="mono dim">{{ t.row.from }}</span>
        <strong>{{ formatMoney(price(id), currency, lang) }}</strong>
        <span class="mono dim">{{ LICENSE_TERMS[id].subscription ? t.beat.perYear : t.beat.once }}</span>
      </p>
      <p v-if="!compact" class="desc">{{ licenseDesc(id) }}</p>
      <dl>
        <div v-for="row in licenseRows(id).slice(0, compact ? 6 : 9)" :key="row.label">
          <dt class="mono">{{ row.label }}</dt><dd :class="{ strong: row.strong }">{{ row.value }}</dd>
        </div>
      </dl>
      <span v-if="selectable()" class="radio" aria-hidden="true" />
    </component>
  </div>
</template>

<style scoped>
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.card {
  position: relative; text-align: left; padding: 22px 22px 24px; border-radius: 16px; display: grid; gap: 12px; align-content: start;
  background: color-mix(in srgb, var(--paper-2) 60%, transparent); box-shadow: inset 0 0 0 1px var(--line);
  transition: transform 0.5s var(--ease), box-shadow 0.3s, background-color 0.4s, color 0.4s;
}
.card.exclusive { background: var(--ink); color: var(--paper); box-shadow: none; }
.card.exclusive .dim, .card.exclusive dt { color: color-mix(in srgb, var(--paper) 62%, transparent); }
.card.exclusive dl div { border-color: color-mix(in srgb, var(--paper) 18%, transparent); }
/* výřezy jako na vstupence */
.notch { position: absolute; top: 148px; width: 18px; height: 18px; border-radius: 50%; background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); transition: background-color 0.7s var(--ease); }
.notch.l { left: -9px; clip-path: inset(0 0 0 50%); }
.notch.r { right: -9px; clip-path: inset(0 50% 0 0); }
.card.exclusive .notch { box-shadow: none; }
.compact .notch { display: none; }
header { display: flex; justify-content: space-between; gap: 8px; align-items: center; min-height: 22px; }
.tag { opacity: 0.7; }
.star { padding: 3px 8px; border-radius: 999px; background: var(--k); color: #0e0e0c; font-size: 9.5px; }
h3 { font-size: clamp(26px, 2.6vw, 40px); }
.price { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding-bottom: 14px; border-bottom: 1px dashed var(--line); }
.card.exclusive .price { border-color: color-mix(in srgb, var(--paper) 25%, transparent); }
.price strong { font-size: clamp(22px, 2vw, 30px); font-weight: 750; font-variation-settings: 'wdth' 112; letter-spacing: -0.02em; }
.desc { font-size: 14.5px; opacity: 0.78; min-height: 4.4em; }
dl { margin: 0; display: grid; }
dl div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px solid var(--line-2); font-size: 13.5px; }
dt { color: var(--ink-2); font-size: 10px; align-self: center; }
dd { margin: 0; text-align: right; font-weight: 550; }
dd.strong { font-weight: 750; }
.selectable .card { cursor: pointer; padding-right: 48px; }
.selectable .card:hover { transform: translateY(-3px); }
.selectable .card.on { box-shadow: inset 0 0 0 2px var(--k), 0 22px 50px -28px var(--k); transform: translateY(-3px); }
.selectable .card[disabled] { opacity: 0.38; cursor: not-allowed; transform: none; }
.radio { position: absolute; top: 20px; right: 20px; width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px currentColor; opacity: 0.5; transition: opacity 0.2s; }
.card.on .radio { opacity: 1; background: radial-gradient(circle, var(--k) 0 42%, transparent 46%); box-shadow: inset 0 0 0 1.5px var(--k); }
.selectable header { padding-right: 0; }
/* kompaktní výběr na detailu beatu: licence pod sebou, údaje vpravo */
.compact.cards { grid-template-columns: 1fr; gap: 10px; }
.compact .card { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr); grid-template-areas: 'a d' 'b d' 'c d'; gap: 6px 28px; padding: 18px 52px 18px 20px; align-items: start; }
.compact header { grid-area: a; }
.compact h3 { grid-area: b; font-size: clamp(22px, 2.2vw, 32px); }
.compact .price { grid-area: c; border: 0; padding: 0; }
.compact dl { grid-area: d; grid-template-columns: 1fr 1fr; gap: 0 22px; align-self: center; }
.compact dl div { padding: 5px 0; font-size: 13px; }
.compact dl div:nth-child(-n + 2) { border-top: 0; }
@media (max-width: 640px) { .compact .card { grid-template-columns: 1fr; grid-template-areas: 'a' 'b' 'c' 'd'; } .compact dl { grid-template-columns: 1fr; } .compact dl div:nth-child(2) { border-top: 1px solid var(--line-2); } }
@media (max-width: 900px) { .cards { grid-template-columns: 1fr; } .notch { display: none; } .desc { min-height: 0; } }
</style>
