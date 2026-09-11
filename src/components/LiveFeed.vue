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
                <div v-for="entry in activity" :key="entry.id" class="feed-item feed-act"
                    :class="[entry.parsed.kind, { fail: !entry.isSuccessAction }]">
                    <span class="feed-marker">{{ kindIcon(entry.parsed.kind, entry.isSuccessAction) }}</span>
                    <div class="feed-item-body">
                        <span class="feed-message"><span v-for="(sg, j) in entry.parsed.segs" :key="j" class="fseg"
                                :class="['fseg-' + sg.t, sg.tone ? 'tone-' + sg.tone : '', hasTip(sg) ? 'fseg-tip' : '']"
                                :style="segStyle(sg)" :tabindex="hasTip(sg) ? 0 : undefined"
                                @mouseenter="hasTip(sg) && openTip($event, sg)" @mouseleave="closeTip"
                                @focusin="hasTip(sg) && openTip($event, sg)" @focusout="closeTip">{{ sg.v }}</span></span>
                        <span class="feed-time">{{ formatTime(entry.timestamp) }}</span>
                    </div>
                </div>
            </div>
        </template>

        <!-- Battle History: every shot fired, with its outcome -->
        <template v-else>
            <div v-if="battle.length === 0" class="feed-empty">No shots fired yet.</div>
            <div v-else class="feed-list">
                <!-- an attacker can only fire at a coord once, so this pair is unique -->
                <div v-for="s in battle" :key="`${s.attackerTeamId}:${s.coord}`" class="feed-item feed-shot"
                    :class="s.result">
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

        <Teleport to="body">
            <div v-if="activeTip" class="feed-tip" :class="{ below: activeTip.below }" :style="activeTip.style">
                <template v-if="activeTip.seg.t === 'player'">
                    <span class="feed-tip-label">Team</span>
                    <span class="feed-tip-value" :style="teamStyleFor(activeTip.seg.team)">{{ activeTip.seg.team }}</span>
                </template>
                <template v-else-if="activeTip.seg.t === 'boss'">
                    <span class="feed-tip-value">{{ activeTip.seg.meta }}</span>
                </template>
                <template v-else-if="activeTip.seg.t === 'loot'">
                    <span class="feed-tip-label">Loot</span>
                    <span v-for="(it, k) in activeTip.seg.items" :key="k" class="feed-tip-loot-row">
                        <span>{{ it.name }}</span>
                        <span v-if="it.qty > 1" class="feed-tip-loot-qty">×{{ it.qty }}</span>
                    </span>
                </template>
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import '@/assets/liveFeed.css'
import { computed, onUnmounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'
import type { ActionMessage, Shot, Team } from '@/api/types'
import { teamColor } from '@/utils/teamColors'
import { parseFeedLine, type FeedKind, type FeedSeg, type ParsedFeed } from '@/utils/feedLine'
import { MAX_LIVE_MESSAGES } from '@/composables/useGameData'

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

type ActivityEntry = ActionMessage & { parsed: ParsedFeed }

// Each line is parsed once and the entry reused on every later recompute —
// otherwise every new line would re-run the regex chain over the whole feed.
// Weak, so entries disappear along with messages trimmed off the end.
const entryCache = new WeakMap<ActionMessage, ActivityEntry>()

function toEntry(m: ActionMessage): ActivityEntry {
    const raw = toRaw(m)
    let entry = entryCache.get(raw)
    if (!entry) {
        entry = { ...raw, parsed: parseFeedLine(raw.message, raw.isSuccessAction) }
        entryCache.set(raw, entry)
    }
    return entry
}

// messages already arrive newest-first (see useGameData.pushLiveMessage).
const activity = computed(() => props.messages.filter((m) => !isAttackLine(m.message)).map(toEntry))

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function teamStyleFor(name?: string): Record<string, string> | undefined {
    if (!name || !props.teams?.length) return undefined
    const t = props.teams.find((x) => norm(x.name) === norm(name))
    return t ? { color: teamColor(props.teams, t.id) } : undefined
}

function segStyle(sg: FeedSeg): Record<string, string> | undefined {
    if (sg.t !== 'player' && sg.t !== 'team') return undefined
    return teamStyleFor(sg.t === 'player' ? sg.team : sg.v)
}

// ── custom hover tooltip ──
interface ActiveTip {
    seg: FeedSeg
    style: Record<string, string>
    below: boolean
}
const activeTip = ref<ActiveTip | null>(null)
let tipTimer: ReturnType<typeof setTimeout> | undefined

function hasTip(sg: FeedSeg): boolean {
    return (sg.t === 'player' && !!sg.team) || (sg.t === 'boss' && !!sg.meta) || (sg.t === 'loot' && !!sg.items?.length)
}

function openTip(e: Event, sg: FeedSeg): void {
    clearTimeout(tipTimer)
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const below = r.top < 96
    activeTip.value = {
        seg: sg,
        below,
        style: {
            left: `${Math.round(r.left + r.width / 2)}px`,
            top: `${Math.round(below ? r.bottom + 8 : r.top - 8)}px`,
        },
    }
}

function closeTip(): void {
    clearTimeout(tipTimer)
    tipTimer = setTimeout(() => (activeTip.value = null), 60)
}

onUnmounted(() => clearTimeout(tipTimer))

const KIND_ICON: Partial<Record<FeedKind, string>> = {
    completion: '✓',
    progress: '▸',
    bonus: '★',
    kill: '☠',
    loot: '◆',
    slayer: '⚔',
    ca: '✦',
    clue: '◇',
    pet: '❖',
    death: '✕',
    lock: '⚓',
    'shot-hit': '✕',
    'shot-sunk': '☠',
    'shot-miss': '◌',
    win: '★',
}

function kindIcon(kind: FeedKind, ok: boolean): string {
    return KIND_ICON[kind] ?? (ok ? '✦' : '✕')
}

// /getShots comes back oldest-first (ORDER BY id); reverse for newest-first
// without losing same-second ordering the way a firedAt sort would.
const battle = computed(() => [...(props.shots ?? [])].reverse())

// Once the buffer is full, old lines are being dropped as new ones arrive, so the
// number is a floor rather than a total — say so instead of freezing at the cap.
const activityCount = computed(() =>
    props.messages.length >= MAX_LIVE_MESSAGES ? `${activity.value.length}+` : String(activity.value.length),
)

const tabs = computed(() => [
    { key: 'activity' as const, label: 'Activity', count: activityCount.value },
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
