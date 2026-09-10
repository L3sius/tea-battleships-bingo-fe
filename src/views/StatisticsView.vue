<template>
    <div class="stats-view">
        <h1 class="stats-title">Statistics</h1>

        <div class="stats-summary">
            <div v-for="stat in summaryStats" :key="stat.label" class="stats-summary-card">
                <span class="stats-summary-value">{{ stat.value }}</span>
                <span class="stats-summary-label">{{ stat.label }}</span>
            </div>
        </div>

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
                <span class="stats-team-name" :style="{ color: row.color }">{{ row.name }}</span>
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
                    {{ r.name }}
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
        <p v-if="!playerStats.some((p) => p.tasksDone || p.bonusCracked)" class="stats-hint">
            No player-attributed completions yet.
        </p>
        <div v-else class="stats-team-table">
            <div class="stats-player-row stats-player-row-head">
                <span>Player</span>
                <span>Team</span>
                <span>Tasks</span>
                <span>Top Category</span>
                <span>Hidden</span>
            </div>
            <div v-for="p in playerStats" :key="p.teamName + p.name" class="stats-player-row">
                <span class="stats-team-name">{{ p.name }}</span>
                <span :style="{ color: p.color }">{{ p.teamName }}</span>
                <span>{{ p.tasksDone }}</span>
                <span class="stats-player-cat">{{ p.topCategory ?? '—' }}</span>
                <span>{{ p.bonusCracked || '—' }}</span>
            </div>
        </div>

        <h2 class="stats-subtitle">Awards</h2>
        <div class="stats-awards">
            <div v-for="a in awards" :key="a.title" class="stats-award">
                <span class="stats-award-icon">{{ a.icon }}</span>
                <div class="stats-award-body">
                    <span class="stats-award-name">{{ a.title }}</span>
                    <span class="stats-award-sub">{{ a.subtitle }}</span>
                    <span v-if="a.winner" class="stats-award-winner">
                        {{ a.winner }} <span class="stats-award-detail">· {{ a.detail }}</span>
                    </span>
                    <span v-else class="stats-award-winner stats-award-none">Unclaimed</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/statisticsView.css'
import { computed } from 'vue'
import { useGameData } from '@/composables/useGameData'
import { teamColor } from '@/utils/teamColors'

const { teams, board, shipStatusTeams, bonusTasks, shots } = useGameData()

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

const teamRows = computed(() =>
    teams.value.map((team) => {
        const boardTeam = board.value?.teams.find((t) => t.teamId === team.id)
        const shipStatus = shipStatusTeams.value.find((t) => t.teamId === team.id)
        const teamShots = shots.value.filter((s) => s.attackerTeamId === team.id)
        return {
            teamId: team.id,
            name: team.name,
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
    topCategory: string | null
    bonusCracked: number
    firstCompletedAt: string | null
}

// Only task/bonus completions carry a real player name; shots are all fired as
// "frontend" so per-player attack stats aren't possible yet.
const playerStats = computed<PlayerStat[]>(() => {
    const allTiles = board.value?.teams.flatMap((t) => t.tiles) ?? []
    const bonusCompletions = (bonusTasks.value ?? []).flatMap((b) => b.completions ?? [])

    const rows = teams.value.flatMap((team) =>
        team.players.map((player) => {
            const mine = allTiles.filter((t) => t.completed && t.completedBy === player.name)
            const catCounts = new Map<string, number>()
            for (const t of mine) {
                const c = t.task?.category
                if (c) catCounts.set(c, (catCounts.get(c) ?? 0) + 1)
            }
            const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
            const completedAts = mine
                .map((t) => t.completedAt)
                .filter((x): x is string => !!x)
                .sort()
            return {
                name: player.name,
                teamName: team.name,
                color: teamColor(teams.value, team.id),
                tasksDone: mine.length,
                topCategory: topCategory ? capitalize(topCategory) : null,
                bonusCracked: bonusCompletions.filter((c) => c.completedBy === player.name).length,
                firstCompletedAt: completedAts[0] ?? null,
            }
        }),
    )
    return rows.sort((a, b) => b.tasksDone - a.tasksDone || a.name.localeCompare(b.name))
})

const awards = computed(() => {
    const stats = playerStats.value
    const topBy = (pick: (s: PlayerStat) => number) => {
        const best = [...stats].sort((a, b) => pick(b) - pick(a))[0]
        return best && pick(best) > 0 ? best : null
    }
    const machine = topBy((s) => s.tasksDone)
    const codebreaker = topBy((s) => s.bonusCracked)
    const trailblazer =
        [...stats]
            .filter((s) => s.firstCompletedAt)
            .sort((a, b) => (a.firstCompletedAt! < b.firstCompletedAt! ? -1 : 1))[0] ?? null

    return [
        {
            icon: '🏆',
            title: 'Task Machine',
            subtitle: 'Most tasks completed',
            winner: machine?.name ?? null,
            detail: machine ? `${machine.tasksDone} tasks` : null,
        },
        {
            icon: '🧭',
            title: 'Trailblazer',
            subtitle: 'First task on the board',
            winner: trailblazer?.name ?? null,
            detail: trailblazer ? formatWhen(trailblazer.firstCompletedAt!) : null,
        },
        {
            icon: '🔓',
            title: 'Codebreaker',
            subtitle: 'Most hidden challenges',
            winner: codebreaker?.name ?? null,
            detail: codebreaker ? `${codebreaker.bonusCracked} cracked` : null,
        },
    ]
})

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatWhen(raw: string) {
    const date = new Date(raw.replace(' ', 'T') + 'Z')
    if (Number.isNaN(date.getTime())) return raw
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>
