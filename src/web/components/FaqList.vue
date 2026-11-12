<script setup lang="ts">
import { ref } from 'vue';
import { t } from '../lib/i18n';

const open = ref<number | null>(0);
</script>

<template>
  <ul class="faq">
    <li v-for="([q, a], i) in t.faq.items" :key="i" :class="{ open: open === i }">
      <button :aria-expanded="open === i" @click="open = open === i ? null : i">
        <span class="mono n">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="q">{{ q }}</span>
        <span class="plus" aria-hidden="true" />
      </button>
      <div class="a" :inert="open !== i"><p>{{ a }}</p></div>
    </li>
  </ul>
</template>

<style scoped>
.faq li { border-top: 1px solid var(--line); }
.faq li:last-child { border-bottom: 1px solid var(--line); }
button { width: 100%; display: grid; grid-template-columns: 40px 1fr 28px; align-items: center; gap: 12px; padding: 22px 0; text-align: left; }
.n { color: var(--ink-3); }
.q { font-size: clamp(18px, 2vw, 26px); font-weight: 650; font-variation-settings: 'wdth' 112; letter-spacing: -0.015em; }
.plus { position: relative; width: 28px; height: 28px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--line); transition: background-color 0.3s, transform 0.5s var(--ease); }
.plus::before, .plus::after { content: ''; position: absolute; left: 8px; right: 8px; top: 50%; height: 1.5px; margin-top: -0.75px; background: currentColor; }
.plus::after { transform: rotate(90deg); transition: transform 0.5s var(--ease); }
li.open .plus { background: var(--k); color: #0e0e0c; transform: rotate(180deg); box-shadow: none; }
li.open .plus::after { transform: rotate(0deg); }
.a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.5s var(--ease); }
li.open .a { grid-template-rows: 1fr; }
.a p { overflow: hidden; padding-left: 52px; max-width: 70ch; color: var(--ink-2); }
li.open .a p { padding-bottom: 24px; }
@media (max-width: 640px) { button { grid-template-columns: 28px 1fr 28px; } .a p { padding-left: 0; } }
</style>
