<template>
    <div class="battle-board-wrapper">
        <div class="battle-board-top-labels">
            <span class="battle-board-corner"></span>
            <span v-for="col in columns" :key="col" class="battle-board-label">{{ col }}</span>
        </div>

        <div class="battle-board-main">
            <div class="battle-board-left-labels">
                <span v-for="row in rows" :key="row" class="battle-board-label">{{ row }}</span>
            </div>

            <div class="battle-board-grid" ref="gridEl">
                <template v-if="boardTeam">
                    <div v-for="tile in boardTeam.tiles" :key="tile.coord" class="battle-board-cell"
                        :class="tileClasses(tile)" :style="tileGridStyle(tile.coord)" :data-coord="tile.coord"
                        @click="onTileClick(tile)">
                        <img v-if="tile.task?.imageUrl && !isSunkCell(tile.coord)" class="tile-item-icon"
                            :class="{ dimmed: tile.completed }" :src="localItemImagePath(tile.task.imageUrl) ?? tile.task.imageUrl"
                            :alt="tile.task.name" @error="onImageError($event, tile.task.imageUrl)" />

                        <span v-if="!tile.completed && tile.target > 1 && tile.progress > 0" class="tile-progress-track">
                            <span class="tile-progress-fill" :style="{ width: progressPercent(tile) + '%' }"></span>
                        </span>

                        <span v-if="tile.completed && !tile.fired" class="tile-fire-icon">⌖</span>

                        <span v-if="tile.fired && !isSunkCell(tile.coord) && !pendingReveal.has(tile.coord)"
                            class="shot-marker" :class="outgoingClass(tile.coord)">
                            {{ outgoingSymbol(tile.coord) }}
                        </span>
                    </div>

                    <div v-for="ship in sunkShips" :key="'sunk-' + ship.key" class="sunk-ship-reveal"
                        :style="sunkShipStyle(ship)" :title="`You sank the enemy ${capitalize(ship.key)}`">
                        ☠ {{ capitalize(ship.key) }}
                    </div>

                    <template v-for="shot in activeShots" :key="shot.id">
                        <CannonShot v-if="shot.attackType === 'cannon'" :target-el="shot.targetEl"
                            :result="shot.result" @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <NukeDrop v-else-if="shot.attackType === 'nuke'" :target-el="shot.targetEl"
                            :result="shot.result" @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <OrbitalLaser v-else-if="shot.attackType === 'laser'" :target-el="shot.targetEl"
                            :result="shot.result" @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <KrakenTentacle v-else-if="shot.attackType === 'kraken'" :target-el="shot.targetEl"
                            :result="shot.result" @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <StormStrike v-else :target-el="shot.targetEl" :result="shot.result"
                            @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                    </template>

                    <template v-if="showTestShips">
                        <div v-for="ship in testFleet" :key="'test-' + ship.key" class="test-ship"
                            :style="testShipStyle(ship)" :title="`TEST DATA (fake): ${ship.displayName}`">
                            {{ ship.displayName }}
                        </div>
                    </template>
                </template>
                <div v-else class="battle-board-placeholder">{{ placeholderMessage }}</div>
            </div>
        </div>

        <div v-if="selectedTile" class="tile-modal-backdrop" @click.self="selectedCoord = null">
            <div class="tile-modal">
                <div class="tile-modal-header">
                    <h3>{{ selectedTile.coord }}</h3>
                    <button class="tile-modal-close" @click="selectedCoord = null">✕</button>
                </div>

                <div v-if="selectedTile.task" class="tile-modal-body">
                    <img v-if="selectedTile.task.imageUrl" class="tile-modal-icon"
                        :src="localItemImagePath(selectedTile.task.imageUrl) ?? selectedTile.task.imageUrl"
                        :alt="selectedTile.task.name" @error="onImageError($event, selectedTile.task.imageUrl)" />

                    <h4 class="tile-modal-name">{{ selectedTile.task.name }}</h4>
                    <p class="tile-modal-description">{{ selectedTile.task.description }}</p>

                    <div v-if="selectedTile.target > 1" class="tile-modal-progress">
                        <span class="tile-progress-track">
                            <span class="tile-progress-fill" :style="{ width: progressPercent(selectedTile) + '%' }"></span>
                        </span>
                        <span>{{ selectedTile.progress }}/{{ selectedTile.target }}</span>
                    </div>

                    <p class="tile-modal-status" :class="statusClass(selectedTile)">{{ statusText(selectedTile) }}</p>

                    <button v-if="canFire(selectedTile)" class="tile-modal-fire-btn" @click="fireSelectedTile">
                        Fire at {{ selectedTile.coord }}!
                    </button>
                </div>
                <div v-else class="tile-modal-body">
                    <p>No task assigned to this tile yet.</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/battleshipBoard.css'
import { computed, ref, watch } from 'vue'
import type { BoardTeam, BoardTile, FireResponse, GetBoardResponse, Shot, ShotResult } from '@/api/types'
import { parseCoord } from '@/utils/coord'
import { generateFakeFleet, type FakeShipPlacement } from '@/utils/fakeFleet'
import { localItemImagePath } from '@/utils/itemImage'
import CannonShot from './CannonShot.vue'
import NukeDrop from './NukeDrop.vue'
import OrbitalLaser from './OrbitalLaser.vue'
import KrakenTentacle from './KrakenTentacle.vue'
import StormStrike from './StormStrike.vue'

const props = defineProps<{
    teamId: number | null
    board: GetBoardResponse | null
    shots: Shot[]
    showTestShips?: boolean
    /** Dev-only: pin every shot to this attack style instead of picking randomly. */
    forceAttackType?: 'cannon' | 'nuke' | 'laser' | 'kraken' | 'storm' | null
    /** Parent owns the actual API call (and the board/shots refetch it triggers). */
    onFire: (coord: string) => Promise<FireResponse>
}>()

const emit = defineEmits<{ 'fire-result': [result: FireResponse]; 'fire-error': [error: unknown] }>()

const gridEl = ref<HTMLElement>()

const gridSize = computed(() => props.board?.boardSize ?? 10)
const columns = computed(() => Array.from({ length: gridSize.value }, (_, i) => String.fromCharCode(65 + i)))
const rows = computed(() => Array.from({ length: gridSize.value }, (_, i) => i + 1))

const boardTeam = computed<BoardTeam | undefined>(() => {
    if (!props.board?.layoutGenerated) return undefined
    return props.board.teams.find((t) => t.teamId === props.teamId)
})

const placeholderMessage = computed(() => {
    if (!props.board) return 'Loading board…'
    if (!props.board.layoutGenerated) return 'Waiting for both fleets to lock in…'
    return 'No board data for this team yet.'
})

function tileGridStyle(coord: string) {
    const { row, col } = parseCoord(coord)
    return {
        gridRow: `${row + 1} / span 1`,
        gridColumn: `${col + 1} / span 1`,
    }
}

function tileClasses(tile: BoardTile) {
    return {
        completed: tile.completed,
        fireable: tile.completed && !tile.fired,
        fired: tile.fired,
    }
}

function progressPercent(tile: BoardTile) {
    if (tile.target <= 0) return 0
    return Math.min(100, Math.round((tile.progress / tile.target) * 100))
}

// Once a tile is fired, its marker shows the RESULT of the shot you took with
// it (hit/miss/sunk on the enemy) — not enemy fire landing on you. Damage you've
// taken is a team-wide stat shown in Team Ship Status, not per-tile here.
const myShots = computed(() => {
    const map = new Map<string, Shot>()
    for (const shot of props.shots) {
        if (shot.attackerTeamId === props.teamId) map.set(shot.coord, shot)
    }
    return map
})

function outgoingClass(coord: string) {
    const result = myShots.value.get(coord)?.result
    if (result === 'miss') return 'miss'
    if (result === 'sunk') return 'sunk'
    return 'hit'
}

function outgoingSymbol(coord: string) {
    const result = myShots.value.get(coord)?.result
    if (result === 'miss') return ''
    if (result === 'sunk') return '☠'
    return '✕'
}

// A ship you've fully sunk gets its real, exact shape revealed (the backend
// only sends the cells once a ship is dead — see sunkShipCells). Every one of
// those cells stops showing its own hit marker and gets covered by one shape
// spanning the whole ship instead.
interface SunkShip {
    key: string
    row: number
    col: number
    length: number
    orientation: 'horizontal' | 'vertical'
}

const sunkShips = computed<SunkShip[]>(() => {
    const ships: SunkShip[] = []
    for (const shot of props.shots) {
        if (shot.attackerTeamId !== props.teamId || shot.result !== 'sunk' || !shot.sunkShipCells?.length) continue
        // Same reveal-timing rule as the plain hit/miss marker: don't show the
        // ship's real shape until the shot that sank it has finished animating.
        if (pendingReveal.value.has(shot.coord)) continue
        const cells = shot.sunkShipCells.map(parseCoord)
        const rows = cells.map((c) => c.row)
        const cols = cells.map((c) => c.col)
        ships.push({
            key: shot.sunkShipKey ?? 'ship',
            row: Math.min(...rows),
            col: Math.min(...cols),
            length: cells.length,
            orientation: new Set(rows).size === 1 ? 'horizontal' : 'vertical',
        })
    }
    return ships
})

const sunkCellCoords = computed(() => {
    const coords = new Set<string>()
    for (const shot of props.shots) {
        if (shot.attackerTeamId === props.teamId && shot.result === 'sunk' && !pendingReveal.value.has(shot.coord)) {
            for (const coord of shot.sunkShipCells ?? []) coords.add(coord)
        }
    }
    return coords
})

function isSunkCell(coord: string) {
    return sunkCellCoords.value.has(coord)
}

function sunkShipStyle(ship: SunkShip) {
    return {
        gridRow: `${ship.row + 1} / span ${ship.orientation === 'vertical' ? ship.length : 1}`,
        gridColumn: `${ship.col + 1} / span ${ship.orientation === 'horizontal' ? ship.length : 1}`,
    }
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

// If our local mirror doesn't have this icon (yet), fall back to the wiki
// URL the backend gave us directly. Guarded so a failing remote URL can't
// loop back into itself.
function onImageError(event: Event, remoteUrl: string | null) {
    const img = event.target as HTMLImageElement
    if (!remoteUrl || img.dataset.fallback === '1') return
    img.dataset.fallback = '1'
    img.src = remoteUrl
}

// Clicking a tile opens a detail panel rather than firing immediately — the
// explicit "Fire!" button inside it is the actual confirmation step.
const selectedCoord = ref<string | null>(null)

const selectedTile = computed<BoardTile | null>(() => {
    if (!selectedCoord.value) return null
    return boardTeam.value?.tiles.find((t) => t.coord === selectedCoord.value) ?? null
})

function onTileClick(tile: BoardTile) {
    selectedCoord.value = tile.coord
}

function canFire(tile: BoardTile) {
    return tile.completed && !tile.fired
}

function statusText(tile: BoardTile): string {
    if (!tile.completed) return 'Not completed yet.'
    if (!tile.fired) return 'Completed — ready to fire!'
    if (pendingReveal.value.has(tile.coord)) return 'Firing…'
    const shot = myShots.value.get(tile.coord)
    if (shot?.result === 'sunk') return `Fired — sank the enemy ${shot.sunkShipKey}!`
    if (shot?.result === 'hit') return 'Fired — hit!'
    if (shot?.result === 'miss') return 'Fired — missed.'
    return 'Already fired.'
}

function statusClass(tile: BoardTile) {
    if (!tile.completed) return 'pending'
    if (!tile.fired) return 'ready'
    if (pendingReveal.value.has(tile.coord)) return 'ready'
    return myShots.value.get(tile.coord)?.result === 'miss' ? 'miss' : 'hit'
}

// Firing plays an animation while the real /fire call happens in the
// background; the outcome only gets revealed once BOTH the projectile has
// visually landed and the network result is known (see CannonShot).
type AttackType = 'cannon' | 'nuke' | 'laser' | 'kraken' | 'storm'
const ATTACK_TYPES: AttackType[] = ['cannon', 'nuke', 'laser', 'kraken', 'storm']

interface ActiveShot {
    id: number
    coord: string
    targetEl: HTMLElement
    result: ShotResult | null
    attackType: AttackType
    /** Held back until the animation's burst, so the toast isn't a spoiler. */
    fireResponse: FireResponse | null
}

let nextShotId = 0
const activeShots = ref<ActiveShot[]>([])

// The tile's own hit/miss icon is driven by `props.shots`, which updates as
// soon as the network call resolves — often well before the cannonball has
// even landed. Suppress it for coords with an animation in flight so it pops
// in sync with the animation's own impact instead of spoiling it early.
const pendingReveal = ref<Set<string>>(new Set())

async function fireSelectedTile() {
    if (!selectedTile.value) return
    const coord = selectedTile.value.coord
    selectedCoord.value = null

    const targetEl = gridEl.value?.querySelector<HTMLElement>(`[data-coord="${coord}"]`)
    if (!targetEl || !gridEl.value) {
        // No DOM target to aim the animation at — just fire directly.
        try {
            emit('fire-result', await props.onFire(coord))
        } catch (err) {
            emit('fire-error', err)
        }
        return
    }

    const id = nextShotId++
    const attackType: AttackType = props.forceAttackType ?? ATTACK_TYPES[Math.floor(Math.random() * ATTACK_TYPES.length)]!
    activeShots.value.push({ id, coord, targetEl, result: null, attackType, fireResponse: null })
    pendingReveal.value.add(coord)

    try {
        const result = await props.onFire(coord)
        // Push wrapped the object in a new reactive proxy — mutate that one
        // (found via the array), not the raw object literal above, or the
        // CannonShot's `result` prop will never actually update.
        const shot = activeShots.value.find((s) => s.id === id)
        if (shot) {
            shot.result = result.result
            shot.fireResponse = result
        }
        // Don't emit fire-result yet — the toast should land in sync with the
        // animation's own reveal (see onShotBurst), not spoil it early.
    } catch (err) {
        activeShots.value = activeShots.value.filter((s) => s.id !== id)
        pendingReveal.value.delete(coord)
        emit('fire-error', err)
    }
}

function onShotBurst(coord: string) {
    pendingReveal.value.delete(coord)
    const shot = activeShots.value.find((s) => s.coord === coord)
    if (shot?.fireResponse) emit('fire-result', shot.fireResponse)
}

function onShotDone(id: number) {
    const shot = activeShots.value.find((s) => s.id === id)
    if (shot) pendingReveal.value.delete(shot.coord)
    activeShots.value = activeShots.value.filter((s) => s.id !== id)
}

// Dev-only fake fleet overlay — the API never sends real ship positions, so
// this is randomly generated client-side purely for visual/layout QA.
const testFleet = ref<FakeShipPlacement[]>([])

watch(
    [() => props.showTestShips, () => props.teamId],
    () => {
        if (props.showTestShips) {
            testFleet.value = generateFakeFleet(gridSize.value)
        }
    },
    { immediate: true },
)

function testShipStyle(ship: FakeShipPlacement) {
    const [startRow, startCol] = ship.cells[0]!
    return {
        gridRow: `${startRow + 1} / span ${ship.orientation === 'vertical' ? ship.length : 1}`,
        gridColumn: `${startCol + 1} / span ${ship.orientation === 'horizontal' ? ship.length : 1}`,
    }
}
</script>
