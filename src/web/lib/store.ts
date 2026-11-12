import { computed, reactive, ref } from 'vue';
import { parseKey } from '../../shared/music';
import type { Beat, CatalogResponse } from '../../shared/types';
import { api } from './api';

export const beats = ref<Beat[]>([]);
export const currency = ref('CZK');
export const servicePayments = ref(false);
export const loaded = ref(false);
export const loadError = ref(false);

let pending: Promise<void> | null = null;
export function loadCatalog(force = false): Promise<void> {
  if (pending && !force) return pending;
  pending = api<CatalogResponse>('/api/beats')
    .then((r) => {
      beats.value = r.beats;
      currency.value = r.currency;
      servicePayments.value = r.servicePayments;
      loadError.value = false;
    })
    .catch(() => { loadError.value = true; })
    .finally(() => { loaded.value = true; });
  return pending;
}

export const filters = reactive({
  q: '',
  genres: [] as string[],
  pc: null as number | null,
  mode: 'any' as 'any' | 'minor' | 'major',
  bpm: null as number | null,
  tolerance: 8,
  sort: 'new' as 'new' | 'bpm' | 'price' | 'title',
});

export function resetFilters(): void {
  Object.assign(filters, { q: '', genres: [], pc: null, mode: 'any', bpm: null, sort: 'new' });
}

export const genres = computed(() => [...new Set(beats.value.map((b) => b.genre))].sort());
export const bpmRange = computed(() => {
  const v = beats.value.map((b) => b.bpm);
  return v.length ? { min: Math.min(...v), max: Math.max(...v) } : { min: 60, max: 180 };
});

export const filtered = computed(() => {
  const q = filters.q.trim().toLowerCase();
  const list = beats.value.filter((b) => {
    if (q && !`${b.title} ${b.genre} ${b.key} ${b.bpm}`.toLowerCase().includes(q)) return false;
    if (filters.genres.length && !filters.genres.includes(b.genre)) return false;
    const k = parseKey(b.key);
    if (filters.pc !== null && k.pc !== filters.pc) return false;
    if (filters.mode === 'minor' && !k.minor) return false;
    if (filters.mode === 'major' && k.minor) return false;
    if (filters.bpm !== null) {
      // půlené / dvojnásobné tempo je hudebně totéž
      const near = [b.bpm, b.bpm * 2, b.bpm / 2].some((v) => Math.abs(v - filters.bpm!) <= filters.tolerance);
      if (!near) return false;
    }
    return true;
  });
  const s = filters.sort;
  if (s === 'bpm') list.sort((a, b) => a.bpm - b.bpm);
  else if (s === 'price') list.sort((a, b) => a.prices.wav - b.prices.wav);
  else if (s === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'cs'));
  return list;
});

export const hasFilters = computed(
  () => !!filters.q || filters.genres.length > 0 || filters.pc !== null || filters.mode !== 'any' || filters.bpm !== null,
);
