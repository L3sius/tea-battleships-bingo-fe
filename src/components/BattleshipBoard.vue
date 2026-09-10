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
                        @click="onTileClick(tile)" @mouseenter="hoveredCoord = tile.coord"
                        @mouseleave="hoveredCoord = null">
                        <!-- Cells under a revealed wreck show nothing but the hull art laid over them. -->
                        <template v-if="!isSunkCell(tile.coord)">
                            <img v-if="tile.task?.imageUrl" class="tile-item-icon" :class="{ dimmed: tile.completed }"
                                :src="localItemImagePath(tile.task.imageUrl) ?? tile.task.imageUrl"
                                :alt="tile.task.name" @error="onImageError($event, tile.task.imageUrl)" />

                            <span v-if="!tile.completed && tile.target > 1 && tile.progress > 0"
                                class="tile-progress-track">
                                <span class="tile-progress-fill" :style="{ width: progressPercent(tile) + '%' }"></span>
                            </span>

                            <span v-if="tile.completed && !tile.fired" class="tile-fire-icon">⌖</span>
                        </template>

                        <!-- The hit marker stays visible over a wreck, just dimmed so the hull reads through. -->
                        <span v-if="tile.fired && !pendingReveal.has(tile.coord)" class="shot-marker"
                            :class="[outgoingClass(tile.coord), { 'over-wreck': isSunkCell(tile.coord) }]">
                            {{ outgoingSymbol(tile.coord) }}
                        </span>

                        <span v-if="hoveredCoord === tile.coord" class="tile-coord-tooltip">{{ tile.coord }}</span>
                    </div>

                    <div v-for="ship in sunkShips" :key="'sunk-' + ship.key" class="sunk-ship-reveal"
                        :class="{ vertical: ship.orientation === 'vertical', 'has-img': ship.image }"
                        :style="sunkShipStyle(ship)" :title="`You sank the enemy ${capitalize(ship.key)}`">
                        <img v-if="ship.image" class="sunk-ship-img" :src="shipImageSrc(ship.image)"
                            :alt="capitalize(ship.key)" @error="onShipImgError(ship.image)" />
                        <template v-else>{{ capitalize(ship.key) }}</template>
                    </div>

                    <template v-for="shot in activeShots" :key="shot.id">
                        <CannonShot v-if="shot.attackType === 'cannon'" :target-el="shot.targetEl"
                            :result="shot.result" :attacker-color="attackerColor" :defender-name="defenderName(shot)"
                            @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <NukeDrop v-else-if="shot.attackType === 'nuke'" :target-el="shot.targetEl"
                            :result="shot.result" :attacker-color="attackerColor" :defender-name="defenderName(shot)"
                            @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <OrbitalLaser v-else-if="shot.attackType === 'laser'" :target-el="shot.targetEl"
                            :result="shot.result" :attacker-color="attackerColor" :defender-name="defenderName(shot)"
                            @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <KrakenTentacle v-else-if="shot.attackType === 'kraken'" :target-el="shot.targetEl"
                            :result="shot.result" :attacker-color="attackerColor" :defender-name="defenderName(shot)"
                            @burst="onShotBurst(shot.coord)" @done="onShotDone(shot.id)" />
                        <StormStrike v-else :target-el="shot.targetEl" :result="shot.result"
                            :attacker-color="attackerColor" :defender-name="defenderName(shot)"
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

        <div v-if="selectedTile" class="tile-modal-backdrop" @click.self="closeModal">
            <div class="tile-modal">
                <div class="tile-modal-header">
                    <div class="tile-modal-header-left">
                        <span class="tile-modal-coord">{{ selectedTile.coord }}</span>
                        <span class="tile-modal-status-pill" :class="statusClass(selectedTile)">{{ statusText(selectedTile) }}</span>
                    </div>
                    <button class="tile-modal-close" @click="closeModal">✕</button>
                </div>

                <div v-if="selectedTile.task" class="tile-modal-body">
                    <div class="tile-modal-icon-frame">
                        <img v-if="selectedTile.task.imageUrl" class="tile-modal-icon"
                            :src="localItemImagePath(selectedTile.task.imageUrl) ?? selectedTile.task.imageUrl"
                            :alt="selectedTile.task.name" @error="onImageError($event, selectedTile.task.imageUrl)" />
                    </div>
                    <h4 class="tile-modal-name">{{ selectedTile.task.name }}</h4>

                    <div class="tile-modal-section">
                        <label class="tile-modal-label">Description</label>
                        <p class="tile-modal-description">{{ selectedTile.task.description }}</p>
                    </div>

                    <div v-if="selectedTile.target > 1" class="tile-modal-section">
                        <div class="tile-modal-section-head">
                            <label class="tile-modal-label">Progress</label>
                            <span class="tile-modal-progress-count">{{ selectedTile.progress }}/{{ selectedTile.target }}</span>
                        </div>
                        <span class="tile-progress-track tile-modal-progress-track">
                            <span class="tile-progress-fill" :style="{ width: progressPercent(selectedTile) + '%' }"></span>
                        </span>
                    </div>
                </div>
                <div v-else class="tile-modal-body">
                    <p>No task assigned to this tile yet.</p>
                </div>

                <div v-if="selectedTile.task" class="tile-modal-footer">
                    <button v-if="canFire(selectedTile)" class="tile-modal-fire-btn" :class="{ firing }"
                        :disabled="firing" @click="fireSelectedTile">
                        <span v-if="firing" class="tile-modal-fire-spinner" aria-hidden="true" />
                        {{ firing ? 'Attack incoming…' : '⚓ Fire' }}
                    </button>
                    <button v-else class="tile-modal-cancel-btn tile-modal-close-btn" @click="closeModal">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/battleshipBoard.css'
import { computed, onUnmounted, ref, watch } from 'vue'
import type { BoardTeam, BoardTile, FireResponse, GetBoardResponse, ShipStatusShip, Shot, ShotResult, Team } from '@/api/types'
import { ATTACK_WARNING_MS, type ShotFiredSignal } from '@/composables/useGameData'
import { reconstructSunkShips } from '@/utils/sunkFleet'
import { parseCoord } from '@/utils/coord'
import { generateFakeFleet, type FakeShipPlacement } from '@/utils/fakeFleet'
import { localItemImagePath } from '@/utils/itemImage'
import { teamColor } from '@/utils/teamColors'
import CannonShot from './CannonShot.vue'
import NukeDrop from './NukeDrop.vue'
import OrbitalLaser from './OrbitalLaser.vue'
import KrakenTentacle from './KrakenTentacle.vue'
import StormStrike from './StormStrike.vue'

const props = defineProps<{
    teamId: number | null
    teams: Team[]
    board: GetBoardResponse | null
    shots: Shot[]
    showTestShips?: boolean
    /** Dev-only: pin every shot to this attack style instead of the seed-derived one. */
    forceAttackType?: 'cannon' | 'nuke' | 'laser' | 'kraken' | 'storm' | null
    /** Newest shot from the game stream — replays its animation for observers. */
    lastShotFired?: ShotFiredSignal | null
    /** The OPPOSING team's fleet (from /getShipStatus) — hull lengths and art. */
    enemyFleet?: ShipStatusShip[]
    /** Parent owns the actual API call (and the board/shots refetch it triggers). */
    onFire: (coord: string) => Promise<FireResponse>
}>()

// Shared by every attack's AttackImpact reveal: the mast flag on the
// ship-sunk scene, and the "<team>'s fleet takes a direct hit" caption.
const attackerColor = computed(() => teamColor(props.teams, props.teamId ?? -1))

function defenderName(shot: ActiveShot) {
    return shot.fireResponse?.targetTeamName ?? null
}

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
    // A wreck covers its cells completely, so none of the task-state tints or
    // the fireable ring should show around the hull.
    if (isSunkCell(tile.coord)) return { 'sunk-cell': true }
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
    return myShots.value.get(coord)?.result === 'miss' ? '' : '✕'
}

// A ship you've fully sunk gets its real, exact shape revealed (the backend
// only sends the cells once a ship is dead — see sunkShipCells). Every one of
// those cells stops showing its own hit marker and gets covered by one shape
// spanning the whole ship instead.
const failedShipImages = ref<Set<string>>(new Set())

function shipImageSrc(name: string): string {
    return /^(https?:)?\//.test(name) ? name : `/images/ships/${name}`
}

function onShipImgError(name: string | null) {
    if (name) failedShipImages.value = new Set(failedShipImages.value).add(name)
}

// This grid is a targeting view of the enemy's waters: the wrecks on it are the
// enemy hulls THIS team destroyed, rebuilt from the cells this team landed hits
// on. (Damage this team has taken lives on `tile.incoming` and belongs to the
// enemy's own view — it is deliberately not drawn here.)
const sunkShips = computed(() => {
    if (props.teamId === null || !props.enemyFleet?.length) return []
    const myDamage = props.shots
        .filter((s) => s.attackerTeamId === props.teamId && s.result !== 'miss')
        .map((s) => ({ coord: s.coord, sunkShipKey: s.sunkShipKey }))
    return reconstructSunkShips(myDamage, props.enemyFleet, gridSize.value, pendingReveal.value).map((ship) => ({
        ...ship,
        image: ship.image && !failedShipImages.value.has(ship.image) ? ship.image : null,
    }))
})

const sunkCellCoords = computed(() => {
    const coords = new Set<string>()
    for (const ship of sunkShips.value) {
        for (const coord of ship.cells) coords.add(coord)
    }
    return coords
})

function isSunkCell(coord: string) {
    return sunkCellCoords.value.has(coord)
}

function sunkShipStyle(ship: { row: number; col: number; length: number; orientation: 'horizontal' | 'vertical' }) {
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

// Clicking a tile opens a detail drawer rather than firing immediately — the
// "Fire" button in that drawer is the actual trigger.
const selectedCoord = ref<string | null>(null)
const hoveredCoord = ref<string | null>(null)

const selectedTile = computed<BoardTile | null>(() => {
    if (!selectedCoord.value) return null
    return boardTeam.value?.tiles.find((t) => t.coord === selectedCoord.value) ?? null
})

function onTileClick(tile: BoardTile) {
    selectedCoord.value = tile.coord
}

function closeModal() {
    selectedCoord.value = null
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

// Firing plays an animation, then reveals the outcome once BOTH the projectile
// has visually landed and the network result is known (see CannonShot). The
// attack style is derived from the backend's per-shot `animationSeed` (mod the
// number of styles) so every client — the firer and every observer watching
// that team's board — plays the exact same animation and sound.
type AttackType = 'cannon' | 'nuke' | 'laser' | 'kraken' | 'storm'
const ATTACK_TYPES: AttackType[] = ['cannon', 'nuke', 'laser', 'kraken', 'storm']

function attackTypeForSeed(seed: number): AttackType {
    const n = ATTACK_TYPES.length
    return ATTACK_TYPES[((Math.trunc(seed) % n) + n) % n]!
}

interface ActiveShot {
    id: number
    coord: string
    attackerTeamId: number
    targetEl: HTMLElement
    result: ShotResult | null
    attackType: AttackType
    /** Held back until the animation's burst, so the toast isn't a spoiler. */
    fireResponse: FireResponse | null
}

let nextShotId = 0
const activeShots = ref<ActiveShot[]>([])

// `${attackerTeamId}:${coord}` for shots already animated, so the local fire
// call and the shot_fired stream echo (whichever lands first) don't double up.
const seenShots = new Set<string>()

// The tile's own hit/miss icon is driven by `props.shots`, which updates as
// soon as the network call resolves — often well before the cannonball has
// even landed. Suppress it for coords with an animation in flight so it pops
// in sync with the animation's own impact instead of spoiling it early.
const pendingReveal = ref<Set<string>>(new Set())

function spawnShot(
    coord: string,
    attackerTeamId: number,
    result: ShotResult,
    attackType: AttackType,
    fireResponse: FireResponse | null,
): boolean {
    const targetEl = gridEl.value?.querySelector<HTMLElement>(`[data-coord="${coord}"]`)
    if (!targetEl) return false
    pendingReveal.value.add(coord)
    activeShots.value.push({ id: nextShotId++, coord, attackerTeamId, targetEl, result, attackType, fireResponse })
    return true
}

const firing = ref(false)
let fireTimer: ReturnType<typeof setTimeout> | undefined
// Fire responses parked until their (delayed) animation bursts, so the outcome
// toast still lands in sync with the reveal rather than 9s early.
const pendingFireResponses = new Map<string, FireResponse>()

async function fireSelectedTile() {
    if (!selectedTile.value || props.teamId === null || firing.value) return
    const coord = selectedTile.value.coord
    firing.value = true
    pendingReveal.value.add(coord)

    try {
        pendingFireResponses.set(coord, await props.onFire(coord))
    } catch (err) {
        firing.value = false
        pendingReveal.value.delete(coord)
        emit('fire-error', err)
        return
    }

    // Hold the modal open with the button spinning for the warning window, so
    // the firer sees the same countdown everyone else is getting.
    fireTimer = setTimeout(() => {
        firing.value = false
        selectedCoord.value = null
    }, ATTACK_WARNING_MS)
}

function onShotBurst(coord: string) {
    pendingReveal.value.delete(coord)
    const shot = activeShots.value.find((s) => s.coord === coord)
    if (shot?.fireResponse) emit('fire-result', shot.fireResponse)
}

// Fires once the warning window has closed (see useGameData.announceAttack), so
// every client viewing this team's board animates the shot at the same moment.
watch(
    () => props.lastShotFired,
    (evt) => {
        if (!evt || props.teamId === null || evt.attackerTeamId !== props.teamId) return
        const key = `${evt.attackerTeamId}:${evt.coord}`
        if (seenShots.has(key)) return
        seenShots.add(key)
        const attackType = props.forceAttackType ?? attackTypeForSeed(evt.animationSeed)
        const response = pendingFireResponses.get(evt.coord) ?? null
        pendingFireResponses.delete(evt.coord)
        if (!spawnShot(evt.coord, evt.attackerTeamId, evt.result, attackType, response)) {
            // No tile to aim at — surface the outcome rather than swallowing it.
            pendingReveal.value.delete(evt.coord)
            if (response) emit('fire-result', response)
        }
    },
)

onUnmounted(() => clearTimeout(fireTimer))

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
