import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/beat/:slug', component: () => import('./pages/BeatPage.vue'), props: true },
    { path: '/mix-master', component: () => import('./pages/ServicesPage.vue') },
    { path: '/licence', component: () => import('./pages/LicensesPage.vue') },
    { path: '/podminky', component: () => import('./pages/LegalPage.vue'), props: { doc: 'terms' } },
    { path: '/soukromi', component: () => import('./pages/LegalPage.vue'), props: { doc: 'privacy' } },
    { path: '/order/:token', component: () => import('./pages/OrderPage.vue'), props: true },
    { path: '/admin', component: () => import('./pages/AdminPage.vue') },
    { path: '/:rest(.*)*', component: () => import('./pages/NotFound.vue') },
  ],
  scrollBehavior(to, _from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 };
  },
});
