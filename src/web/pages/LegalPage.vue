<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { lang } from '../lib/i18n';
import { LEGAL } from '../lib/legal';

const props = defineProps<{ doc: 'terms' | 'privacy' }>();
const d = computed(() => LEGAL[props.doc][lang.value]);
watchEffect(() => (document.title = `${d.value.title} · LCSH`));
</script>

<template>
  <article class="legal wrap">
    <p class="mono eyebrow">{{ d.updated }}</p>
    <h1 class="display">{{ d.title }}</h1>
    <div class="prose">
      <template v-for="s in d.sections" :key="s.h"><h2>{{ s.h }}</h2><p v-for="p in s.p" :key="p">{{ p }}</p></template>
    </div>
  </article>
</template>

<style scoped>
.legal { padding-top: clamp(40px, 7vh, 84px); padding-bottom: 80px; }
h1 { font-size: clamp(44px, 9vw, 150px); margin: 0 0 clamp(28px, 4vw, 56px) -0.04em; }
.prose p { font-size: 16.5px; line-height: 1.6; }
</style>
