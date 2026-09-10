<template>
    <nav class="mobile-nav">
        <RouterLink v-for="s in sections" :key="s.path" :to="s.path" class="mobile-nav-link" active-class="active">
            <span class="mobile-nav-icon">{{ s.icon }}</span>
            <span class="mobile-nav-label">{{ s.label }}</span>
        </RouterLink>
    </nav>
</template>

<script setup lang="ts">
import '@/assets/mobileNav.css'
import { RouterLink } from 'vue-router'

const sections = [
    { path: '/', label: 'Board', icon: '⚓' },
    { path: '/challenges', label: 'Challenges', icon: '⌖' },
    { path: '/rules', label: 'Rules', icon: '📜' },
    { path: '/stats', label: 'Stats', icon: '📊' },
]
</script>
