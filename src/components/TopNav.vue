<template>
    <header class="top-nav">
        <div class="top-nav-brand">
            <img class="top-nav-logo" src="/images/logo.png" alt="Battleships" />
            <div class="top-nav-divider" />
            <div class="top-nav-stats">
                <div class="top-nav-stat">
                    <span class="top-nav-stat-value">{{ tasksCompleted }}</span>
                    <span class="top-nav-stat-label">Tasks Done</span>
                </div>
                <div class="top-nav-stat">
                    <span class="top-nav-stat-value">{{ attacksMade }}</span>
                    <span class="top-nav-stat-label">Attacks</span>
                </div>
            </div>
        </div>

        <nav class="top-nav-links">
            <RouterLink v-for="section in sections" :key="section.path" :to="section.path" class="nav-link"
                active-class="active">
                {{ section.label }}
            </RouterLink>
        </nav>

        <div class="top-nav-aside">
            <SoundControl />
        </div>
    </header>
</template>

<script setup lang="ts">
import '@/assets/topNav.css'
import { RouterLink } from 'vue-router'
import SoundControl from '@/components/SoundControl.vue'

defineProps<{ tasksCompleted: number; attacksMade: number }>()

const sections = [
    { path: '/', label: 'Board' },
    { path: '/challenges', label: 'Challenges' },
    { path: '/rules', label: 'Rules' },
    { path: '/stats', label: 'Statistics' },
]
</script>
