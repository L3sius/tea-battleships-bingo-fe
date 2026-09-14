<template>
    <div class="stats-view">
        <h1 class="stats-title">Statistics</h1>

        <div class="stats-summary">
            <div v-for="stat in summaryStats" :key="stat.label" class="stats-summary-card">
                <span class="stats-summary-value">{{ stat.value }}</span>
                <span class="stats-summary-label">{{ stat.label }}</span>
            </div>
        </div>

        <p v-if="handFixedTiles > 0" class="stats-hand-fixed">
            <strong>{{ handFixedTiles }}</strong> {{ handFixedTiles === 1 ? 'tile' : 'tiles' }} had to be completed by hand
            after Harry's backend ran aground. He insists it was a feature.
        </p>

        <h2 class="stats-subtitle">By Team</h2>
        <div class="stats-team-table">
            <div class="stats-team-row stats-team-row-head">
                <span>Team</span>
                <span>Tasks Done</span>
                <span>Shots Fired</span>
                <span>Hits</span>
                <span>Misses</span>
                <span>Ships Afloat</span>
            </div>
            <div v-for="row in teamRows" :key="row.teamId" class="stats-team-row">
                <span class="stats-team-name" :style="{ color: row.color }">
                    {{ row.name }} <span class="stats-team-count">({{ row.playerCount }})</span>
                </span>
                <span>{{ row.tasksCompleted }}</span>
                <span>{{ row.shotsFired }}</span>
                <span>{{ row.hits }}</span>
                <span>{{ row.misses }}</span>
                <span>{{ row.shipsAfloat }} / {{ row.shipsTotal }}</span>
            </div>
        </div>

        <h2 class="stats-subtitle">Team Rosters</h2>
        <p class="stats-hint">Find your name to see which fleet you're sailing with.</p>
        <div class="stats-rosters">
            <div v-for="r in rosters" :key="r.teamId" class="stats-roster">
                <div class="stats-roster-head" :style="{ '--team-color': r.color }">
                    <span class="stats-roster-dot" />
                    {{ r.name }} <span class="stats-team-count">({{ r.players.length }})</span>
                </div>
                <ul v-if="r.players.length" class="stats-roster-players">
                    <li v-for="p in r.players" :key="p.name">
                        {{ p.name }}
                        <span v-if="p.alts.length" class="stats-roster-alts">+ {{ p.alts.join(', ') }}</span>
                    </li>
                </ul>
                <p v-else class="stats-roster-empty">No players registered.</p>
            </div>
        </div>

        <h2 class="stats-subtitle">Players</h2>
        <p v-if="!playerStats.some((p) => p.tasksDone || p.bonuses.length)" class="stats-hint">
            No player-attributed completions yet.
        </p>
        <div v-else class="stats-team-table">
            <div class="stats-player-row stats-player-row-head">
                <span>Player</span>
                <span>Team</span>
                <span>Tasks</span>
                <span>Completed</span>
            </div>
            <div v-for="p in playerStats" :key="p.teamName + p.name" class="stats-player-row">
                <span class="stats-team-name">{{ p.name }}</span>
                <span :style="{ color: p.color }">{{ p.teamName }}</span>
                <span>{{ p.tasksDone }}</span>
                <span class="stats-player-tiles">
                    <span v-for="c in p.coords" :key="c" class="stats-coord-chip">{{ c }}</span>
                    <span v-for="b in p.bonuses" :key="b" class="stats-bonus-chip">★ {{ b }}</span>
                    <template v-if="!p.coords.length && !p.bonuses.length">—</template>
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/statisticsView.css'
import { computed } from 'vue'
import { useGameData } from '@/composables/useGameData'
import { teamColor } from '@/utils/teamColors'

// Masked versions, so a shot's result doesn't show here before its countdown ends.
const { teams, board, visibleShipStatus: shipStatusTeams, bonusTasks, visibleShots: shots } = useGameData()

const summaryStats = computed(() => {
    const allTiles = board.value?.teams.flatMap((t) => t.tiles) ?? []
    const tasksCompleted = allTiles.filter((t) => t.completed).length
    const totalAttacks = shots.value.length
    const totalHits = shots.value.filter((s) => s.result !== 'miss').length
    const totalMisses = shots.value.filter((s) => s.result === 'miss').length
    return [
        { label: 'Tasks Completed', value: tasksCompleted },
        { label: 'Attacks Made', value: totalAttacks },
        { label: 'Total Hits', value: totalHits },
        { label: 'Total Misses', value: totalMisses },
    ]
})

// Completed tiles with no player credited — admin force-completes from when the
// backend misbehaved.
const handFixedTiles = computed(
    () => (board.value?.teams ?? []).flatMap((t) => t.tiles).filter((t) => t.completed && !t.completedBy).length,
)

const teamRows = computed(() =>
    teams.value.map((team) => {
        const boardTeam = board.value?.teams.find((t) => t.teamId === team.id)
        const shipStatus = shipStatusTeams.value.find((t) => t.teamId === team.id)
        const teamShots = shots.value.filter((s) => s.attackerTeamId === team.id)
        return {
            teamId: team.id,
            name: team.name,
            // alts are nested under their main, so this counts people, not accounts
            playerCount: team.players.length,
            color: teamColor(teams.value, team.id),
            tasksCompleted: boardTeam?.tiles.filter((t) => t.completed).length ?? 0,
            shotsFired: teamShots.length,
            hits: teamShots.filter((s) => s.result !== 'miss').length,
            misses: teamShots.filter((s) => s.result === 'miss').length,
            shipsAfloat: shipStatus?.ships.filter((s) => !s.sunk).length ?? 0,
            shipsTotal: shipStatus?.ships.length ?? 0,
        }
    }),
)

const rosters = computed(() =>
    teams.value.map((team) => ({
        teamId: team.id,
        name: team.name,
        color: teamColor(teams.value, team.id),
        players: team.players,
    })),
)

interface PlayerStat {
    name: string
    teamName: string
    color: string
    tasksDone: number
    /** Tiles they completed, in the order they completed them. */
    coords: string[]
    /** Titles of the hidden challenges they claimed. */
    bonuses: string[]
}

// Only task/bonus completions carry a real player name; shots are all fired as
// "frontend" so per-player attack stats aren't possible yet.
const playerStats = computed<PlayerStat[]>(() => {
    const allTiles = board.value?.teams.flatMap((t) => t.tiles) ?? []
    const claimed = (bonusTasks.value ?? []).filter((b) => b.completedBy)

    const rows = teams.value.flatMap((team) =>
        team.players.map((player) => {
            const mine = allTiles.filter((t) => t.completed && t.completedBy === player.name)
            return {
                name: player.name,
                teamName: team.name,
                color: teamColor(teams.value, team.id),
                tasksDone: mine.length,
                coords: [...mine]
                    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
                    .map((t) => t.coord),
                bonuses: claimed.filter((b) => b.completedBy === player.name).map((b) => b.title ?? 'Hidden challenge'),
            }
        }),
    )
    // Claimed challenges break ties, so bonus-only players don't sink among the zeroes.
    return rows.sort(
        (a, b) => b.tasksDone - a.tasksDone || b.bonuses.length - a.bonuses.length || a.name.localeCompare(b.name),
    )
})
</script>
