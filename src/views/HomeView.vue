<template>
    <div class="home-container">
        <div v-if="errorMessage" class="connection-banner" @click="errorMessage = null">
            {{ errorMessage }} <span class="dismiss">(dismiss)</span>
        </div>

        <div class="game-layout">
            <LiveFeed class="layout-left" :messages="liveMessages" :shots="shots" :teams="teams"
                :connected="connected" />

            <div class="layout-center">
                <BattleshipBoard :team-id="viewedTeam" :teams="teams" :board="board" :shots="shots"
                    :show-test-ships="showTestShips" :force-attack-type="forceAttackType"
                    :last-shot-fired="lastShotFired" :enemy-fleet="enemyFleet" :on-fire="handleFireRequest"
                    :hidden-shot-keys="inFlightKeys" @fire-result="handleFireResult" @fire-error="handleFireError"
                    @animating="boardAnimating = $event" @shot-claimed="claimLanding" @shot-landed="landShot" />
                <Legend />
            </div>

            <div class="layout-right">
                <TeamShipStatus :teams="teams" :ship-status-teams="shipStatusTeams" :shots="shots"
                    :pending-attacks="pendingAttacks" :selected-team-id="viewedTeam"
                    @update:selected-team-id="pickTeam" />
                <HiddenChallenges class="layout-right-challenges" :tasks="bonusTasks" />
            </div>
        </div>

        <Transition name="toast-fade">
            <div v-if="toast" class="toast" :class="toast.kind">{{ toast.message }}</div>
        </Transition>

        <Transition name="follow-fade">
            <div v-if="followTeam !== null" class="follow-notice" role="status">
                <span v-if="returnIn === null">
                    Switched to <strong :style="{ color: teamColorOf(followTeam) }">{{ teamNameOf(followTeam) }}</strong>’s
                    board to watch their attack
                </span>
                <span v-else>
                    Back to <strong :style="{ color: teamColorOf(selectedTeam) }">{{ teamNameOf(selectedTeam) }}</strong>
                    in {{ returnIn }}s
                </span>
                <button type="button" class="follow-notice-back" @click="stopFollowing">Back now</button>
            </div>
        </Transition>

        <div v-if="isDev" class="dev-attack-toggle">
            <span class="dev-attack-label">DEV: Attack Style</span>
            <button v-for="opt in attackStyleOptions" :key="opt ?? 'random'" type="button"
                :class="{ active: forceAttackType === opt }" @click="forceAttackType = opt">
                {{ opt ?? 'random' }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/homeView.css'
import { computed, onUnmounted, ref, watch } from 'vue'
import LiveFeed from '@/components/LiveFeed.vue'
import BattleshipBoard from '@/components/BattleshipBoard.vue'
import TeamShipStatus from '@/components/TeamShipStatus.vue'
import HiddenChallenges from '@/components/HiddenChallenges.vue'
import Legend from '@/components/Legend.vue'
import { useGameData } from '@/composables/useGameData'
import { autoSwitch } from '@/utils/autoSwitch'
import { teamColor } from '@/utils/teamColors'
import type { FireResponse } from '@/api/types'

// Shots and ship status are the in-flight-masked versions (see useGameData), so
// no result shows anywhere on this page before its shell lands.
const {
    teams,
    board,
    visibleShipStatus: shipStatusTeams,
    bonusTasks,
    visibleShots: shots,
    liveMessages,
    errorMessage,
    connected,
    lastShotFired,
    pendingAttacks,
    inFlightKeys,
    claimLanding,
    landShot,
    fireAt,
} = useGameData()

// The board is a targeting view of the enemy's waters, so the hulls drawn on it
// are the opponent's — their lengths and art come from the opponent's fleet.
const enemyFleet = computed(() => {
    if (viewedTeam.value === null) return []
    const opponentId = shots.value.find((s) => s.attackerTeamId === viewedTeam.value)?.targetTeamId
    const opponent =
        shipStatusTeams.value.find((t) => t.teamId === opponentId) ??
        shipStatusTeams.value.find((t) => t.teamId !== viewedTeam.value)
    return opponent?.ships ?? []
})

const isDev = import.meta.env.DEV
const showTestShips = ref(false)

// Dev-only: pin every shot to one attack style for testing instead of the
// seed-derived pick. Temporarily replaces the old show-test-ships toggle
// in this same corner — that ref/prop is still wired up, just not exposed
// in the UI right now.
const attackStyleOptions = [null, 'cannon', 'nuke', 'laser', 'kraken', 'storm', 'snake', 'seamen', 'molanisk'] as const
const forceAttackType = ref<'cannon' | 'nuke' | 'laser' | 'kraken' | 'storm' | 'snake' | 'seamen' | 'molanisk' | null>(null)

// The board you're viewing is remembered across refreshes.
const STORED_TEAM_KEY = 'bb:selected-team'

function readStoredTeam(): number | null {
    try {
        const raw = localStorage.getItem(STORED_TEAM_KEY)
        const n = raw === null ? NaN : Number(raw)
        return Number.isInteger(n) ? n : null
    } catch {
        return null
    }
}

const selectedTeam = ref<number | null>(readStoredTeam())

// Once teams load, keep a cached selection if it's still a real team; otherwise
// fall back to the first team.
watch(
    teams,
    (list) => {
        if (!list.length) return
        const stillValid = selectedTeam.value !== null && list.some((t) => t.id === selectedTeam.value)
        if (!stillValid) selectedTeam.value = list[0]!.id
    },
    { immediate: true },
)

watch(selectedTeam, (id) => {
    try {
        if (id === null) localStorage.removeItem(STORED_TEAM_KEY)
        else localStorage.setItem(STORED_TEAM_KEY, String(id))
    } catch {
        // best-effort — a blocked localStorage just means no persistence
    }
})

// ── Auto-switch ──
// `selectedTeam` is the player's own pick and is saved; `followTeam` is a
// temporary board shown while an attack plays out, and is never saved.
// Everything on screen — the board, the "Active" badge, firing — uses whichever
// is showing, so the page never claims one board while displaying another.
const followTeam = ref<number | null>(null)
const viewedTeam = computed(() => followTeam.value ?? selectedTeam.value)
const boardAnimating = ref(false)

// Linger on the attacker's board after the animation, so the result sinks in.
const RETURN_DELAY_MS = 5000
const returnAt = ref<number | null>(null)
const now = ref(Date.now())
let returnTimer: ReturnType<typeof setTimeout> | undefined
let tickTimer: ReturnType<typeof setInterval> | undefined

const returnIn = computed(() =>
    returnAt.value === null ? null : Math.max(1, Math.ceil((returnAt.value - now.value) / 1000)),
)

function cancelReturn() {
    clearTimeout(returnTimer)
    clearInterval(tickTimer)
    returnAt.value = null
}

function stopFollowing() {
    cancelReturn()
    followTeam.value = null
}

// A manual pick always wins over following.
function pickTeam(id: number) {
    stopFollowing()
    selectedTeam.value = id
}

function teamNameOf(id: number | null) {
    return teams.value.find((t) => t.id === id)?.name ?? 'your team'
}

function teamColorOf(id: number | null) {
    return id === null ? undefined : teamColor(teams.value, id)
}

const attackKey = (a: { attackerTeamId: number; coord: string }) => `${a.attackerTeamId}:${a.coord}`
const seenAttacks = new Set<string>()

// A new attack's countdown just started: go watch it.
watch(
    () => pendingAttacks.value.map(attackKey).join(','),
    () => {
        const fresh = pendingAttacks.value.filter((a) => !seenAttacks.has(attackKey(a)))
        for (const a of fresh) seenAttacks.add(attackKey(a))
        const latest = fresh[fresh.length - 1]
        if (!latest || !autoSwitch.value) return
        if (latest.attackerTeamId === viewedTeam.value) {
            // Already on that board — just hold off returning until it plays out.
            cancelReturn()
            return
        }
        // Never pull someone away from an attack they're already watching,
        // including their own shot counting down.
        if (boardAnimating.value || pendingAttacks.value.some((a) => a.attackerTeamId === viewedTeam.value)) return
        cancelReturn()
        followTeam.value = latest.attackerTeamId === selectedTeam.value ? null : latest.attackerTeamId
    },
)

// Once the followed attack has fully played out, count down and go back.
watch([followTeam, () => pendingAttacks.value.length, boardAnimating], () => {
    if (followTeam.value === null) return cancelReturn()
    const stillPlaying =
        boardAnimating.value || pendingAttacks.value.some((a) => a.attackerTeamId === followTeam.value)
    if (stillPlaying) return cancelReturn()
    if (returnAt.value !== null) return
    now.value = Date.now()
    returnAt.value = now.value + RETURN_DELAY_MS
    tickTimer = setInterval(() => (now.value = Date.now()), 250)
    returnTimer = setTimeout(stopFollowing, RETURN_DELAY_MS)
})

// Switching the toggle off mid-follow sends you straight back.
watch(autoSwitch, (on) => {
    if (!on) stopFollowing()
})

onUnmounted(cancelReturn)

const toast = ref<{ message: string; kind: 'success' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string, kind: 'success' | 'error') {
    toast.value = { message, kind }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        toast.value = null
    }, 4000)
}

// BattleshipBoard owns the animation timing; it calls this to actually fire,
// then reveals its projectile's impact once the result comes back.
function handleFireRequest(coord: string): Promise<FireResponse> {
    if (viewedTeam.value === null) return Promise.reject(new Error('no team selected'))
    return fireAt(viewedTeam.value, coord)
}

function handleFireResult(result: FireResponse) {
    if (result.gameWon) {
        showToast(`${result.attackerTeamName} sank the enemy fleet and won the game!`, 'success')
    } else if (result.result === 'sunk') {
        showToast(`Sunk the enemy ${result.sunkShipKey}!`, 'success')
    } else if (result.result === 'hit') {
        showToast(`Hit at ${result.coord}!`, 'success')
    } else {
        showToast(`Miss at ${result.coord}.`, 'error')
    }
}

function handleFireError() {
    // fireAt already records the error in errorMessage
}
</script>
