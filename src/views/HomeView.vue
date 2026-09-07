<template>
    <div class="home-container">
        <div v-if="errorMessage" class="connection-banner" @click="errorMessage = null">
            {{ errorMessage }} <span class="dismiss">(dismiss)</span>
        </div>

        <div class="game-layout">
            <LiveFeed class="layout-left" :messages="liveMessages" />

            <div class="layout-center">
                <BattleshipBoard :team-id="selectedTeam" :board="board" :shots="shots"
                    :show-test-ships="showTestShips" :force-attack-type="forceAttackType"
                    :on-fire="handleFireRequest" @fire-result="handleFireResult" @fire-error="handleFireError" />
                <TeamSelection v-if="teams.length" v-model="selectedTeam" :teams="teams" />
            </div>

            <div class="layout-right">
                <TeamShipStatus :teams="teams" :ship-status-teams="shipStatusTeams" :shots="shots" />
                <HiddenChallenges :tasks="bonusTasks" />
            </div>
        </div>

        <Transition name="toast-fade">
            <div v-if="toast" class="toast" :class="toast.kind">{{ toast.message }}</div>
        </Transition>

        <div v-if="isDev" class="dev-attack-toggle">
            <span class="dev-attack-label">DEV: Attack Style</span>
            <button v-for="opt in attackStyleOptions" :key="opt ?? 'random'" type="button"
                :class="{ active: forceAttackType === opt }" @click="forceAttackType = opt">
                {{ opt ?? 'random' }}
            </button>
        </div>

        <Legend />
    </div>
</template>

<script setup lang="ts">
import '@/assets/homeView.css'
import { ref, watch } from 'vue'
import LiveFeed from '@/components/LiveFeed.vue'
import BattleshipBoard from '@/components/BattleshipBoard.vue'
import TeamShipStatus from '@/components/TeamShipStatus.vue'
import HiddenChallenges from '@/components/HiddenChallenges.vue'
import TeamSelection from '@/components/TeamSelection.vue'
import Legend from '@/components/Legend.vue'
import { useGameData } from '@/composables/useGameData'
import type { FireResponse } from '@/api/types'

const { teams, board, shipStatusTeams, bonusTasks, shots, liveMessages, errorMessage, fireAt } = useGameData()

const isDev = import.meta.env.DEV
const showTestShips = ref(false)

// Dev-only: pin every shot to one attack style for testing instead of the
// normal random pick. Temporarily replaces the old show-test-ships toggle
// in this same corner — that ref/prop is still wired up, just not exposed
// in the UI right now.
const attackStyleOptions = [null, 'cannon', 'nuke', 'laser', 'kraken', 'storm'] as const
const forceAttackType = ref<'cannon' | 'nuke' | 'laser' | 'kraken' | 'storm' | null>(null)

const selectedTeam = ref<number | null>(null)

watch(
    teams,
    (list) => {
        if (selectedTeam.value === null && list.length > 0) {
            selectedTeam.value = list[0]!.id
        }
    },
    { immediate: true },
)

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
    if (selectedTeam.value === null) return Promise.reject(new Error('no team selected'))
    return fireAt(selectedTeam.value, coord)
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
