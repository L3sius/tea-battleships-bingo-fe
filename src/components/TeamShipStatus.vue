<template>
    <div class="panel ship-status">
        <h2 class="panel-title">Team Ship Status</h2>

        <div v-if="shipStatusTeams.length === 0" class="ship-status-empty">Waiting for fleet data…</div>

        <div v-for="team in shipStatusTeams" :key="team.teamId" class="ship-status-team">
            <div class="ship-status-team-header">
                <span class="team-name" :style="{ color: teamColor(teams, team.teamId) }">{{ team.teamName }}</span>
                <span v-if="team.fleetDestroyed" class="fleet-destroyed-badge">Fleet Destroyed</span>
            </div>

            <div class="ship-status-shots">Shots fired: <strong>{{ shotsFired(team.teamId) }}</strong></div>

            <div class="ship-status-table">
                <div class="ship-status-row ship-status-row-head">
                    <span>Ship</span>
                    <span>Status</span>
                </div>
                <div v-for="ship in team.ships" :key="ship.key" class="ship-status-row" :class="{ sunk: ship.sunk }">
                    <span class="ship-name">{{ ship.displayName }}</span>
                    <span class="ship-state-badge" :class="{ sunk: ship.sunk }">
                        {{ ship.sunk ? 'Sunk' : 'Afloat' }}
                    </span>
                </div>
            </div>
        </div>

        <img src="/images/logo.png" alt="Battleships" class="ship-status-logo" />
    </div>
</template>

<script setup lang="ts">
import '@/assets/teamShipStatus.css'
import type { Shot, ShipStatusTeam, Team } from '@/api/types'
import { teamColor } from '@/utils/teamColors'

const props = defineProps<{ teams: Team[]; shipStatusTeams: ShipStatusTeam[]; shots: Shot[] }>()

// Ship status intentionally only ever shows afloat/sunk, never hit counts or
// remaining HP — showing exact damage would spoil how close a ship is to
// sinking, defeating the point of hidden fleets.
function shotsFired(teamId: number) {
    return props.shots.filter((shot) => shot.attackerTeamId === teamId).length
}
</script>
