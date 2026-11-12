<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { LICENSE_TERMS } from '../../shared/licenses';
import { ALL_KEYS, DEFAULT_GENRES, formatMoney } from '../../shared/music';
import type { AdminBeat, Beat } from '../../shared/types';
import BeatCover from '../components/BeatCover.vue';
import { ApiError, api } from '../lib/api';
import { analyze, encodeMp3, renderPreview, type Analysis } from '../lib/analysis';

/* Administrace je záměrně jen česky a bez efektů – je to pracovní nástroj. */
const authed = ref<boolean | null>(null);
const configured = ref(true);
const password = ref('');
const loginError = ref('');
const tab = ref<'upload' | 'beats' | 'orders'>('upload');
const beats = ref<AdminBeat[]>([]);
const currency = ref('CZK');
const orders = ref<any[]>([]);
const services = ref<any[]>([]);
const money = (v: number | null) => (v == null ? '—' : formatMoney(v, currency.value, 'cs'));

async function check() {
  const r = await api<{ admin: boolean; configured: boolean }>('/api/admin/me');
  authed.value = r.admin; configured.value = r.configured;
  if (r.admin) {
    await refresh();
    hasTag.value = (await fetch('/api/admin/tag', { credentials: 'same-origin' }).catch(() => null))?.ok ?? false;
  }
}
async function login() {
  loginError.value = '';
  try {
    await api('/api/admin/login', { method: 'POST', json: { password: password.value } });
    password.value = '';
    await check();
  } catch (e) {
    loginError.value = e instanceof ApiError && e.status === 429 ? 'Příliš mnoho pokusů. Zkus to za 15 minut.' : 'Špatné heslo.';
  }
}
async function logout() { await api('/api/admin/logout', { method: 'POST' }); authed.value = false; }
async function refresh() {
  const [b, o] = await Promise.all([
    api<{ beats: AdminBeat[]; currency: string }>('/api/admin/beats'),
    api<{ orders: any[]; services: any[] }>('/api/admin/orders'),
  ]);
  beats.value = b.beats; currency.value = b.currency; orders.value = o.orders; services.value = o.services;
}
onMounted(() => { document.title = 'Admin · LCSH'; void check(); });

/* ------------------------------ nahrání beatu ------------------------------ */
const form = reactive({
  title: '', bpm: 140, key: 'Am', genre: 'Trap',
  wav: LICENSE_TERMS.wav.defaultPrice / 100, stems: LICENSE_TERMS.stems.defaultPrice / 100, exclusive: LICENSE_TERMS.exclusive.defaultPrice / 100,
  publish: true,
});
const wavFile = ref<File | null>(null);
const zipFile = ref<File | null>(null);
const analysis = ref<Analysis | null>(null);
const analyzing = ref(false);
const step = ref('');
const progress = ref(0);
const uploadError = ref('');
const uploaded = ref('');
const hasTag = ref(false);

const previewBeat = computed<Beat | null>(() =>
  analysis.value ? {
    id: `preview-${analysis.value.seed}-${form.key}`, slug: '', title: form.title, bpm: form.bpm, key: form.key, genre: form.genre,
    duration: analysis.value.duration, peaks: analysis.value.peaks, seed: analysis.value.seed,
    prices: { wav: 0, stems: 0, exclusive: 0 }, hasStems: false, status: 'draft', previewUrl: null, createdAt: '',
  } : null,
);

async function pickWav(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  wavFile.value = file; analysis.value = null; uploadError.value = ''; uploaded.value = '';
  if (!file) return;
  analyzing.value = true;
  try {
    const a = await analyze(file);
    analysis.value = a;
    form.title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b\d{2,3}\s?bpm\b/i, '').trim();
    form.bpm = a.bpm; form.key = a.key;
  } catch {
    uploadError.value = 'Soubor se nepodařilo přečíst. Je to platný WAV?';
  } finally {
    analyzing.value = false;
  }
}

async function uploadMultipart(beatId: string, kind: 'wav' | 'stems', file: File, from: number, to: number) {
  const { key, uploadId } = await api<{ key: string; uploadId: string }>('/api/admin/uploads', { method: 'POST', admin: true, json: { beatId, kind } });
  const CHUNK = 16 * 1024 * 1024;
  const parts: { partNumber: number; etag: string }[] = [];
  for (let off = 0, n = 1; off < file.size; off += CHUNK, n++) {
    const q = new URLSearchParams({ key, uploadId, part: String(n) });
    let attempt = 0;
    for (;;) {
      try {
        parts.push(await api(`/api/admin/uploads/part?${q}`, { method: 'PUT', admin: true, body: file.slice(off, off + CHUNK) }));
        break;
      } catch (e) {
        if (++attempt >= 3) throw e;
      }
    }
    progress.value = from + (to - from) * Math.min(1, (off + CHUNK) / file.size);
  }
  await api('/api/admin/uploads/complete', { method: 'POST', admin: true, json: { beatId, kind, key, uploadId, parts, name: file.name } });
}

async function loadTag(): Promise<AudioBuffer | null> {
  try {
    const res = await fetch('/api/admin/tag', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const ctx = new AudioContext();
    try { return await ctx.decodeAudioData(await res.arrayBuffer()); } finally { void ctx.close(); }
  } catch {
    return null;
  }
}

async function submit() {
  if (!wavFile.value || !analysis.value || step.value) return;
  uploadError.value = ''; uploaded.value = ''; progress.value = 0;
  const a = analysis.value;
  try {
    step.value = 'Zakládám beat…';
    const { beat } = await api<{ beat: AdminBeat }>('/api/admin/beats', {
      method: 'POST', admin: true,
      json: {
        title: form.title, bpm: Math.round(form.bpm), key: form.key, genre: form.genre, duration: a.duration, peaks: a.peaks, seed: a.seed,
        prices: { wav: Math.round(form.wav * 100), stems: Math.round(form.stems * 100), exclusive: Math.round(form.exclusive * 100) },
      },
    });
    step.value = 'Vytvářím ukázku (MP3)…';
    const pcm = await renderPreview(a.buffer, await loadTag());
    const mp3 = await encodeMp3(pcm, (p) => (progress.value = 0.05 + p * 0.2));
    await api(`/api/admin/files?beatId=${beat.id}&kind=preview`, { method: 'PUT', admin: true, body: mp3 });
    step.value = 'Nahrávám WAV…';
    await uploadMultipart(beat.id, 'wav', wavFile.value, 0.25, zipFile.value ? 0.6 : 0.97);
    if (zipFile.value) {
      step.value = 'Nahrávám stopy (ZIP)…';
      await uploadMultipart(beat.id, 'stems', zipFile.value, 0.6, 0.97);
    }
    if (form.publish) await api(`/api/admin/beats/${beat.id}`, { method: 'PATCH', admin: true, json: { status: 'active' } });
    progress.value = 1;
    uploaded.value = `„${form.title}“ je ${form.publish ? 'v obchodě' : 'uložen jako koncept'}.`;
    wavFile.value = null; zipFile.value = null; analysis.value = null; form.title = '';
    await refresh();
  } catch (e) {
    uploadError.value = `Nahrání selhalo: ${e instanceof Error ? e.message : 'neznámá chyba'}. Rozpracovaný beat najdeš mezi koncepty.`;
    await refresh();
  } finally {
    step.value = '';
  }
}

/* ------------------------------ správa beatů ------------------------------ */
async function patch(b: AdminBeat, json: Record<string, unknown>) {
  try {
    await api(`/api/admin/beats/${b.id}`, { method: 'PATCH', admin: true, json });
  } catch (e) {
    alert(e instanceof ApiError ? e.message : 'Uložení selhalo');
  }
  await refresh();
}
async function remove(b: AdminBeat) {
  if (!confirm(`Smazat „${b.title}“ včetně souborů? (Beat s objednávkami se jen skryje.)`)) return;
  await api(`/api/admin/beats/${b.id}`, { method: 'DELETE', admin: true });
  await refresh();
}
const num = (e: Event) => Number((e.target as HTMLInputElement).value);
const val = (e: Event) => (e.target as HTMLInputElement).value;

async function pickTag(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  await api('/api/admin/tag', { method: 'PUT', admin: true, body: file, headers: { 'Content-Type': file.type || 'audio/wav' } });
  hasTag.value = true;
}
async function removeTag() { await api('/api/admin/tag', { method: 'DELETE', admin: true }); hasTag.value = false; }
async function setService(id: string, status: string) { await api(`/api/admin/services/${id}`, { method: 'PATCH', admin: true, json: { status } }); await refresh(); }
const date = (s: string) => new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
</script>

<template>
  <div class="admin wrap">
    <template v-if="authed === false">
      <form class="login" @submit.prevent="login">
        <h1 class="display">Admin</h1>
        <p v-if="!configured" class="err">Administrace není nastavená: chybí secret ADMIN_PASSWORD (viz docs/NAVOD.md).</p>
        <label class="field"><span>Heslo</span><input v-model="password" class="input" type="password" autocomplete="current-password" required autofocus /></label>
        <p v-if="loginError" class="err" role="alert">{{ loginError }}</p>
        <button class="btn">Přihlásit</button>
      </form>
    </template>

    <template v-else-if="authed">
      <header class="head">
        <h1 class="display">Admin</h1>
        <nav class="tabs">
          <button class="chip" :aria-pressed="tab === 'upload'" @click="tab = 'upload'">Nahrát beat</button>
          <button class="chip" :aria-pressed="tab === 'beats'" @click="tab = 'beats'">Beaty ({{ beats.length }})</button>
          <button class="chip" :aria-pressed="tab === 'orders'" @click="tab = 'orders'">Objednávky ({{ orders.length + services.length }})</button>
          <button class="chip" @click="logout">Odhlásit</button>
        </nav>
      </header>

      <section v-if="tab === 'upload'" class="upload">
        <form class="panel" @submit.prevent="submit">
          <label class="drop" :class="{ has: wavFile }">
            <input type="file" accept=".wav,audio/wav,audio/x-wav" @change="pickWav" />
            <strong>{{ wavFile ? wavFile.name : '1 · Vyber WAV' }}</strong>
            <span class="mono dim">{{ analyzing ? 'Analyzuji zvuk…' : wavFile ? `${(wavFile.size / 1048576).toFixed(1)} MB` : 'Z něj vznikne artwork, ukázka i návrh BPM a tóniny' }}</span>
          </label>
          <label class="drop small" :class="{ has: zipFile }">
            <input type="file" accept=".zip,application/zip" @change="zipFile = ($event.target as HTMLInputElement).files?.[0] ?? null" />
            <strong>{{ zipFile ? zipFile.name : '2 · ZIP se stopami (volitelné)' }}</strong>
            <span class="mono dim">{{ zipFile ? `${(zipFile.size / 1048576).toFixed(1)} MB` : 'Bez něj půjde koupit jen WAV Lease' }}</span>
          </label>

          <div class="fields">
            <label class="field wide"><span>Název</span><input v-model="form.title" class="input" required maxlength="80" /></label>
            <label class="field"><span>BPM {{ analysis ? '(odhad)' : '' }}
              <button type="button" class="mini" @click="form.bpm = Math.round(form.bpm / 2)">÷2</button><button type="button" class="mini" @click="form.bpm = Math.min(300, form.bpm * 2)">×2</button></span>
              <input v-model.number="form.bpm" class="input" type="number" min="30" max="300" required /></label>
            <label class="field"><span>Tónina {{ analysis ? '(odhad)' : '' }}</span>
              <select v-model="form.key" class="input"><option v-for="k in ALL_KEYS" :key="k" :value="k">{{ k.replace(/m$/, ' moll').replace(/^([A-G]#?)$/, '$1 dur') }}</option></select>
            </label>
            <label class="field wide"><span>Žánr</span><input v-model="form.genre" class="input" list="genres" required maxlength="40" /><datalist id="genres"><option v-for="g in DEFAULT_GENRES" :key="g" :value="g" /></datalist></label>
            <label class="field"><span>WAV Lease / rok ({{ currency }})</span><input v-model.number="form.wav" class="input" type="number" min="0" step="1" required /></label>
            <label class="field"><span>STEMS Lease / rok</span><input v-model.number="form.stems" class="input" type="number" min="0" step="1" required /></label>
            <label class="field"><span>Exclusive</span><input v-model.number="form.exclusive" class="input" type="number" min="0" step="1" required /></label>
            <label class="check"><input v-model="form.publish" type="checkbox" /> Rovnou zveřejnit</label>
          </div>

          <div v-if="step" class="progress"><div :style="{ width: `${progress * 100}%` }" /><span class="mono">{{ step }} {{ Math.round(progress * 100) }} %</span></div>
          <p v-if="uploadError" class="err" role="alert">{{ uploadError }}</p>
          <p v-if="uploaded" class="ok" role="status">✓ {{ uploaded }}</p>
          <button class="btn" :disabled="!analysis || !!step">{{ step ? 'Nahrávám…' : 'Nahrát do obchodu' }}</button>
        </form>

        <aside class="side">
          <div class="art">
            <BeatCover v-if="previewBeat" :key="previewBeat.id" :beat="previewBeat" />
            <div v-else class="ph mono dim">artwork se vygeneruje ze zvuku</div>
          </div>
          <p class="mono dim">Barva = tónina · drážka = waveform · vzor = otisk zvuku. Změnou tóniny se změní barva.</p>
          <div class="tag">
            <h2 class="mono">Hlasová značka (tag)</h2>
            <p class="dim">Volitelné. Přimíchá se do veřejných ukázek každých ~24 s. Prodávané soubory zůstávají čisté.</p>
            <label class="btn ghost small">{{ hasTag ? 'Nahradit tag' : 'Nahrát tag' }}<input type="file" accept="audio/*" hidden @change="pickTag" /></label>
            <button v-if="hasTag" class="btn ghost small" type="button" @click="removeTag">Odebrat</button>
          </div>
        </aside>
      </section>

      <section v-else-if="tab === 'beats'" class="table">
        <table>
          <thead><tr><th /><th>Název</th><th>BPM</th><th>Tónina</th><th>Žánr</th><th>WAV</th><th>STEMS</th><th>EXCL.</th><th>Soubory</th><th>Stav</th><th /></tr></thead>
          <tbody>
            <tr v-for="b in beats" :key="b.id">
              <td class="cv"><BeatCover :beat="b" /></td>
              <td><input class="cell wide" :value="b.title" @change="patch(b, { title: val($event) })" /></td>
              <td><input class="cell n" type="number" :value="b.bpm" @change="patch(b, { bpm: num($event) })" /></td>
              <td><select class="cell" :value="b.key" @change="patch(b, { key: val($event) })"><option v-for="k in ALL_KEYS" :key="k">{{ k }}</option></select></td>
              <td><input class="cell" :value="b.genre" @change="patch(b, { genre: val($event) })" /></td>
              <td v-for="id in (['wav', 'stems', 'exclusive'] as const)" :key="id"><input class="cell n" type="number" :value="b.prices[id] / 100" @change="patch(b, { prices: { [id]: Math.round(num($event) * 100) } })" /></td>
              <td class="mono files"><span :class="{ on: b.hasPreview }">MP3</span><span :class="{ on: b.hasWav }">WAV</span><span :class="{ on: b.hasStems }">ZIP</span></td>
              <td><select class="cell" :value="b.status" @change="patch(b, { status: val($event) })"><option value="draft">koncept</option><option value="active">v obchodě</option><option value="sold">prodáno</option></select></td>
              <td><button class="mono del" @click="remove(b)">smazat</button></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!beats.length" class="dim">Zatím žádné beaty.</p>
      </section>

      <section v-else class="table">
        <h2 class="mono">Licence</h2>
        <table>
          <thead><tr><th>Datum</th><th>Č.</th><th>Beat</th><th>Licence</th><th>Kupující</th><th>Částka</th><th>Platba</th><th>Stav licence</th><th>Do</th></tr></thead>
          <tbody>
            <tr v-for="o in orders.filter((x) => x.kind === 'license')" :key="o.id" :class="{ warn: o.needs_review }">
              <td>{{ date(o.created_at) }}</td><td>{{ o.order_number }}{{ o.is_test ? ' (test)' : '' }}</td><td>{{ o.beat_title }}</td><td class="mono">{{ o.license }}</td>
              <td>{{ o.buyer_name }}<br /><span class="dim">{{ o.buyer_email }}{{ o.artist_name ? ` · ${o.artist_name}` : '' }}</span></td>
              <td>{{ money(o.total_minor) }}</td><td class="mono">{{ o.payment_status }}</td><td class="mono">{{ o.license_status }}</td>
              <td>{{ o.term_ends_at ? date(o.term_ends_at) : '∞' }}<div v-if="o.note" class="note">{{ o.note }}</div></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!orders.length" class="dim">Zatím žádné objednávky.</p>

        <h2 class="mono">Mix & Master</h2>
        <table>
          <thead><tr><th>Datum</th><th>Služba</th><th>Klient</th><th>Zadání</th><th>Cena</th><th>Stav</th></tr></thead>
          <tbody>
            <tr v-for="s in services" :key="s.id">
              <td>{{ date(s.created_at) }}</td><td class="mono">{{ s.service }} ×{{ s.songs }}<br />{{ JSON.parse(s.addons).join(', ') }}</td>
              <td>{{ s.name }}<br /><a class="dim" :href="`mailto:${s.email}`">{{ s.email }}</a></td>
              <td class="brief"><strong>{{ s.project }}</strong> <a v-if="s.files_url" :href="s.files_url" target="_blank" rel="noopener noreferrer">soubory ↗</a> <a v-if="s.reference_url" :href="s.reference_url" target="_blank" rel="noopener noreferrer">reference ↗</a><p class="dim">{{ s.notes }}</p></td>
              <td>{{ money(s.price_minor) }}</td>
              <td><select class="cell" :value="s.status" @change="setService(s.id, val($event))"><option value="new">nová</option><option value="paid">zaplaceno</option><option value="in_progress">pracuji</option><option value="done">hotovo</option><option value="cancelled">zrušeno</option></select></td>
            </tr>
          </tbody>
        </table>
        <p v-if="!services.length" class="dim">Zatím žádné poptávky.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin { padding-top: 96px; padding-bottom: 80px; min-height: 100vh; }
.login { max-width: 380px; margin: 12vh auto 0; display: grid; gap: 18px; }
h1 { font-size: clamp(40px, 6vw, 84px); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 28px; }
.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.upload { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.panel { display: grid; gap: 16px; }
.drop { position: relative; display: grid; gap: 6px; padding: 30px 22px; border-radius: 16px; border: 1.5px dashed var(--line); cursor: pointer; transition: border-color 0.2s, background-color 0.2s; }
.drop:hover, .drop.has { border-color: var(--ink); background: var(--line-2); }
.drop.small { padding: 18px 22px; }
.drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.drop strong { font-size: 19px; font-variation-settings: 'wdth' 112; overflow-wrap: anywhere; }
.fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.wide { grid-column: 1 / -1; }
.mini { margin-left: 6px; padding: 0 6px; border-radius: 4px; box-shadow: inset 0 0 0 1px var(--line); font: inherit; }
.fields .field:nth-child(2), .fields .field:nth-child(3) { grid-column: span 1; }
select.input { appearance: auto; }
.check { display: flex; gap: 8px; align-items: center; grid-column: 1 / -1; }
.progress { position: relative; height: 34px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); overflow: hidden; }
.progress div { position: absolute; inset: 0 auto 0 0; background: var(--k); transition: width 0.3s; }
.progress span { position: relative; display: grid; place-items: center; height: 100%; color: var(--ink); mix-blend-mode: difference; color: #fff; }
.err { color: #d6402c; font-weight: 600; }
.ok { color: #1a8a4a; font-weight: 600; }
.side { display: grid; gap: 14px; position: sticky; top: 90px; }
.art { aspect-ratio: 1; max-width: 340px; }
.ph { height: 100%; border-radius: 50%; border: 1.5px dashed var(--line); display: grid; place-items: center; text-align: center; padding: 30px; }
.tag { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding-top: 16px; border-top: 1px solid var(--line); }
.tag h2, .tag p { width: 100%; }
.tag label { cursor: pointer; }
.table { overflow-x: auto; display: grid; gap: 14px; }
.table h2 { margin-top: 18px; color: var(--ink-2); }
table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 900px; }
th { text-align: left; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-2); font-weight: 500; padding: 8px 6px; border-bottom: 1px solid var(--line); }
td { padding: 6px; border-bottom: 1px solid var(--line-2); vertical-align: middle; }
.cv { width: 44px; }
.cell { width: 100%; min-width: 70px; height: 34px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; box-shadow: inset 0 0 0 1px var(--line-2); }
.cell:focus { outline: none; box-shadow: inset 0 0 0 1.5px var(--ink); }
.cell.wide { min-width: 170px; }
.cell.n { min-width: 76px; }
.files span { margin-right: 6px; opacity: 0.25; }
.files span.on { opacity: 1; color: #1a8a4a; }
.del { color: #d6402c; }
.warn { background: rgb(255 204 0 / 0.16); }
.note { color: #d6402c; font-size: 12px; max-width: 260px; }
.brief { max-width: 340px; }
.brief a { text-decoration: underline; margin-right: 8px; }
@media (max-width: 900px) { .upload { grid-template-columns: 1fr; } .side { position: static; } .fields { grid-template-columns: 1fr 1fr; } }
</style>
