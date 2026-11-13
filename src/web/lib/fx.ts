/** Fronta kreslených efektů (12 fps). Plní ji kdokoli, kreslí FxLayer. */
export interface Burst { x: number; y: number; f: number; kind: 'pop' | 'hit' | 'launch'; seed: number; r: number }
export const bursts: Burst[] = [];
export const fly = { until: 0 };

export function fxBurst(x: number, y: number, kind: Burst['kind'], r = 14): void {
  bursts.push({ x, y, f: 0, kind, seed: Math.random() * 1000, r });
}

/** Deska právě „letí“ mezi stránkami: zapne stopu za deskou a krokovaný přechod obsahu. */
export function startFlight(ms = 950): void {
  fly.until = performance.now() + ms;
  const root = document.documentElement;
  root.dataset.fly = '1';
  window.setTimeout(() => { if (performance.now() >= fly.until - 20) delete root.dataset.fly; }, ms + 30);
}
