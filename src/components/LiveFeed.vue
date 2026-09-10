<template>
    <div class="live-feed" :class="{ detached }">
        <div class="live-feed-header">
            <div class="live-feed-head-left">
                <h3 class="panel-title live-feed-title">Live Feed</h3>
                <span class="live-feed-status">
                    <span class="live-feed-dot" :class="{ off: !connected }" />
                    {{ connected ? 'LIVE' : 'CONNECTING' }}
                </span>
            </div>
            <button v-if="!detached" type="button" class="live-feed-popout"
                title="Open this feed in its own window — handy for a second monitor or a stream overlay" @click="popOut">
                ⧉&nbsp;Pop out
            </button>
        </div>

        <div class="live-feed-tabs" role="tablist">
            <button v-for="t in tabs" :key="t.key" type="button" class="live-feed-tab" role="tab"
                :class="{ active: tab === t.key }" :aria-selected="tab === t.key" @click="tab = t.key">
                {{ t.label }}
                <span class="live-feed-tab-count">{{ t.count }}</span>
            </button>
        </div>

        <!-- Activity: what clan members are doing right now (Dink events) -->
        <template v-if="tab === 'activity'">
            <div v-if="activity.length === 0" class="feed-empty">
                {{ messages.length === 0 ? 'Waiting for activity…' : 'Nothing here yet.' }}
            </div>
            <div v-else class="feed-list">
                <div v-for="(entry, i) in activity" :key="'a' + i" class="feed-item"
                    :class="{ fail: !entry.isSuccessAction }">
                    <span class="feed-marker">{{ entry.isSuccessAction ? '✦' : '✕' }}</span>
                    <div class="feed-item-body">
                        <span class="feed-message">{{ entry.message }}</span>
                        <span class="feed-time">{{ formatTime(entry.timestamp) }}</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- Battle History: every shot fired, with its outcome -->
        <template v-else>
            <div v-if="battle.length === 0" class="feed-empty">No shots fired yet.</div>
            <div v-else class="feed-list">
                <div v-for="(s, i) in battle" :key="'b' + i" class="feed-item feed-shot" :class="s.result">
                    <span class="feed-marker">{{ shotMarker(s.result) }}</span>
                    <div class="feed-item-body">
                        <span class="feed-shot-line">
                            <span class="feed-shot-team" :style="{ color: teamColorOf(s.attackerTeamId) }">
                                {{ teamName(s.attackerTeamId) }}
                            </span>
                            <span class="feed-shot-verb"> fired at </span>
                            <span class="feed-shot-coord">{{ s.coord }}</span>
                        </span>
                        <span class="feed-shot-meta">
                            <span class="feed-shot-result" :class="s.result">{{ resultLabel(s) }}</span>
                            <span class="feed-time">{{ formatTime(s.firedAt) }}</span>
                        </span>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import '@/assets/liveFeed.css'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { ActionMessage, Shot, Team } from '@/api/types'
import { teamColor } from '@/utils/teamColors'

const props = defineProps<{
    messages: ActionMessage[]
    shots?: Shot[]
    teams?: Team[]
    connected?: boolean
    /** true when rendered in the standalone /feed popup window */
    detached?: boolean
}>()

const router = useRouter()

type Tab = 'activity' | 'battle'
const tab = ref<Tab>('activity')

// Attacks also arrive on the action stream as prose lines. Keep them out of the
// Activity tab — the Battle History tab covers them from structured shot data.
function isAttackLine(message: string): boolean {
    const m = message.toLowerCase()
    return m.includes('fired at') || m.includes('attacked') || m.includes('sank') || m.includes('sunk')
}

const activity = computed(() => props.messages.filter((m) => !isAttackLine(m.message)))

const battle = computed(() =>
    [...(props.shots ?? [])].sort((a, b) => (a.firedAt < b.firedAt ? 1 : a.firedAt > b.firedAt ? -1 : 0)),
)

const tabs = computed(() => [
    { key: 'activity' as const, label: 'Activity', count: activity.value.length },
    { key: 'battle' as const, label: 'Battle History', count: battle.value.length },
])

function teamName(id: number): string {
    return props.teams?.find((t) => t.id === id)?.name ?? `Team ${id}`
}

function teamColorOf(id: number): string {
    return props.teams?.length ? teamColor(props.teams, id) : 'var(--color-fg)'
}

function shotMarker(result: Shot['result']): string {
    return result === 'sunk' ? '☠' : result === 'hit' ? '✕' : '◌'
}

function resultLabel(s: Shot): string {
    if (s.result === 'sunk') return `SUNK${s.sunkShipKey ? ' · ' + capitalize(s.sunkShipKey) : ''}`
    return s.result.toUpperCase()
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(ts: string): string {
    let d = new Date(ts)
    if (Number.isNaN(d.getTime())) d = new Date(ts.replace(' ', 'T') + 'Z')
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function popOut() {
    const href = router.resolve({ name: 'Feed' }).href
    window.open(href, 'battleships-feed', 'popup,width=460,height=860')
}
</script>
