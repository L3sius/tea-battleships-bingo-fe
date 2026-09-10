<template>
    <div class="feed-view">
        <LiveFeed :messages="liveMessages" :shots="shots" :teams="teams" :connected="connected" detached />
    </div>
</template>

<script setup lang="ts">
import '@/assets/feedView.css'
import LiveFeed from '@/components/LiveFeed.vue'
import { useGameData } from '@/composables/useGameData'

// Its own SSE connection (this is a separate window). No board is rendered, so
// no attack animations mount and nothing plays sound.
const { teams, shots, liveMessages, connected } = useGameData()
</script>
