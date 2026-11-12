import { describe, expect, it } from 'vitest';
import { LICENSE_TERMS, buildLicense } from '../src/shared/licenses';
import { beatPalette, formatMoney, isValidKey, keyHue, slugify } from '../src/shared/music';
import { computePeaks, peaksFromBase64, peaksToBase64, seedFromPeaks } from '../src/shared/peaks';
import { servicePrice } from '../src/shared/services';

describe('licence', () => {
  it.each(['wav', 'stems', 'exclusive'] as const)('%s: text obsahuje limity z tabulky a žádné undefined', (id) => {
    for (const lang of ['cs', 'en'] as const) {
      const doc = buildLicense(id, lang, { licensee: 'Jan Novák', beatTitle: 'Beat', date: '1. 1. 2027', price: '690 Kč' });
      const text = JSON.stringify(doc);
      expect(text).not.toMatch(/undefined|NaN|\[object/);
      expect(doc.sections).toHaveLength(14);
      expect(text).toContain('Jan Novák');
      const t = LICENSE_TERMS[id];
      if (t.streams) expect(text.replace(/[\s, ]/g, '')).toContain(String(t.streams));
    }
  });
  it('lease je předplatné na 1 rok, exclusive ne', () => {
    expect(LICENSE_TERMS.wav.subscription && LICENSE_TERMS.stems.subscription).toBe(true);
    expect(LICENSE_TERMS.exclusive.subscription).toBe(false);
    expect(JSON.stringify(buildLicense('exclusive', 'cs'))).toContain('§ 2360');
  });
});

describe('hudba a ceny', () => {
  it('klíče, slug, měna', () => {
    expect(isValidKey('F#m')).toBe(true);
    expect(isValidKey('H')).toBe(false);
    expect(slugify('Noční linka č. 2!')).toBe('nocni-linka-c-2');
    expect(formatMoney(69000, 'CZK', 'cs').replace(/\s/g, ' ')).toBe('690 Kč');
    expect(formatMoney(69050, 'CZK', 'cs').replace(/\s/g, ' ')).toBe('690,50 Kč');
    expect(keyHue('C')).not.toBe(keyHue('G'));
    const p = beatPalette('Am', 5);
    for (const c of [p.main, p.alt, p.deep]) for (const v of [c.r, c.g, c.b]) expect(v >= 0 && v <= 1).toBe(true);
  });
  it('ceník služeb: sleva a expres', () => {
    expect(servicePrice('master', 1, [])).toBe(120000);
    expect(servicePrice('master', 3, [])).toBe(324000);
    expect(servicePrice('mix', 1, ['express'])).toBe(480000);
    expect(servicePrice('mix', 99, [])).toBe(servicePrice('mix', 12, []));
  });
  it('obálka waveformu je deterministická a jde zakódovat', () => {
    const x = new Float32Array(44100).map((_, i) => Math.sin(i / 10) * (i / 44100));
    const p = computePeaks([x], 256);
    expect(p[255]).toBeGreaterThan(p[5]);
    expect(peaksFromBase64(peaksToBase64(p))).toEqual(p);
    expect(seedFromPeaks(p)).toBe(seedFromPeaks(computePeaks([x], 256)));
  });
});
