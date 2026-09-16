<template>
    <svg v-if="active" class="molanisk-attack" :class="{ leaving }" :width="vw" :height="vh"
        :viewBox="`0 0 ${vw} ${vh}`" aria-hidden="true">
        <!-- Ringing arcs spreading from the bell. -->
        <circle v-for="r in rings" :key="r.id" class="molanisk-ring" :cx="bell.x" :cy="bell.y" :r="r.radius"
            :opacity="r.opacity" />

        <g v-if="bell.opacity > 0" :opacity="bell.opacity" :transform="bell.transform">
            <!-- Hand bell: handle, flared body, rim and clapper, hanging from the pivot at 0,0. -->
            <path class="molanisk-bell-handle" :d="bellHandle" />
            <path class="molanisk-bell-body" :d="bellBody" />
            <ellipse class="molanisk-bell-rim" :cx="0" :cy="bellRimY" :rx="bellW / 2" :ry="bellW * 0.12" />
            <path class="molanisk-bell-shine" :d="bellShine" />
            <circle class="molanisk-bell-clapper" :cx="bellClapperX" :cy="bellRimY + bellW * 0.16"
                :r="bellW * 0.11" />
        </g>

        <image v-for="m in molanisks" :key="m.id" class="molanisk-attack-bug" :href="SPRITE" :x="-m.w / 2"
            :y="-m.h / 2" :width="m.w" :height="m.h" :transform="m.transform" />
    </svg>

    <AttackImpact v-if="burst && targetPos" :x="targetPos.x" :y="targetPos.y" :result="burst"
        :attacker-color="attackerColor" :defender-name="defenderName" @done="onImpactDone" />
</template>

<script setup lang="ts">
import '@/assets/molaniskAttack.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ShotResult } from '@/api/types'
import { playSound } from '@/utils/sound'
import AttackImpact from './AttackImpact.vue'

const props = defineProps<{
    targetEl: HTMLElement
    /** null while the real shot is still in flight over the network */
    result: ShotResult | null
    attackerColor: string
    /** Only known once the fire response has come back; null until then. */
    defenderName: string | null
}>()

const emit = defineEmits<{ done: []; burst: [] }>()

// A slayer bell is rung over the tile, and what answers it is a swarm. The bell
// swings and throws off rings; then molanisks scuttle in from every edge and
// mob the tile; then they set about it while the poor sod dies.

const SPRITE = '/images/molanisk/molanisk.png'
const SPRITE_ASPECT = 109 / 140

const PREFERS_REDUCED_MOTION =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768

// Timed to public/sounds/molanisk.m4a: the bell rings for 3.86s, molanisks
// swarm in from 3.86s to 6.86s, then the death noises run to 9.24s while they
// set about the tile.
const BELL_MS = 3860
/** Every molanisk is on the tile — and the kill lands — at this mark. */
const SWARM_ARRIVE_MS = 6860
/** The swarm scatters and fades from here. */
const DEATH_END_MS = 9240
/** Must match the opacity transition on .molanisk-attack.leaving. */
const LEAVE_MS = 450

const COUNT = IS_MOBILE ? 14 : 26
const RING_EVERY_MS = 620
const SWING_HZ = 2.1
const SCUTTLE_HZ = 6

interface BugView {
    id: number
    w: number
    h: number
    transform: string
}

interface BugRun {
    sx: number
    sy: number
    /** unit vector from spawn towards the tile */
    dx: number
    dy: number
    /** spawn → resting spot around the tile */
    dist: number
    w: number
    h: number
    /** sideways weave while crawling */
    weave: number
    wavelength: number
    phase: number
    /** how far it lunges at the tile once the mobbing starts */
    lunge: number
    hop: number
    /** which way the sprite faces */
    flip: number
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

const vw = ref(0)
const vh = ref(0)
const molanisks = ref<BugView[]>([])
const rings = ref<{ id: number; radius: number; opacity: number }[]>([])
const bell = ref({ x: 0, y: 0, transform: '', opacity: 0 })
const leaving = ref(false)
const targetPos = ref<{ x: number; y: number } | null>(null)
const burst = ref<ShotResult | null>(null)
const active = computed(() => molanisks.value.length > 0 || bell.value.opacity > 0 || rings.value.length > 0)

// Bell geometry, hanging from a pivot at 0,0.
const bellW = IS_MOBILE ? 64 : 92
const bellTop = bellW * 0.3
const bellRimY = computed(() => bellTop + bellW * 0.78)
const bellHandle = computed(() => {
    const w = bellW * 0.16
    return `M ${-w} ${bellTop} C ${-w} ${bellTop - w * 2.6} ${w} ${bellTop - w * 2.6} ${w} ${bellTop} Z`
})
const bellBody = computed(() => {
    const half = bellW / 2
    const top = bellTop
    const rim = bellRimY.value
    // Narrow shoulders flaring out to the rim.
    return `M ${-bellW * 0.17} ${top} C ${-bellW * 0.3} ${top + bellW * 0.3} ${-half} ${rim - bellW * 0.3} ${-half} ${rim} L ${half} ${rim} C ${half} ${rim - bellW * 0.3} ${bellW * 0.3} ${top + bellW * 0.3} ${bellW * 0.17} ${top} Z`
})
const bellShine = computed(() => {
    const rim = bellRimY.value
    const x = -bellW * 0.22
    return `M ${x} ${bellTop + bellW * 0.12} C ${x - bellW * 0.12} ${bellTop + bellW * 0.4} ${x - bellW * 0.2} ${rim - bellW * 0.22} ${x - bellW * 0.16} ${rim - bellW * 0.06}`
})
const bellClapperX = ref(0)

let runs: BugRun[] = []
let arrived = false
let impactDone = false
let swarmGone = false
let frame = 0
let startedAt = 0
let nextRingAt = 0
let ringId = 0
let leaveTimer: ReturnType<typeof setTimeout> | undefined

/** Distance along a ray from (x, y) until it's `margin` px outside the viewport. */
function exitDistance(x: number, y: number, ux: number, uy: number, margin: number) {
    const hits: number[] = []
    if (ux > 0) hits.push((vw.value + margin - x) / ux)
    if (ux < 0) hits.push((-margin - x) / ux)
    if (uy > 0) hits.push((vh.value + margin - y) / uy)
    if (uy < 0) hits.push((-margin - y) / uy)
    return Math.min(...hits.filter((t) => t > 0))
}

function spawn(tx: number, ty: number, tileSize: number) {
    const offset = Math.random() * Math.PI * 2
    const slice = (Math.PI * 2) / COUNT
    runs = []
    const views: BugView[] = []
    for (let i = 0; i < COUNT; i++) {
        // Evenly around the tile (jittered), so they come from every side.
        const angle = offset + i * slice + rand(-0.45, 0.45) * slice
        const ux = Math.cos(angle)
        const uy = Math.sin(angle)
        // A wide spread of sizes so the swarm looks like a rabble of big and
        // small ones rather than a row of clones.
        const w = IS_MOBILE ? rand(18, 42) : rand(24, 66)
        const h = w * SPRITE_ASPECT
        // Mob the tile in a loose ring rather than stacking into one dark mound,
        // so you can still pick out individual molanisks going at it.
        const rest = rand(tileSize * 0.42, tileSize * 1.15) + w * 0.1
        const spawnDist = exitDistance(tx, ty, ux, uy, w + h)
        runs.push({
            sx: tx + ux * spawnDist,
            sy: ty + uy * spawnDist,
            dx: -ux,
            dy: -uy,
            dist: spawnDist - rest,
            w,
            h,
            weave: rand(8, 20),
            wavelength: rand(90, 150),
            phase: rand(0, Math.PI * 2),
            lunge: rand(9, 18),
            hop: rand(7, 16),
            flip: ux > 0 ? 1 : -1,
        })
        views.push({ id: i, w, h, transform: '' })
    }
    molanisks.value = views
}

/** Scuttling: a shade of acceleration into the tile. */
const approach = (u: number) => 0.65 * u + 0.35 * u * u

function drawFrame(now: number) {
    const t = now - startedAt

    // ── The bell ──
    if (t < BELL_MS) {
        const swing = 24 * Math.sin((2 * Math.PI * SWING_HZ * t) / 1000)
        // Rings out on every swing, and the whole thing fades as the swarm answers.
        const fade = t > BELL_MS - 400 ? Math.max(0, (BELL_MS - t) / 400) : Math.min(1, t / 200)
        bell.value = {
            ...bell.value,
            transform: `translate(${bell.value.x.toFixed(1)} ${bell.value.y.toFixed(1)}) rotate(${swing.toFixed(1)})`,
            opacity: fade,
        }
        bellClapperX.value = bellW * 0.26 * -Math.sin((2 * Math.PI * SWING_HZ * t) / 1000 + 0.6)
        if (t >= nextRingAt) {
            nextRingAt = t + RING_EVERY_MS
            rings.value.push({ id: ++ringId, radius: bellW * 0.5, opacity: 0.45 })
        }
    } else if (bell.value.opacity !== 0) {
        bell.value = { ...bell.value, opacity: 0 }
    }

    for (const r of rings.value) {
        r.radius += 1.9
        r.opacity -= 0.006
    }
    rings.value = rings.value.filter((r) => r.opacity > 0)

    // ── The swarm ──
    const u = Math.min(1, Math.max(0, (t - BELL_MS) / (SWARM_ARRIVE_MS - BELL_MS)))
    const scuttle = (2 * Math.PI * SCUTTLE_HZ * t) / 1000

    runs.forEach((r, i) => {
        const view = molanisks.value[i]
        if (!view) return
        // Once they're on it, they lunge at the tile and jump about.
        const sinceKill = t - SWARM_ARRIVE_MS
        const ease = sinceKill > 0 ? Math.min(1, sinceKill / 200) : 0
        const beat = (2 * Math.PI * 3.4 * Math.max(0, sinceKill)) / 1000 + r.phase
        const lunge = r.lunge * ease * Math.abs(Math.sin(beat))
        const hop = r.hop * ease * Math.abs(Math.sin(beat * 1.3 + 0.7))

        const along = r.dist * approach(u) + lunge
        const nx = -r.dy
        const ny = r.dx
        // Weaving while crawling, dying out as they reach the tile.
        const weave = r.weave * (1 - u) * Math.sin((2 * Math.PI * along) / r.wavelength + r.phase)
        const x = r.sx + r.dx * along + nx * weave
        const y = r.sy + r.dy * along + ny * weave - hop
        // A scuttling bob, and a shudder while they're tearing at the tile.
        const bob = 1 + 0.06 * Math.sin(scuttle + r.phase)
        const tilt = 5 * Math.sin(scuttle * 0.5 + r.phase) + (ease ? 8 * Math.sin(beat * 2) : 0)
        view.transform = `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(${(r.flip * bob).toFixed(3)} ${bob.toFixed(3)})`
    })

    if (t >= SWARM_ARRIVE_MS && !arrived) {
        arrived = true
        maybeShowBurst()
    }
    frame = requestAnimationFrame(drawFrame)
}

onMounted(() => {
    const rect = props.targetEl.getBoundingClientRect()
    const tx = rect.left + rect.width / 2
    const ty = rect.top + rect.height / 2
    targetPos.value = { x: tx, y: ty }

    if (PREFERS_REDUCED_MOTION) {
        arrived = true
        swarmGone = true
        maybeShowBurst()
        return
    }
    playSound('/sounds/molanisk.m4a')
    vw.value = window.innerWidth
    vh.value = window.innerHeight
    // The bell hangs just above the tile it's calling them to.
    bell.value = { x: tx, y: ty - bellW * 0.95, transform: '', opacity: 0 }
    spawn(tx, ty, Math.min(rect.width, rect.height))
    startedAt = performance.now()
    frame = requestAnimationFrame(drawFrame)
})

// Reveal once the swarm is on the tile AND the real result is known — whichever
// is later. AttackImpact owns the hit/miss/sunk reveal; the molanisks keep at it
// underneath until the death noises end, then scatter.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    const elapsed = performance.now() - startedAt
    leaveTimer = setTimeout(
        () => {
            leaving.value = true
            leaveTimer = setTimeout(() => {
                cancelAnimationFrame(frame)
                molanisks.value = []
                rings.value = []
                swarmGone = true
                maybeDone()
            }, LEAVE_MS)
        },
        Math.max(0, DEATH_END_MS - elapsed),
    )
}

function onImpactDone() {
    impactDone = true
    maybeDone()
}

// The reveal finishes long before the death noises do, so wait for both.
function maybeDone() {
    if (impactDone && swarmGone) emit('done')
}

onUnmounted(() => {
    cancelAnimationFrame(frame)
    clearTimeout(leaveTimer)
})
</script>
