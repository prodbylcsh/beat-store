<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import CursorDot from './components/CursorDot.vue';
import PlayerDock from './components/PlayerDock.vue';
import RecordStage from './components/RecordStage.vue';
import SiteFooter from './components/SiteFooter.vue';
import TopBar from './components/TopBar.vue';
import { next, player, prev, seekBy, toggle } from './lib/player';
import { beats, loadCatalog } from './lib/store';

const route = useRoute();
const bare = computed(() => route.path.startsWith('/admin'));

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
onMounted(() => { void loadCatalog(); window.addEventListener('keydown', onKey); });
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <TopBar />
  <RecordStage v-if="!bare" />
  <main :style="{ paddingBottom: 'var(--dock-h)' }">
    <RouterView v-slot="{ Component, route: r }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="r.path" />
      </Transition>
    </RouterView>
  </main>
  <SiteFooter v-if="!bare" />
  <PlayerDock v-if="!bare" />
  <CursorDot />
</template>
