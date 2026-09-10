<template>
    <div class="ship-status">
        <div class="ship-status-head">
            <h3 class="panel-title">Fleets</h3>
            <span class="ship-status-hint">Select your team to view its board</span>
        </div>

        <div v-if="shipStatusTeams.length === 0" class="ship-status-empty">Waiting for fleet data…</div>

        <button v-for="team in shipStatusTeams" :key="team.teamId" type="button" class="ship-status-card"
            :class="{ active: team.teamId === selectedTeamId }" :style="{ '--team-color': teamColor(teams, team.teamId) }"
            :aria-pressed="team.teamId === selectedTeamId" @click="emit('update:selectedTeamId', team.teamId)">
            <div class="ship-status-card-header">
                <span class="ship-status-dot" />
                <span class="ship-status-team-name">{{ team.teamName }}</span>
                <span v-if="team.teamId === selectedTeamId" class="ship-status-active-badge">Active</span>
                <span v-if="team.fleetDestroyed" class="fleet-destroyed-badge">Fleet Destroyed</span>
            </div>

            <div class="ship-status-stats">
                <div class="ship-status-stat">
                    <span class="ship-status-stat-value">{{ shotsFired(team.teamId) }}</span>
                    <span class="ship-status-stat-label">Shots</span>
                </div>
                <div class="ship-status-stat">
                    <span class="ship-status-stat-value">{{ hitsFor(team.teamId) }}</span>
                    <span class="ship-status-stat-label">Hits</span>
                </div>
                <div class="ship-status-stat">
                    <span class="ship-status-stat-value">{{ accuracyFor(team.teamId) }}%</span>
                    <span class="ship-status-stat-label">Acc.</span>
                </div>
            </div>

            <div class="ship-status-ships">
                <div v-for="ship in team.ships" :key="ship.key" class="ship-status-row" :class="{ sunk: ship.sunk }">
                    <span class="ship-name">{{ ship.displayName }}</span>
                    <span class="ship-state-badge" :class="{ sunk: ship.sunk }">
                        {{ ship.sunk ? 'Sunk' : 'Afloat' }}
                    </span>
                </div>
            </div>
        </button>
    </div>
</template>

<script setup lang="ts">
import '@/assets/teamShipStatus.css'
import type { Shot, ShipStatusTeam, Team } from '@/api/types'
import { teamColor } from '@/utils/teamColors'

const props = defineProps<{
    teams: Team[]
    shipStatusTeams: ShipStatusTeam[]
    shots: Shot[]
    /** Which team's board is currently shown — the card for it reads "Active". */
    selectedTeamId: number | null
}>()

// Clicking a fleet card is how you pick which board to view now (the old
// standalone TeamSelection bar was folded into this panel to save space).
const emit = defineEmits<{ 'update:selectedTeamId': [teamId: number] }>()

// Ship status intentionally only ever shows afloat/sunk, never hit counts or
// remaining HP — showing exact damage would spoil how close a ship is to
// sinking, defeating the point of hidden fleets.
function teamShots(teamId: number) {
    return props.shots.filter((shot) => shot.attackerTeamId === teamId)
}

function shotsFired(teamId: number) {
    return teamShots(teamId).length
}

function hitsFor(teamId: number) {
    return teamShots(teamId).filter((shot) => shot.result !== 'miss').length
}

function accuracyFor(teamId: number) {
    const shots = teamShots(teamId)
    if (shots.length === 0) return 0
    return Math.round((hitsFor(teamId) / shots.length) * 100)
}
</script>
