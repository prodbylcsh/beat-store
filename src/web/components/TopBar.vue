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
  <header class="bar">
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
.bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 60; height: 64px; padding-inline: var(--pad);
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;
  background: color-mix(in srgb, var(--paper) 78%, transparent); backdrop-filter: blur(14px) saturate(1.3);
  border-bottom: 1px solid var(--line-2); transition: background-color 0.7s var(--ease), border-color 0.7s;
}
.logo { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; font-variation-settings: 'wdth' 125; font-size: 19px; letter-spacing: -0.02em; justify-self: start; }
.logo sup { font-size: 9px; font-weight: 500; margin-left: 2px; opacity: 0.6; }
.mark {
  width: 22px; height: 22px; border-radius: 50%; flex: none;
  background: radial-gradient(circle, var(--paper) 0 14%, var(--ink) 15% 30%, var(--k) 31% 100%);
  transition: background 0.5s;
}
.mark.spin { background: conic-gradient(from 0deg, var(--k), var(--ink) 35%, var(--k) 50%, var(--ink) 85%, var(--k)); animation: spin 1.8s linear infinite; mask: radial-gradient(circle, transparent 0 13%, #000 14%); }
@keyframes spin { to { transform: rotate(360deg); } }
.nav { display: flex; gap: clamp(14px, 2.4vw, 34px); font-size: 14px; font-weight: 550; font-variation-settings: 'wdth' 108; }
.nav a { position: relative; padding: 6px 0; }
.nav a::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.5px; background: currentColor; transform: scaleX(0); transform-origin: right; transition: transform 0.4s var(--ease); }
.nav a:hover::after, .nav a.router-link-exact-active::after { transform: scaleX(1); transform-origin: left; }
.right { display: flex; align-items: center; gap: 14px; justify-self: end; }
.lcd { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 6px; box-shadow: inset 0 0 0 1px var(--line); color: var(--ink-2); white-space: nowrap; }
.lcd i { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); }
.lcd.live { color: var(--ink); }
.lcd.live i { background: var(--k); box-shadow: 0 0 10px var(--k); animation: blink 1s steps(2) infinite; }
.lcd b { font-weight: 500; }
@keyframes blink { 50% { opacity: 0.25; } }
.lang { display: inline-flex; gap: 2px; padding: 3px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--line); }
.lang span { padding: 4px 8px; border-radius: 999px; color: var(--ink-3); transition: background-color 0.25s, color 0.25s; }
.lang span.on { background: var(--ink); color: var(--paper); }
@media (max-width: 760px) {
  .bar { grid-template-columns: auto 1fr auto; height: 56px; }
  .nav { justify-content: center; font-size: 13px; gap: 14px; }
  .lcd { display: none; }
  .name { display: none; }
}
</style>
