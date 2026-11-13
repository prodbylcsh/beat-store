<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { BRAND } from '../../shared/brand';
import { LICENSE_NAMES } from '../../shared/licenses';
import type { OrderView } from '../../shared/types';
import { ApiError, api } from '../lib/api';
import { lang, t } from '../lib/i18n';
import { vTilt } from '../lib/tilt';

const props = defineProps<{ token: string }>();
const view = ref<OrderView | null>(null);
const notFound = ref(false);
const tries = ref(0);
let timer = 0;

async function poll() {
  try {
    view.value = await api<OrderView>(`/api/orders/${encodeURIComponent(props.token)}`);
    // Webhook může dorazit o pár vteřin později než přesměrování z platby.
    if (view.value.state === 'processing' && tries.value < 60) {
      tries.value++;
      timer = window.setTimeout(poll, tries.value < 10 ? 2000 : 5000);
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound.value = true;
    else timer = window.setTimeout(poll, 6000);
  }
}
onMounted(() => { document.title = `${t.value.order.order} · LCSH`; void poll(); });
onUnmounted(() => clearTimeout(timer));

const base = computed(() => `/api/orders/${encodeURIComponent(props.token)}`);
const until = computed(() =>
  view.value?.termEndsAt ? new Intl.DateTimeFormat(lang.value === 'cs' ? 'cs-CZ' : 'en-GB', { dateStyle: 'long' }).format(new Date(view.value.termEndsAt)) : '',
);
</script>

<template>
  <section class="order wrap">
    <template v-if="notFound">
      <h1 class="display">{{ t.order.notFound }}</h1><p class="dim lead">{{ t.order.notFoundText }}</p>
      <RouterLink to="/" class="btn">{{ t.notFound.back }}</RouterLink>
    </template>

    <template v-else-if="!view || view.state === 'processing'">
      <div class="spin" aria-hidden="true" />
      <h1 class="display">{{ t.order.processingTitle }}</h1>
      <p class="dim lead" role="status">{{ t.order.processingText }}</p>
      <p v-if="tries > 8" class="dim lead">{{ t.order.slow }} <a :href="`mailto:${BRAND.email}`">{{ BRAND.email }}</a>.</p>
    </template>

    <template v-else-if="view.state === 'ready'">
      <p class="mono eyebrow">{{ t.order.order }} {{ view.orderNumber ? `#${view.orderNumber}` : '' }}<span v-if="view.isTest" class="test">{{ t.order.test }}</span></p>
      <h1 class="display">{{ t.order.readyTitle }}</h1>
      <p class="lead"><strong>{{ view.beatTitle }}</strong> — {{ LICENSE_NAMES[view.license!] }}</p>
      <div class="grid">
        <div v-tilt="5" class="card glass">
          <h2 class="mono">{{ t.order.files }}</h2>
          <a v-for="f in view.files" :key="f.kind" class="file" :href="`${base}/download/${f.kind}`" download>
            <span class="mono ext">{{ f.kind === 'wav' ? 'WAV' : 'ZIP' }}</span><span class="fname">{{ f.name }}</span><span class="btn small">{{ t.order.download }} ↓</span>
          </a>
        </div>
        <div v-tilt="5" class="card glass">
          <h2 class="mono">{{ t.order.license }}</h2>
          <a class="file" :href="`${base}/license?lang=${lang}`" target="_blank" rel="noopener">
            <span class="mono ext">PDF</span><span class="fname">{{ LICENSE_NAMES[view.license!] }} — {{ view.beatTitle }}</span><span class="btn small">{{ t.order.open }} ↗</span>
          </a>
          <p v-if="until" class="dim term">
            {{ t.order.until }} <strong>{{ until }}</strong>
            {{ view.licenseStatus === 'cancelled' ? `. ${t.order.cancelled}` : view.licenseStatus === 'active' ? t.order.renews : '' }}
          </p>
          <a v-if="until" class="mono link" href="https://app.lemonsqueezy.com/my-orders" target="_blank" rel="noopener">{{ t.order.manage }} ↗</a>
        </div>
      </div>
      <p class="keep mono">⚑ {{ t.order.keep }}</p>
    </template>

    <template v-else-if="view.state === 'service'">
      <h1 class="display">{{ t.order.serviceTitle }}</h1><p class="dim lead">{{ t.order.serviceText }}</p>
    </template>
    <template v-else-if="view.state === 'refunded'">
      <h1 class="display">{{ t.order.refundedTitle }}</h1><p class="dim lead">{{ t.order.refundedText }}</p>
    </template>
    <template v-else>
      <h1 class="display">{{ t.order.endedTitle }}</h1><p class="dim lead">{{ t.order.endedText }}</p>
      <RouterLink to="/" class="btn">{{ t.notFound.back }}</RouterLink>
    </template>
  </section>
</template>

<style scoped>
.order { min-height: 82vh; padding-top: clamp(56px, 10vh, 120px); padding-bottom: 80px; display: grid; gap: 18px; align-content: start; justify-items: start; }
h1 { font-size: clamp(48px, 10vw, 170px); margin-left: -0.04em; }
.lead { font-size: clamp(17px, 1.6vw, 22px); max-width: 56ch; }
.lead a { text-decoration: underline; }
.test { margin-left: 12px; padding: 2px 8px; border-radius: 999px; background: #ffcc00; color: #000; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; width: 100%; margin-top: 18px; }
.card { padding: 22px; border-radius: 22px; display: grid; gap: 12px; align-content: start; }
.card h2 { color: var(--ink-2); }
.file { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 12px; border-radius: 12px; background: var(--line-2); transition: background-color 0.2s; }
.file:hover { background: color-mix(in srgb, var(--k) 20%, transparent); }
.ext { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px; background: var(--ink); color: var(--paper); }
.fname { font-weight: 650; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.term { font-size: 14.5px; }
.link { text-decoration: underline; text-underline-offset: 4px; opacity: 0.7; }
.keep { margin-top: 10px; padding: 12px 16px; border-radius: 10px; background: color-mix(in srgb, var(--k) 16%, transparent); }
.spin { width: 64px; height: 64px; border-radius: 50%; background: conic-gradient(var(--k), transparent 70%); mask: radial-gradient(circle, transparent 0 55%, #000 56%); animation: sp 0.9s linear infinite; }
@keyframes sp { to { transform: rotate(360deg); } }
@media (max-width: 800px) { .grid { grid-template-columns: 1fr; } .file { grid-template-columns: auto 1fr; } .file .btn { grid-column: 1 / -1; } }
</style>
