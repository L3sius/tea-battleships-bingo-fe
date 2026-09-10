<template>
    <div class="live-feed">
        <div class="live-feed-header">
            <h3 class="panel-title live-feed-title">Live Feed</h3>
            <div class="live-feed-status">
                <span class="live-feed-dot" :class="{ off: !connected }" />
                <span>{{ connected ? 'LIVE' : 'CONNECTING' }}</span>
            </div>
        </div>

        <div class="live-feed-filters">
            <button v-for="f in filters" :key="f.key" class="live-feed-filter" :class="{ active: filter === f.key }"
                @click="filter = f.key">
                {{ f.label }}
            </button>
        </div>

        <div v-if="filteredMessages.length === 0" class="feed-empty">
            {{ messages.length === 0 ? 'Waiting for activity…' : 'No matching events.' }}
        </div>
        <div v-else class="feed-list">
            <div v-for="(entry, index) in filteredMessages" :key="index" class="feed-item"
                :class="[classify(entry.message), { fail: !entry.isSuccessAction }]">
                <span class="feed-marker">{{ markerFor(classify(entry.message)) }}</span>
                <div class="feed-item-body">
                    <span class="feed-message">{{ entry.message }}</span>
                    <span class="feed-time">{{ formatTime(entry.timestamp) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/liveFeed.css'
import { computed, ref } from 'vue'
import type { ActionMessage } from '@/api/types'

const props = defineProps<{ messages: ActionMessage[]; connected?: boolean }>()

type FeedCategory = 'task' | 'attack' | 'hit' | 'miss' | 'sunk'
type FeedFilter = 'all' | FeedCategory

const filters: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'task', label: 'Tasks' },
    { key: 'attack', label: 'Attacks' },
    { key: 'hit', label: 'Hits' },
    { key: 'miss', label: 'Misses' },
    { key: 'sunk', label: 'Sunk' },
]

const filter = ref<FeedFilter>('all')

// The backend only sends a pre-formatted human-readable line per event, not a
// structured type — this is a best-effort classification for filtering, not
// an authoritative category.
function classify(message: string): FeedCategory {
    const m = message.toLowerCase()
    if (m.includes('sank') || m.includes('sunk')) return 'sunk'
    if (m.includes('miss')) return 'miss'
    if (m.includes('hit')) return 'hit'
    if (m.includes('fired at') || m.includes('attacked')) return 'attack'
    return 'task'
}

function markerFor(category: FeedCategory): string {
    switch (category) {
        case 'sunk':
            return '☠'
        case 'hit':
            return '✕'
        case 'miss':
            return '◌'
        case 'attack':
            return '⚓'
        default:
            return '✓'
    }
}

const filteredMessages = computed(() => {
    if (filter.value === 'all') return props.messages
    return props.messages.filter((m) => classify(m.message) === filter.value)
})

function formatTime(timestamp: string) {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>
