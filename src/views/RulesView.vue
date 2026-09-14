<template>
    <div class="rules-view">
        <h1 class="rules-title">Event Rules</h1>

        <section v-for="section in sections" :key="section.title" class="rules-card">
            <h2 class="rules-card-title">{{ section.title }}</h2>
            <p v-for="(para, i) in section.paragraphs" :key="i" class="rules-card-body">{{ para }}</p>
            <ul v-if="section.items?.length" class="rules-list">
                <li v-for="item in section.items" :key="item">{{ item }}</li>
            </ul>
        </section>
    </div>
</template>

<script setup lang="ts">
import '@/assets/rulesView.css'
import { computed } from 'vue'
import { ATTACK_WARNING_MS, useGameData } from '@/composables/useGameData'

const { board, shipStatusTeams, bonusTasks } = useGameData()

interface RulesSection {
    title: string
    paragraphs: string[]
    items?: string[]
}

// The fleet, board size and challenge count are read from the live API rather
// than written into the copy, so the rules can't drift from the real game the
// way the old hardcoded 5-ship fleet did.
const fleet = computed(() => {
    const ships = shipStatusTeams.value[0]?.ships ?? []
    const classes = new Map<string, { name: string; length: number; count: number }>()
    for (const s of ships) {
        const key = `${s.displayName}|${s.length}`
        const c = classes.get(key)
        if (c) c.count++
        else classes.set(key, { name: s.displayName, length: s.length, count: 1 })
    }
    return {
        hulls: ships.length,
        cells: ships.reduce((n, s) => n + s.length, 0),
        classes: [...classes.values()].sort((a, b) => a.length - b.length || a.name.localeCompare(b.name)),
    }
})

const sections = computed<RulesSection[]>(() => {
    const size = board.value?.boardSize ?? 10
    const lastCol = String.fromCharCode(64 + size)
    const warnSeconds = Math.round(ATTACK_WARNING_MS / 1000)
    const f = fleet.value
    const hidden = bonusTasks.value.length

    return [
        {
            title: 'Getting Started',
            paragraphs: [
                'Progress is tracked automatically through the Dink RuneLite plugin. Hit Dink setup in the top-right corner and follow the steps before you start playing.',
                'Your account and any alts must be on your team’s roster — drops on an alt count for you. If the live feed says you’re not in any team, ask an organiser to add you. Nothing counts before the event officially starts.',
            ],
        },
        {
            title: 'The Board',
            paragraphs: [
                `The board is a ${size}×${size} grid (A–${lastCol} across, 1–${size} down) and every tile is an OSRS task. Both teams get the same task on each tile, but each team’s progress is its own.`,
                'Some tiles need several drops or kills — the green bar on the tile shows how far along you are. Hover a tile to read its task, or click it for the full details.',
            ],
        },
        {
            title: 'Completing Tiles',
            paragraphs: [
                'Loot, kill counts, slayer tasks, clue caskets, combat achievements, pets and more are picked up from Dink automatically.',
                'A single drop advances at most one tile: the most specific match wins, then whichever tile is closest to done. The same drop can still count towards a hidden challenge.',
            ],
        },
        {
            title: 'Firing',
            paragraphs: [
                'Every completed tile earns one shot at the same coordinate in the enemy’s waters. Click the tile and press Fire — each tile can only be fired once.',
                `When anyone fires, a ${warnSeconds}-second “Attack incoming” countdown plays for everyone, with a siren, and the attacking team’s card blinks in the Fleets panel. Switch to that team’s board to watch the shot land.`,
                'A hit leaves a red ✕ on the tile; a miss leaves a blue dot.',
            ],
        },
        {
            title: 'Your Board',
            paragraphs: [
                'Select your team in the Fleets panel to view your board. It shows your team’s tiles and progress, the shots you’ve fired, and every enemy ship you’ve sunk, revealed with its artwork.',
                'Damage the enemy has done to your own fleet isn’t shown on your board.',
            ],
        },
        {
            title: 'The Fleets',
            paragraphs: [
                f.hulls
                    ? `Each team has ${f.hulls} ships covering ${f.cells} tiles:`
                    : 'Each team has a secret fleet of ships.',
            ],
            items: f.classes.map((c) => `${c.count}× ${c.name} — ${c.length} ${c.length === 1 ? 'tile' : 'tiles'}`),
        },
        {
            title: 'Keeping Fleets Secret',
            paragraphs: [
                'Captains place their fleet secretly in Discord and lock it in before the tasks are revealed. Ship positions stay hidden until a ship is sunk, and the Fleets panel only ever shows afloat or sunk — never how damaged a ship is.',
            ],
        },
        {
            title: 'Hidden Challenges',
            paragraphs: [
                `${hidden ? `${hidden} secret achievements are` : 'Secret achievements are'} hidden in the event. The first player to complete one claims it outright, and it closes for everyone else — including the other team.`,
                'A claimed challenge is revealed on the board with the claimer’s name. They’re for glory — they don’t affect the battle.',
            ],
        },
        {
            title: 'Winning',
            paragraphs: ['The first team to sink every ship in the enemy fleet wins.'],
        },
    ]
})
</script>
