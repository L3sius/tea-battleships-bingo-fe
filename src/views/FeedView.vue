<template>
    <div class="feed-view">
        <LiveFeed :messages="liveMessages" :shots="shots" :teams="teams" :connected="connected" detached />
    </div>
</template>

<script setup lang="ts">
import '@/assets/feedView.css'
import LiveFeed from '@/components/LiveFeed.vue'
import { useGameData } from '@/composables/useGameData'
import { silenceThisWindow } from '@/utils/sound'

// Its own SSE connection (this is a separate window). The shared game-data
// service still sounds the attack siren, so the popup silences itself — the main
// page is where sound belongs.
silenceThisWindow()
const { teams, shots, liveMessages, connected } = useGameData()
</script>
