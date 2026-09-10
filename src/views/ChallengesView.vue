<template>
    <div class="challenges-view">
        <HiddenChallenges :tasks="bonusTasks" full />
    </div>
</template>

<script setup lang="ts">
import '@/assets/challengesView.css'
import HiddenChallenges from '@/components/HiddenChallenges.vue'
import { useGameData } from '@/composables/useGameData'

const { bonusTasks } = useGameData()
</script>
