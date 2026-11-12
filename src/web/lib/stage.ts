import { reactive, shallowRef } from 'vue';
import type { Beat } from '../../shared/types';

/**
 * Jeviště: jedno WebGL plátno přes celý viewport a „sloty“ ve stránce.
 * Deska vždy doletí do nejvýše postaveného viditelného slotu (hero → detail → přehrávač dole).
 */
export interface Slot {
  el: HTMLElement;
  priority: number;
  tilt: number;
  /** beat, který má slot ukazovat; null = právě hrající / doporučený */
  beat: () => Beat | null;
  visible: boolean;
}

export const slots: Slot[] = [];
export const stage = reactive({
  /** ruční pootočení desky (scratch) */
  spinOffset: 0,
  dragging: false,
  /** slot, ve kterém deska právě je */
  activePriority: -1,
  available: true,
});
export const stageBeat = shallowRef<Beat | null>(null);

const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      const s = slots.find((x) => x.el === e.target);
      if (s) s.visible = e.isIntersecting && e.intersectionRatio > 0.12;
    }
  }, { threshold: [0, 0.12, 0.5] })
  : null;

export function registerSlot(slot: Slot): () => void {
  slots.push(slot);
  io?.observe(slot.el);
  return () => {
    io?.unobserve(slot.el);
    const i = slots.indexOf(slot);
    if (i > -1) slots.splice(i, 1);
  };
}

export function activeSlot(): Slot | null {
  let best: Slot | null = null;
  for (const s of slots) if (s.visible && (!best || s.priority > best.priority)) best = s;
  return best;
}
