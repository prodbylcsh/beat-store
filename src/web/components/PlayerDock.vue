<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { formatTime, keyLabel } from '../../shared/music';
import { lang, t } from '../lib/i18n';
import { next, player, prev, toggle } from '../lib/player';
import { stage } from '../lib/stage';
import DiscSlot from './DiscSlot.vue';
import MiniWave from './MiniWave.vue';

const b = computed(() => player.current);
watchEffect(() => document.documentElement.style.setProperty('--dock-h', b.value ? '162px' : '86px'));
</script>

<template>
  <Transition name="dock">
    <aside v-if="b" class="dock glass" aria-label="Player">
      <div class="disc">
        <DiscSlot :priority="1" :beat="b" :interactive="false" class="mini" />
        <span v-if="stage.activePriority > 1" class="ghost" aria-hidden="true" />
      </div>
      <RouterLink :to="`/beat/${b.slug}`" class="meta">
        <strong>{{ b.title }}</strong>
        <span class="mono dim">{{ b.bpm }} BPM · {{ keyLabel(b.key, lang) }} · {{ b.genre }}</span>
      </RouterLink>
      <div class="transport">
        <button aria-label="Previous" @click="prev()"><svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg></button>
        <button class="pp" :aria-label="player.playing ? t.row.pause : t.row.play" @click="toggle()">
          <svg v-if="player.playing" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg>
        </button>
        <button aria-label="Next" @click="next()"><svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg></button>
      </div>
      <span class="time mono">{{ formatTime(player.time) }}</span>
      <div class="wave"><MiniWave :beat="b" :bar="2" :gap="2" /></div>
      <span class="time mono dim">{{ formatTime(player.duration || b.duration) }}</span>
      <RouterLink :to="`/beat/${b.slug}`" class="btn small buy">{{ t.dock.license }} <span class="arr">→</span></RouterLink>
    </aside>
  </Transition>
</template>

<style scoped>
.dock {
  position: fixed !important; left: 50%; translate: -50% 0; width: min(1080px, calc(100vw - 16px)); bottom: 80px; z-index: 40; height: 68px; padding: 0 16px 0 10px;
  display: grid; grid-template-columns: auto minmax(120px, 220px) auto auto 1fr auto auto; align-items: center; gap: 16px;
  border-radius: 999px;
}
.disc { position: relative; width: 50px; height: 50px; }
.mini { width: 50px; height: 50px; }
.ghost { position: absolute; inset: 4px; border-radius: 50%; border: 1px dashed var(--line); }
.meta { display: grid; min-width: 0; line-height: 1.2; }
.meta strong { font-weight: 700; font-variation-settings: 'wdth' 112; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 10px; margin-top: 3px; }
.transport { display: flex; align-items: center; gap: 6px; }
.transport button { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; transition: background-color 0.2s, transform 0.2s; }
.transport button:hover { background: var(--line-2); }
.transport button:active { transform: scale(0.9); }
.transport svg { width: 16px; height: 16px; fill: currentColor; }
.transport .pp { width: 44px; height: 44px; background: var(--ink); color: var(--paper); }
.transport .pp:hover { background: var(--k); color: var(--on-k); }
.transport .pp svg { width: 18px; height: 18px; }
.wave { height: 34px; min-width: 0; }
.time { font-variant-numeric: tabular-nums; }
.dock-enter-active, .dock-leave-active { transition: transform 0.6s var(--ease), opacity 0.4s; }
.dock-enter-from, .dock-leave-to { transform: translateY(140%) scale(0.9); opacity: 0; }
@media (max-width: 560px) { .dock { bottom: 72px; height: 62px; } }
@media (max-width: 860px) {
  .dock { grid-template-columns: auto 1fr auto auto; gap: 10px; padding-right: 10px; }
  .wave, .time { display: none; }
  .transport button:not(.pp) { display: none; }
  .buy { padding: 0 12px; }
}
</style>
