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
                <span v-if="attackingTeams.has(team.teamId)" class="ship-status-incoming-badge">Attack incoming</span>
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

            <div class="ship-status-fleet-head">
                <span class="ship-status-fleet-label">Fleet</span>
                <span class="ship-status-fleet-count">{{ afloatCount(team) }} / {{ team.ships.length }} afloat</span>
            </div>

            <!-- Afloat hulls are silhouettes; sinking one reveals its art — still
                 just the afloat/sunk bit, no damage detail. Each hull keeps its true
                 aspect inside a fixed tile, so a long ship reads as a thin sliver
                 and a short one as a chunky block. -->
            <div class="ship-status-fleet">
                <span v-for="ship in team.ships" :key="ship.key" class="fleet-hull"
                    :class="{ sunk: ship.sunk, upright: ship.length === 1 }" :style="{ '--hull-len': ship.length }"
                    :title="`${ship.displayName} (${ship.length}) — ${ship.sunk ? 'Sunk' : 'Afloat'}`">
                    <span class="fleet-hull-frame">
                        <img v-if="ship.sunk && ship.image" class="fleet-hull-art" :src="hullSrc(ship.image)"
                            :alt="`${ship.displayName}, sunk`" />
                        <span v-else-if="ship.image" class="fleet-hull-mask"
                            :style="{ '--hull-mask': `url('${hullSrc(ship.image)}')` }" />
                        <span v-else class="fleet-hull-fallback">{{ ship.length }}</span>
                    </span>
                    <span class="fleet-hull-name">{{ ship.displayName }}</span>
                </span>
            </div>
        </button>
    </div>
</template>

<script setup lang="ts">
import '@/assets/teamShipStatus.css'
import { computed } from 'vue'
import type { Shot, ShipStatusTeam, Team } from '@/api/types'
import type { PendingAttack } from '@/composables/useGameData'
import { teamColor } from '@/utils/teamColors'

const props = defineProps<{
    teams: Team[]
    shipStatusTeams: ShipStatusTeam[]
    shots: Shot[]
    /** Which team's board is currently shown — the card for it reads "Active". */
    selectedTeamId: number | null
    /** Shots mid-countdown; their attacker's card blinks so people can go watch. */
    pendingAttacks?: PendingAttack[]
}>()

// The animation plays on the attacking team's board, so that is the card to
// send people to while the countdown runs.
const attackingTeams = computed(() => new Set((props.pendingAttacks ?? []).map((a) => a.attackerTeamId)))

// Clicking a fleet card is how you pick which board to view now (the old
// standalone TeamSelection bar was folded into this panel to save space).
const emit = defineEmits<{ 'update:selectedTeamId': [teamId: number] }>()

function hullSrc(image: string) {
    return /^(https?:)?\//.test(image) ? image : `/images/ships/${image}`
}

function afloatCount(team: ShipStatusTeam) {
    return team.ships.filter((s) => !s.sunk).length
}

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
