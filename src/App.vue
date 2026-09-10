<script setup lang="ts">
import { RouterView } from 'vue-router'
import { computed } from 'vue'
import TopNav from '@/components/TopNav.vue'
import MobileNav from '@/components/MobileNav.vue'
import { useGameData } from '@/composables/useGameData'

const { board, shots } = useGameData()

// Real aggregates only — no fabricated countdown/score. Tasks completed
// counts completed board tiles across every team; attacks made is every
// shot fired by anyone, both derived live from the actual game state.
const tasksCompleted = computed(() => {
    if (!board.value) return 0
    return board.value.teams.reduce((sum, t) => sum + t.tiles.filter((tile) => tile.completed).length, 0)
})
const attacksMade = computed(() => shots.value.length)
</script>

<template>
  <TopNav :tasks-completed="tasksCompleted" :attacks-made="attacksMade" />
  <main class="router-view-container">
    <RouterView />
  </main>
  <MobileNav />
</template>
