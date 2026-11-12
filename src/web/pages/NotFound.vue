<script setup lang="ts">
import { t } from '../lib/i18n';
</script>

<template>
  <section class="nf wrap">
    <p class="mono eyebrow">404</p>
    <h1 class="display">{{ t.notFound.title }}</h1>
    <p class="dim">{{ t.notFound.text }}</p>
    <RouterLink to="/" class="btn">{{ t.notFound.back }} <span class="arr">→</span></RouterLink>
  </section>
</template>

<style scoped>
.nf { min-height: 80vh; padding-top: 180px; display: grid; gap: 18px; align-content: start; justify-items: start; }
h1 { font-size: clamp(44px, 9vw, 150px); max-width: 12ch; }
</style>
