import type { Directive } from 'vue';

const mouseOnly = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * v-tilt="8": prvek se chová jako 3D deska skla – naklání se za kurzorem a odlesk jede s ním.
 * Nastavuje CSS proměnné --rx, --ry (náklon) a --px, --py (poloha odlesku).
 */
export const vTilt: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    el.classList.add('tilt');
    if (!mouseOnly) return;
    const max = binding.value ?? 8;
    let raf = 0, ex = 0, ey = 0;
    const apply = () => {
      raf = 0;
      const b = el.getBoundingClientRect();
      const nx = (ex - b.left) / b.width, ny = (ey - b.top) / b.height;
      // u širokých prvků tlum náklon, ať se okraje nehoupou o desítky px
      const damp = Math.min(1, 520 / Math.max(b.width, b.height));
      el.style.setProperty('--ry', `${((nx - 0.5) * 2 * max * damp).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-(ny - 0.5) * 2 * max * damp).toFixed(2)}deg`);
      el.style.setProperty('--px', `${(nx * 100).toFixed(1)}%`);
      el.style.setProperty('--py', `${(ny * 100).toFixed(1)}%`);
    };
    el.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      el.classList.add('tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  },
};

/** v-magnet="0.3": tlačítko se přitahuje ke kurzoru. */
export const vMagnet: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (!mouseOnly) return;
    const k = binding.value ?? 0.28;
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      el.style.translate = `${((e.clientX - b.left - b.width / 2) * k).toFixed(1)}px ${((e.clientY - b.top - b.height / 2) * k).toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = '0px 0px'; });
  },
};
