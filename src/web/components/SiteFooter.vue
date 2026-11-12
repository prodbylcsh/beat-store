<script setup lang="ts">
import { BRAND } from '../../shared/brand';
import { t } from '../lib/i18n';

const year = new Date().getFullYear();
const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
</script>

<template>
  <footer class="foot wrap">
    <hr class="rule" />
    <div class="cols">
      <p class="claim">{{ t.footer.claim }}</p>
      <ul class="mono">
        <li><RouterLink :to="{ path: '/', hash: '#beats' }">{{ t.nav.beats }}</RouterLink></li>
        <li><RouterLink to="/mix-master">{{ t.nav.services }}</RouterLink></li>
        <li><RouterLink to="/licence">{{ t.nav.licenses }}</RouterLink></li>
      </ul>
      <ul class="mono">
        <li><RouterLink to="/podminky">{{ t.footer.terms }}</RouterLink></li>
        <li><RouterLink to="/soukromi">{{ t.footer.privacy }}</RouterLink></li>
        <li><a href="https://app.lemonsqueezy.com/my-orders" target="_blank" rel="noopener">My Orders ↗</a></li>
      </ul>
      <ul class="mono">
        <li><a :href="`mailto:${BRAND.email}`">{{ BRAND.email }}</a></li>
        <li><a :href="BRAND.instagram" target="_blank" rel="noopener">Instagram ↗</a></li>
        <li><button class="mono" @click="top">{{ t.footer.top }} ↑</button></li>
      </ul>
    </div>
    <div class="word display" aria-hidden="true">{{ BRAND.name }}<span class="eq"><i v-for="n in 5" :key="n" :style="{ animationDelay: `${n * -0.23}s` }" /></span></div>
    <div class="base mono dim"><span>© {{ year }} {{ BRAND.name }}</span><span>{{ t.footer.made }}</span></div>
  </footer>
</template>

<style scoped>
.foot { padding-top: clamp(48px, 8vw, 120px); padding-bottom: 28px; overflow: hidden; }
.cols { display: grid; grid-template-columns: 2fr 1fr 1fr 1.4fr; gap: 24px; padding-block: 32px 48px; }
.claim { font-size: clamp(20px, 2.2vw, 30px); font-weight: 650; font-variation-settings: 'wdth' 112; letter-spacing: -0.02em; max-width: 14ch; line-height: 1.05; }
ul { display: grid; gap: 10px; align-content: start; }
li a, li button { opacity: 0.7; transition: opacity 0.2s; }
li a:hover, li button:hover { opacity: 1; }
.word { font-size: clamp(90px, 27vw, 520px); line-height: 0.78; margin-left: -0.04em; display: flex; align-items: flex-end; gap: 0.06em; white-space: nowrap; }
.eq { display: inline-flex; align-items: flex-end; gap: 0.035em; height: 0.72em; padding-bottom: 0.03em; }
.eq i { width: 0.07em; height: 100%; background: var(--k); transform-origin: bottom; animation: eq 1.1s ease-in-out infinite alternate; transition: background-color 0.5s; }
@keyframes eq { from { transform: scaleY(0.12); } to { transform: scaleY(1); } }
:root:not([data-live='1']) .eq i { animation-play-state: paused; }
.base { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 22px; }
@media (max-width: 760px) { .cols { grid-template-columns: 1fr 1fr; } .claim { grid-column: 1 / -1; } }
</style>
