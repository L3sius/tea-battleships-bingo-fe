<template>
    <div class="panel live-feed">
        <h2 class="panel-title">Live Feed</h2>
        <div v-if="messages.length === 0" class="feed-empty">Waiting for activity…</div>
        <div class="feed-list">
            <div v-for="(entry, index) in messages" :key="index" class="feed-item"
                :class="{ fail: !entry.isSuccessAction }">
                <span class="feed-time">{{ formatTime(entry.timestamp) }}</span>
                <span class="feed-message">{{ entry.message }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/liveFeed.css'
import type { ActionMessage } from '@/api/types'

defineProps<{ messages: ActionMessage[] }>()

function formatTime(timestamp: string) {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>
