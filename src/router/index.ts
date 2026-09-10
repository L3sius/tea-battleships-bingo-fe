import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ChallengesView from '../views/ChallengesView.vue'
import RulesView from '../views/RulesView.vue'
import StatisticsView from '../views/StatisticsView.vue'
import FeedView from '../views/FeedView.vue'

const routes = [
    { path: '/', name: 'Home', component: HomeView },
    { path: '/challenges', name: 'Challenges', component: ChallengesView },
    { path: '/rules', name: 'Rules', component: RulesView },
    { path: '/stats', name: 'Statistics', component: StatisticsView },
    // Standalone pop-out feed window — no nav chrome, no board, no sound.
    { path: '/feed', name: 'Feed', component: FeedView, meta: { bare: true } },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router
