import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FleetRankingsView from '@/views/FleetRankingsView.vue';

const routes = [
  { path: '/', name: 'Home', component: HomeView },
  { path: '/fleet-rankings', name: 'FleetRankings', component: FleetRankingsView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router
