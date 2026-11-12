<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { LICENSE_NAMES, buildLicense } from '../../shared/licenses';
import { LICENSE_IDS, type LicenseId } from '../../shared/types';
import LicenseCards from '../components/LicenseCards.vue';
import { lang, t } from '../lib/i18n';
import { licenseRows } from '../lib/license-view';

const route = useRoute();
const hash = route.hash.slice(1);
const tab = ref<LicenseId>(LICENSE_IDS.includes(hash as LicenseId) ? (hash as LicenseId) : 'wav');
const doc = computed(() => buildLicense(tab.value, lang.value));
const rows = computed(() => licenseRows('wav').map((r, i) => ({ label: r.label, values: LICENSE_IDS.map((id) => licenseRows(id)[i].value) })));
const texts = ref<HTMLElement | null>(null);
onMounted(async () => {
  document.title = `${t.value.lic.title} · LCSH`;
  if (hash) { await nextTick(); texts.value?.scrollIntoView({ behavior: 'smooth' }); }
});
</script>

<template>
  <div class="lic wrap">
    <header class="top">
      <p class="mono eyebrow">{{ t.nav.licenses }}</p>
      <h1 class="display title">{{ t.lic.title }}</h1>
      <p class="sub">{{ t.lic.sub }}</p>
    </header>

    <LicenseCards />

    <section class="section how">
      <h2 class="display h2">{{ t.lic.how }}</h2>
      <ol><li v-for="(p, i) in t.lic.howText" :key="i"><span class="mono">{{ String(i + 1).padStart(2, '0') }}</span><p>{{ p }}</p></li></ol>
    </section>

    <section class="table-wrap">
      <table>
        <thead><tr><th /><th v-for="id in LICENSE_IDS" :key="id" class="display">{{ LICENSE_NAMES[id] }}</th></tr></thead>
        <tbody><tr v-for="r in rows" :key="r.label"><th class="mono">{{ r.label }}</th><td v-for="(v, i) in r.values" :key="i">{{ v }}</td></tr></tbody>
      </table>
    </section>

    <section ref="texts" class="section texts">
      <div class="texts-head">
        <h2 class="display h2">{{ t.lic.texts }}</h2>
        <div class="tabs" role="tablist">
          <button v-for="id in LICENSE_IDS" :key="id" role="tab" class="chip" :aria-selected="tab === id" :aria-pressed="tab === id" @click="tab = id">{{ LICENSE_NAMES[id] }}</button>
        </div>
      </div>
      <p class="mono dim note">{{ t.lic.note }}</p>
      <article class="contract">
        <h3>{{ doc.title }}</h3>
        <p class="mono dim">{{ doc.subtitle }}</p>
        <p v-for="p in doc.parties" :key="p" class="party">{{ p }}</p>
        <template v-for="s in doc.sections" :key="s.h">
          <h4>{{ s.h }}</h4>
          <p v-for="p in s.p" :key="p">{{ p }}</p>
        </template>
      </article>
    </section>
  </div>
</template>

<style scoped>
.lic { padding-top: clamp(96px, 13vh, 150px); }
.top { display: grid; gap: 20px; margin-bottom: clamp(32px, 5vw, 64px); }
.title { font-size: clamp(64px, 15vw, 270px); margin-left: -0.045em; }
.sub { max-width: 48ch; font-size: clamp(16px, 1.4vw, 20px); color: var(--ink-2); }
.how { display: grid; grid-template-columns: 1fr 1.4fr; gap: 32px; padding-bottom: clamp(32px, 5vw, 64px); }
.how ol { list-style: none; margin: 0; padding: 0; display: grid; }
.how li { display: grid; grid-template-columns: 40px 1fr; gap: 12px; padding: 18px 0; border-top: 1px solid var(--line); font-size: clamp(16px, 1.35vw, 19px); }
.how li span { color: var(--k); padding-top: 4px; }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; }
table { width: 100%; border-collapse: collapse; min-width: 640px; }
th, td { padding: 13px 18px; text-align: left; border-bottom: 1px solid var(--line-2); font-size: 14.5px; }
thead th { font-size: clamp(16px, 1.7vw, 24px); border-bottom: 1px solid var(--line); padding-block: 18px; }
tbody th { color: var(--ink-2); font-weight: 500; width: 26%; }
tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
td:last-child, thead th:last-child { background: color-mix(in srgb, var(--k) 12%, transparent); font-weight: 650; }
.texts-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 14px; }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.note { max-width: 70ch; margin-bottom: 22px; }
.contract { max-width: 78ch; padding: clamp(22px, 4vw, 56px); border-radius: 6px; background: #f8f6f1; color: #151513; font-family: Georgia, 'Times New Roman', serif; font-size: 15.5px; line-height: 1.62; box-shadow: 0 30px 80px -40px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(0 0 0 / 0.06); }
.contract h3 { font-family: var(--sans); font-size: clamp(22px, 2.4vw, 30px); font-weight: 750; font-variation-settings: 'wdth' 110; letter-spacing: -0.02em; margin-bottom: 6px; }
.contract .mono { color: #666; margin-bottom: 22px; }
.contract h4 { font-family: var(--sans); font-size: 15px; font-weight: 700; margin: 26px 0 8px; }
.contract p { margin-bottom: 9px; }
.party { color: #333; }
@media (max-width: 900px) { .how { grid-template-columns: 1fr; } }
</style>
