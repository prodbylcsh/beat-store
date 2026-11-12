import type { Directive } from 'vue';

/** v-reveal: prvek najede, až se dostane do viewportu. */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    el.classList.add('reveal');
    if (binding.value) el.style.transitionDelay = `${binding.value}ms`;
    io.observe(el);
  },
  unmounted(el) { io.unobserve(el); },
};
