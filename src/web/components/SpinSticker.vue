<script setup lang="ts">
/** Kulatá samolepka s textem dokola. Otáčí se trhaně (12 kroků za vteřinu) jako ručně animovaná. */
const props = withDefaults(defineProps<{ text: string; center?: string }>(), { center: '✦' });
const id = `st-${Math.random().toString(36).slice(2, 8)}`;
const full = `${props.text} · `.repeat(3);
</script>

<template>
  <span class="sticker" aria-hidden="true">
    <svg viewBox="0 0 120 120" class="ring">
      <defs><path :id="id" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
      <text><textPath :href="`#${id}`" textLength="274">{{ full }}</textPath></text>
    </svg>
    <b>{{ center }}</b>
  </span>
</template>

<style scoped>
.sticker { position: relative; display: grid; place-items: center; width: 118px; height: 118px; border-radius: 50%; background: var(--k); color: #0e0e0c; box-shadow: 0 10px 24px -10px rgb(0 0 0 / 0.5), inset 0 2px 0 rgb(255 255 255 / 0.5), inset 0 -3px 6px rgb(0 0 0 / 0.18); transition: background-color 0.5s, transform 0.25s steps(3); }
.sticker:hover { transform: scale(1.12) rotate(-10deg); }
.ring { position: absolute; inset: 0; animation: turn 9s steps(108) infinite; }
text { font-family: var(--mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; fill: currentColor; }
b { font-size: 34px; line-height: 1; font-weight: 800; animation: pop 1s steps(4) infinite; }
@keyframes turn { to { transform: rotate(360deg); } }
@keyframes pop { 50% { transform: scale(0.8) rotate(20deg); } }
</style>
