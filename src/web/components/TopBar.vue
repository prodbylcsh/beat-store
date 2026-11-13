<script setup lang="ts">
import { computed } from 'vue';
import { BRAND } from '../../shared/brand';
import { keyLabel } from '../../shared/music';
import { lang, setLang, t } from '../lib/i18n';
import { player } from '../lib/player';

const status = computed(() =>
  player.current && player.playing
    ? `${player.current.bpm} BPM · ${keyLabel(player.current.key, lang.value)}`
    : t.value.status.ready,
);
</script>

<template>
  <header class="bar glass">
    <RouterLink to="/" class="logo" :aria-label="`${BRAND.name} — home`">
      <span class="mark" :class="{ spin: player.playing }" aria-hidden="true" />
      <span class="name">{{ BRAND.name }}<sup>®</sup></span>
    </RouterLink>
    <nav class="nav" aria-label="Main">
      <RouterLink :to="{ path: '/', hash: '#beats' }">{{ t.nav.beats }}</RouterLink>
      <RouterLink to="/mix-master">{{ t.nav.services }}</RouterLink>
      <RouterLink to="/licence">{{ t.nav.licenses }}</RouterLink>
    </nav>
    <div class="right">
      <span class="lcd mono" :class="{ live: player.playing }" aria-live="polite">
        <i aria-hidden="true" /><b>{{ status }}</b>
      </span>
      <button class="lang mono" :aria-label="lang === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'" @click="setLang(lang === 'cs' ? 'en' : 'cs')">
        <span :class="{ on: lang === 'cs' }">CS</span><span :class="{ on: lang === 'en' }">EN</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Navigace je plovoucí ostrůvek u spodního okraje – obsah pod ní volně podjíždí. */
.bar {
  position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 60; height: 58px; padding: 0 8px 0 16px;
  display: flex; align-items: center; gap: clamp(12px, 2vw, 26px); border-radius: 999px; white-space: nowrap; max-width: calc(100vw - 16px);
}
.logo { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-variation-settings: 'wdth' 125; font-size: 18px; letter-spacing: -0.02em; }
.logo sup { font-size: 9px; font-weight: 500; margin-left: 2px; opacity: 0.6; }
.mark {
  width: 24px; height: 24px; border-radius: 50%; flex: none;
  background: radial-gradient(circle, var(--paper) 0 14%, var(--ink) 15% 30%, var(--k) 31% 100%);
  transition: background 0.5s, transform 0.3s steps(3);
}
.logo:hover .mark { transform: rotate(120deg) scale(1.15); }
.mark.spin { background: conic-gradient(from 0deg, var(--k), var(--ink) 35%, var(--k) 50%, var(--ink) 85%, var(--k)); animation: spin 1.8s steps(22) infinite; mask: radial-gradient(circle, transparent 0 13%, #000 14%); }
@keyframes spin { to { transform: rotate(360deg); } }
.nav { display: flex; gap: 2px; font-size: 14px; font-weight: 600; font-variation-settings: 'wdth' 108; }
.nav a { position: relative; padding: 9px 14px; border-radius: 999px; transition: background-color 0.25s, color 0.25s, transform 0.2s steps(2); }
.nav a:hover { background: var(--line-2); transform: translateY(-2px); }
.nav a.router-link-exact-active { background: var(--ink); color: var(--paper); }
.right { display: flex; align-items: center; gap: 10px; }
.lcd { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); color: var(--ink-2); }
.lcd i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); }
.lcd.live { color: var(--ink); }
.lcd.live i { background: var(--k); box-shadow: 0 0 10px var(--k); animation: blink 1s steps(2) infinite; }
.lcd b { font-weight: 500; }
@keyframes blink { 50% { opacity: 0.25; } }
.lang { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.lang span { padding: 6px 9px; border-radius: 999px; color: var(--ink-3); transition: background-color 0.25s, color 0.25s; }
.lang span.on { background: var(--ink); color: var(--paper); }
@media (max-width: 900px) { .lcd { display: none; } }
@media (max-width: 560px) {
  .bar { gap: 6px; padding: 0 6px 0 10px; height: 54px; bottom: 10px; }
  .name { display: none; }
  .nav { font-size: 12.5px; }
  .nav a { padding: 8px 9px; }
  .lang span { padding: 5px 6px; }
}
</style>
