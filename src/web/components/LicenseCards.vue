<script setup lang="ts">
import { BRAND } from '../../shared/brand';
import { LICENSE_NAMES, LICENSE_TERMS } from '../../shared/licenses';
import { formatMoney } from '../../shared/music';
import { LICENSE_IDS, type LicenseId } from '../../shared/types';
import { lang, t } from '../lib/i18n';
import { licenseDesc, licenseRows, licenseTag } from '../lib/license-view';
import { currency } from '../lib/store';
import { vTilt } from '../lib/tilt';
import DoodleMark from './DoodleMark.vue';

/**
 * Licence jako dokumenty: listy papíru s děrováním, ohnutým rohem, podpisem a razítkem.
 * Bez `modelValue` = přehled, s ním = výběr licence na detailu beatu (vybraná dostane razítko).
 */
const props = defineProps<{ modelValue?: LicenseId | null; prices?: Record<LicenseId, number>; disabled?: LicenseId[]; compact?: boolean; tilt?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [LicenseId] }>();
const selectable = () => props.modelValue !== undefined;
const price = (id: LicenseId) => props.prices?.[id] ?? LICENSE_TERMS[id].defaultPrice;
const stamp = (id: LicenseId) => (selectable() ? t.value.docs.chosen : LICENSE_TERMS[id].exclusive ? t.value.docs.stampExclusive : t.value.docs.stampLease);
</script>

<template>
  <div class="docs" :class="{ selectable: selectable(), compact }" :role="selectable() ? 'radiogroup' : undefined">
    <component
      :is="selectable() ? 'button' : 'article'" v-for="(id, n) in LICENSE_IDS" :key="id" v-tilt="compact ? 3 : 8" class="doc" :class="[id, { on: modelValue === id }]"
      :role="selectable() ? 'radio' : undefined" :aria-checked="selectable() ? modelValue === id : undefined"
      :disabled="selectable() && disabled?.includes(id) ? true : undefined" @click="selectable() && emit('update:modelValue', id)"
    >
      <span class="sheet tex-paper">
        <span class="fold" aria-hidden="true" />
        <span class="top mono"><span>{{ t.docs.contract }} № 0{{ n + 1 }}</span><span>{{ licenseTag(id) }}</span></span>
        <span class="title display"><mark>{{ LICENSE_NAMES[id] }}</mark></span>
        <span class="price">
          <span v-if="!prices" class="mono dim">{{ t.row.from }}</span>
          <strong>{{ formatMoney(price(id), currency, lang) }}</strong>
          <span class="mono dim">{{ LICENSE_TERMS[id].subscription ? t.beat.perYear : t.beat.once }}</span>
        </span>
        <span v-if="!compact" class="desc">{{ licenseDesc(id) }}</span>
        <span class="rows">
          <span v-for="row in licenseRows(id).slice(0, compact ? 6 : 9)" :key="row.label" class="r">
            <span class="k">{{ row.label }}</span><i aria-hidden="true" /><span class="v" :class="{ strong: row.strong }">{{ row.value }}</span>
          </span>
        </span>
        <span v-if="!compact" class="sign">
          <span class="sig"><DoodleMark kind="squiggle" class="sq" /><span class="mono">{{ BRAND.name }} · {{ t.docs.licensor }}</span></span>
          <span class="sig blank"><span class="line" /><span class="mono">{{ t.docs.licensee }}</span></span>
        </span>
        <span class="stamp boil" aria-hidden="true">{{ stamp(id) }}</span>
        <span v-if="id === 'stems' && !selectable()" class="clip mono">{{ t.beat.popular }}</span>
      </span>
    </component>
  </div>
</template>

<style scoped>
.docs { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(16px, 2.4vw, 34px); padding-block: 10px 18px; }
/* list papíru se stohem dalších pod sebou */
.doc {
  --paper-c: #f6f3ec; --ink-c: #171715; --stamp-c: #d6402c;
  position: relative; display: block; text-align: left; color: var(--ink-c); border-radius: 3px; rotate: var(--rot, 0deg);
  filter: drop-shadow(5px 6px 0 rgb(0 0 0 / 0.1)) drop-shadow(0 26px 30px rgb(0 0 0 / 0.28));
  transition: transform 0.7s var(--ease), rotate 0.45s steps(4), filter 0.4s;
}
.doc:nth-child(1) { --rot: -1.6deg; }
.doc:nth-child(2) { --rot: 0.9deg; }
.doc:nth-child(3) { --rot: -0.6deg; }
.doc:hover { rotate: 0deg; z-index: 2; }
.doc.exclusive { --paper-c: #171715; --ink-c: #f1eee5; --stamp-c: #e0a83a; }
.sheet {
  position: relative; display: grid; gap: 12px; align-content: start; height: 100%; padding: 26px 26px 30px 54px; background-color: var(--paper-c);
  /* ohnutý roh + dvě díry po děrovačce */
  clip-path: polygon(0 0, calc(100% - 34px) 0, 100% 34px, 100% 100%, 0 100%);
  -webkit-mask: radial-gradient(circle 7px at 24px 34%, #0000 96%, #000), radial-gradient(circle 7px at 24px 66%, #0000 96%, #000);
  -webkit-mask-composite: source-in; mask-composite: intersect;
  mask: radial-gradient(circle 7px at 24px 34%, #0000 96%, #000), radial-gradient(circle 7px at 24px 66%, #0000 96%, #000);
  mask-composite: intersect;
}
/* linky jako na formuláři */
.sheet::before { content: ''; position: absolute; left: 42px; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--stamp-c) 45%, transparent); }
.fold { position: absolute; top: 0; right: 0; width: 34px; height: 34px; background: linear-gradient(225deg, transparent 50%, color-mix(in srgb, var(--ink-c) 22%, var(--paper-c)) 50%, color-mix(in srgb, var(--ink-c) 6%, var(--paper-c))); }
.top { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-right: 26px; opacity: 0.6; font-size: 10px; }
.title { font-size: clamp(26px, 2.7vw, 42px); }
.title mark { background: none; color: inherit; background-image: linear-gradient(transparent 58%, color-mix(in srgb, var(--k) 70%, transparent) 58% 92%, transparent 92%); background-size: 0% 100%; background-repeat: no-repeat; transition: background-size 0.35s steps(5); padding-inline: 0.05em; }
.doc:hover .title mark, .doc.on .title mark { background-size: 100% 100%; }
.price { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 1.5px dashed color-mix(in srgb, var(--ink-c) 30%, transparent); }
.price strong { font-size: clamp(22px, 2vw, 30px); font-weight: 750; font-variation-settings: 'wdth' 112; letter-spacing: -0.02em; }
.dim { color: color-mix(in srgb, var(--ink-c) 60%, transparent); }
.desc { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.45; opacity: 0.85; min-height: 4.4em; }
.rows { display: grid; font-family: var(--mono); font-size: 11.5px; }
.r { display: flex; align-items: baseline; gap: 6px; padding: 5px 0; }
.r i { flex: 1; border-bottom: 1.5px dotted color-mix(in srgb, var(--ink-c) 35%, transparent); transform: translateY(-3px); min-width: 12px; }
.k { text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; font-size: 10px; }
.v { text-align: right; font-weight: 600; }
.v.strong { font-weight: 800; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 14px; }
.sig { display: grid; gap: 4px; font-size: 9px; opacity: 0.75; }
.sq { width: 90px; height: 20px; color: var(--ink-c); }
.sig .line { height: 20px; border-bottom: 1.5px solid color-mix(in srgb, var(--ink-c) 55%, transparent); }
/* razítko – „vaří“ na 12 fps */
.stamp {
  position: absolute; right: 18px; bottom: 74px; padding: 6px 12px; border: 3px solid var(--stamp-c); border-radius: 6px; color: var(--stamp-c);
  font-family: var(--mono); font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; rotate: -13deg; opacity: 0.82; pointer-events: none;
  transition: scale 0.25s steps(3), opacity 0.25s steps(3);
}
.doc:hover .stamp { scale: 1.12; opacity: 1; }
.clip { position: absolute; top: -4px; left: 64px; padding: 5px 10px 6px; background: var(--k); color: #0e0e0c; border-radius: 0 0 6px 6px; font-size: 9.5px; box-shadow: 0 3px 0 rgb(0 0 0 / 0.2); }

/* --- výběr na detailu beatu: razítko dostane jen vybraná licence --- */
.selectable .doc { cursor: pointer; }
.selectable .stamp { opacity: 0; scale: 2.2; bottom: 12px; right: auto; left: 31%; font-size: 11px; padding: 4px 9px; }
.selectable .doc.on .stamp { opacity: 0.9; scale: 1; }
.selectable .doc.on { rotate: 0deg; filter: drop-shadow(0 0 0 var(--k)) drop-shadow(0 22px 28px color-mix(in srgb, var(--k) 55%, transparent)); }
.selectable .doc[disabled] { opacity: 0.4; cursor: not-allowed; }
.compact.docs { grid-template-columns: 1fr; gap: 14px; }
.compact .doc { --rot: 0deg; }
.compact .doc:nth-child(odd) { --rot: -0.5deg; }
.compact .doc:nth-child(even) { --rot: 0.4deg; }
.compact .sheet { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr); grid-template-areas: 'a d' 'b d' 'c d'; gap: 4px 26px; padding: 18px 22px 18px 54px; align-items: start; }
.compact .top { grid-area: a; }
.compact .title { grid-area: b; font-size: clamp(22px, 2.2vw, 32px); }
.compact .price { grid-area: c; border: 0; padding: 0; }
.compact .rows { grid-area: d; grid-template-columns: 1fr 1fr; gap: 0 20px; align-self: center; padding-right: 8px; }
@media (max-width: 900px) { .docs { grid-template-columns: 1fr; } .desc { min-height: 0; } }
@media (max-width: 640px) { .compact .sheet { grid-template-columns: 1fr; grid-template-areas: 'a' 'b' 'c' 'd'; } .compact .rows { grid-template-columns: 1fr; } .sheet { padding-left: 50px; padding-right: 18px; } }
</style>
