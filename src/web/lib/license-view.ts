import { LICENSE_TERMS } from '../../shared/licenses';
import type { LicenseId } from '../../shared/types';
import { lang, t } from './i18n';

const nf = (n: number) => new Intl.NumberFormat(lang.value === 'cs' ? 'cs-CZ' : 'en-US', { notation: n >= 100000 ? 'compact' : 'standard' }).format(n);

/** Řádky srovnání licencí – generované ze stejných čísel jako text smlouvy. */
export function licenseRows(id: LicenseId): { label: string; value: string; strong?: boolean }[] {
  const L = LICENSE_TERMS[id];
  const r = t.value.lic.rows, v = t.value.lic.v;
  const lim = (n: number | null) => (n === null ? v.unlimited : nf(n));
  return [
    { label: r.files, value: L.files.includes('stems') ? v.wavStems : v.wav, strong: true },
    { label: r.term, value: L.termYears ? v.year : v.forever },
    { label: r.renew, value: L.subscription ? v.auto : v.none },
    { label: r.exclusivity, value: L.exclusive ? v.exclusive : v.nonExclusive, strong: L.exclusive },
    { label: r.streams, value: lim(L.streams) },
    { label: r.sales, value: lim(L.sales) },
    { label: r.videos, value: lim(L.videos) },
    { label: r.radio, value: L.radioStations === null ? v.unlimited : v.stations(L.radioStations) },
    { label: r.live, value: v.unlimited },
    { label: r.contentId, value: L.contentId ? v.yes : v.no },
    { label: r.sync, value: L.sync ? v.yes : v.consent },
    { label: r.publishing, value: `${L.publishingProducer} %` },
    { label: r.credit, value: v.creditReq },
  ];
}

export const licenseTag = (id: LicenseId) => ({ wav: t.value.lic.wavTag, stems: t.value.lic.stemsTag, exclusive: t.value.lic.exclusiveTag }[id]);
export const licenseDesc = (id: LicenseId) => ({ wav: t.value.lic.wavDesc, stems: t.value.lic.stemsDesc, exclusive: t.value.lic.exclusiveDesc }[id]);
