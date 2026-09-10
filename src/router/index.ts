import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ChallengesView from '../views/ChallengesView.vue'
import RulesView from '../views/RulesView.vue'
import StatisticsView from '../views/StatisticsView.vue'

const routes = [
    { path: '/', name: 'Home', component: HomeView },
    { path: '/challenges', name: 'Challenges', component: ChallengesView },
    { path: '/rules', name: 'Rules', component: RulesView },
    { path: '/stats', name: 'Statistics', component: StatisticsView },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router
