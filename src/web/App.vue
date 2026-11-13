<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import AmbientBg from './components/AmbientBg.vue';
import CursorDot from './components/CursorDot.vue';
import FxLayer from './components/FxLayer.vue';
import PageCurtain from './components/PageCurtain.vue';
import PlayerDock from './components/PlayerDock.vue';
import RecordStage from './components/RecordStage.vue';
import SiteFooter from './components/SiteFooter.vue';
import TopBar from './components/TopBar.vue';
import { next, player, prev, seekBy, toggle } from './lib/player';
import { beats, loadCatalog } from './lib/store';

const route = useRoute();
const bare = computed(() => route.path.startsWith('/admin'));
// detail beatu nemá patičku: na jeho konci plynule navazuje další beat
const chained = computed(() => route.path.startsWith('/beat/'));

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); toggle(player.current ?? beats.value[0], beats.value); }
  else if (e.key === 'ArrowRight') seekBy(5);
  else if (e.key === 'ArrowLeft') seekBy(-5);
  else if (e.key === 'j' || e.key === 'J') next();
  else if (e.key === 'k' || e.key === 'K') prev();
}
// „vaření“ kreslených čar: zrno filtru se mění 12× za vteřinu
let boilTimer = 0, boilSeed = 1;
function boil() {
  if (document.hidden) return;
  boilSeed = (boilSeed % 97) + 1;
  document.querySelectorAll('#fx-defs feTurbulence').forEach((n) => n.setAttribute('seed', String(boilSeed)));
}
// rychlost scrollu -> --sv (-1..1): nadpisy se podle ní zkosí
let svRaf = 0, lastY = 0, sv = 0, svSet = 0;
function scrollLoop() {
  svRaf = requestAnimationFrame(scrollLoop);
  const y = window.scrollY;
  const target = Math.max(-1, Math.min(1, (y - lastY) / 60));
  lastY = y;
  sv += (target - sv) * 0.18;
  if (Math.abs(sv) < 0.003) sv = 0;
  if (Math.abs(sv - svSet) > 0.004) { svSet = sv; document.documentElement.style.setProperty('--sv', sv.toFixed(3)); }
}
onMounted(() => {
  void loadCatalog();
  window.addEventListener('keydown', onKey);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    boilTimer = window.setInterval(boil, 1000 / 12);
    lastY = window.scrollY;
    svRaf = requestAnimationFrame(scrollLoop);
  }
});
onUnmounted(() => { window.removeEventListener('keydown', onKey); clearInterval(boilTimer); cancelAnimationFrame(svRaf); });
</script>

<template>
  <svg id="fx-defs" width="0" height="0" style="position: absolute" aria-hidden="true">
    <filter id="boil" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" /><feDisplacementMap in="SourceGraphic" scale="5" /></filter>
    <filter id="boil-lg" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="1" /><feDisplacementMap in="SourceGraphic" scale="9" /></filter>
  </svg>
  <AmbientBg v-if="!bare" />
  <TopBar />
  <RecordStage v-if="!bare" />
  <main :style="{ paddingBottom: 'var(--dock-h)' }">
    <RouterView v-slot="{ Component, route: r }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="r.path" />
      </Transition>
    </RouterView>
  </main>
  <SiteFooter v-if="!bare && !chained" />
  <PlayerDock v-if="!bare" />
  <FxLayer v-if="!bare" />
  <PageCurtain />
  <CursorDot />
</template>
