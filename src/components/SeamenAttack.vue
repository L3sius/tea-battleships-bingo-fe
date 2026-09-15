<template>
    <svg v-if="swimmers.length" class="seamen-attack" :class="{ leaving }" :width="vw" :height="vh"
        :viewBox="`0 0 ${vw} ${vh}`" aria-hidden="true">
        <g v-for="s in swimmers" :key="s.id">
            <path class="seamen-attack-tail" :d="s.d" />
            <g :transform="s.headTransform">
                <circle class="seamen-attack-ring" :r="s.size / 2 + 2" />
                <image :href="s.face" :x="-s.size / 2" :y="-s.size / 2" :width="s.size" :height="s.size" />
            </g>
        </g>
    </svg>

    <AttackImpact v-if="burst && targetPos" :x="targetPos.x" :y="targetPos.y" :result="burst"
        :attacker-color="attackerColor" :defender-name="defenderName" @done="onImpactDone" />
</template>

<script setup lang="ts">
import '@/assets/seamenAttack.css'
import { onMounted, onUnmounted, ref, watch } from 'vue'
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

// A swarm of sperm-like swimmers races in from every side: plain white whipping
// tails, Harry's face as the head. Built like SnakeAttack (a ribbon rebuilt every
// frame), but the wave grows towards the tail tip, so heads swim dead straight
// while tails thrash. They stop in a ring around the tile rather than piling
// onto one point, so every face stays visible, then keep butting at it.

// Web-sized copies of public/images/harry-*.png.
const FACES = ['/images/seamen/harry-1.png', '/images/seamen/harry-2.png', '/images/seamen/harry-3.png']

const PREFERS_REDUCED_MOTION =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768

const COUNT = IS_MOBILE ? 7 : 12
// Timed to public/sounds/seamen.m4a: 2.27s of swimming, then the hit until 6.03s.
// Every head reaches the tile as the hit starts and keeps butting at it until
// the hit ends.
/** Spawn → every head at the tile at once. */
const TRAVEL_MS = 2270
/** Butting stops and the swarm fades out. */
const HIT_END_MS = 6030
const BUTT_HZ = 4
/** How far a head pushes in towards the tile's centre on each butt. */
const BUTT_DEPTH = IS_MOBILE ? 8 : 12
/** Must match the opacity transition on .seamen-attack.leaving. */
const LEAVE_MS = 450
const TAIL_SAMPLES = 32
const WHIP_HZ = 4.5

interface SwimmerView {
    id: number
    face: string
    size: number
    d: string
    headTransform: string
}

interface SwimRun {
    sx: number
    sy: number
    /** unit vector from spawn towards the tile */
    dx: number
    dy: number
    /** spawn → resting spot at the tile's edge */
    dist: number
    size: number
    length: number
    baseWidth: number
    amp: number
    wavelength: number
    phase: number
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

const vw = ref(0)
const vh = ref(0)
const swimmers = ref<SwimmerView[]>([])
const leaving = ref(false)
const targetPos = ref<{ x: number; y: number } | null>(null)
const burst = ref<ShotResult | null>(null)
let runs: SwimRun[] = []
let arrived = false
let impactDone = false
let swarmGone = false
let frame = 0
let startedAt = 0
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
    const faceStart = Math.floor(Math.random() * FACES.length)
    runs = []
    const views: SwimmerView[] = []
    for (let i = 0; i < COUNT; i++) {
        // Evenly around the tile (jittered), so they arrive from every side.
        const angle = offset + i * slice + rand(-0.3, 0.3) * slice
        const ux = Math.cos(angle)
        const uy = Math.sin(angle)
        const size = IS_MOBILE ? rand(30, 38) : rand(44, 56)
        const length = size * rand(3.8, 5)
        // Rest with the face just overlapping the tile's edge.
        const rest = tileSize / 2 + size * 0.2
        const spawnDist = exitDistance(tx, ty, ux, uy, size + length)
        runs.push({
            sx: tx + ux * spawnDist,
            sy: ty + uy * spawnDist,
            dx: -ux,
            dy: -uy,
            dist: spawnDist - rest,
            size,
            length,
            baseWidth: size * 0.42,
            amp: rand(12, 18) * (IS_MOBILE ? 0.7 : 1),
            wavelength: rand(70, 100),
            phase: rand(0, Math.PI * 2),
        })
        views.push({ id: i, face: FACES[(faceStart + i) % FACES.length]!, size, d: '', headTransform: '' })
    }
    swimmers.value = views
}

/** A touch of acceleration into the hit. */
const approach = (u: number) => 0.7 * u + 0.3 * u * u

function drawFrame(now: number) {
    const t = now - startedAt
    const u = Math.min(1, t / TRAVEL_MS)
    const wave = (2 * Math.PI * WHIP_HZ * t) / 1000

    runs.forEach((r, i) => {
        const view = swimmers.value[i]
        if (!view) return
        // After arriving, each head butts at the tile on its own beat (eased in
        // over 150ms so none of them lurch at the moment of the hit).
        const sinceHit = t - TRAVEL_MS
        const butt =
            sinceHit > 0
                ? BUTT_DEPTH *
                  Math.min(1, sinceHit / 150) *
                  Math.abs(Math.sin((Math.PI * BUTT_HZ * sinceHit) / 1000 + r.phase))
                : 0
        const head = r.dist * approach(u) + butt
        const nx = -r.dy
        const ny = r.dx

        // Tail centre line from the head (k = 0) back to the tip. The whip is
        // zero at the head and grows towards the tip.
        const pts: { x: number; y: number }[] = []
        for (let k = 0; k <= TAIL_SAMPLES; k++) {
            const f = k / TAIL_SAMPLES
            const s = head - r.length * f
            const off = r.amp * Math.pow(f, 1.2) * Math.sin((2 * Math.PI * s) / r.wavelength + r.phase - wave)
            pts.push({ x: r.sx + r.dx * s + nx * off, y: r.sy + r.dy * s + ny * off })
        }

        // Tapered ribbon: thick where it meets the head, a hair at the tip.
        const left: string[] = []
        const right: string[] = []
        for (let k = 0; k <= TAIL_SAMPLES; k++) {
            const a = pts[Math.max(0, k - 1)]!
            const b = pts[Math.min(TAIL_SAMPLES, k + 1)]!
            const tx = a.x - b.x
            const ty = a.y - b.y
            const len = Math.hypot(tx, ty) || 1
            const half = (1.2 + (r.baseWidth - 1.2) * Math.pow(1 - k / TAIL_SAMPLES, 1.6)) / 2
            const p = pts[k]!
            left.push(`${(p.x - (ty / len) * half).toFixed(1)} ${(p.y + (tx / len) * half).toFixed(1)}`)
            right.push(`${(p.x + (ty / len) * half).toFixed(1)} ${(p.y - (tx / len) * half).toFixed(1)}`)
        }
        const tip = pts[TAIL_SAMPLES]!
        view.d = `M ${left.join(' L ')} Q ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} ${right.reverse().join(' L ')} Z`

        // Faces stay upright with a little wobble.
        const lead = pts[0]!
        const tilt = 10 * Math.sin(wave * 0.5 + r.phase)
        view.headTransform = `translate(${lead.x.toFixed(1)} ${lead.y.toFixed(1)}) rotate(${tilt.toFixed(1)})`
    })

    if (u >= 1 && !arrived) {
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
    playSound('/sounds/seamen.m4a')
    vw.value = window.innerWidth
    vh.value = window.innerHeight
    spawn(tx, ty, Math.min(rect.width, rect.height))
    startedAt = performance.now()
    frame = requestAnimationFrame(drawFrame)
})

// Reveal once every head has arrived AND the real result is known — whichever
// is later. AttackImpact then owns the hit/miss/sunk reveal; the swarm keeps
// butting underneath it until the hit sound ends, then fades away.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    const elapsed = performance.now() - startedAt
    leaveTimer = setTimeout(() => {
        leaving.value = true
        leaveTimer = setTimeout(() => {
            cancelAnimationFrame(frame)
            swimmers.value = []
            swarmGone = true
            maybeDone()
        }, LEAVE_MS)
    }, Math.max(0, HIT_END_MS - elapsed))
}

function onImpactDone() {
    impactDone = true
    maybeDone()
}

// A plain hit's reveal finishes before the butting does, so wait for both.
function maybeDone() {
    if (impactDone && swarmGone) emit('done')
}

onUnmounted(() => {
    cancelAnimationFrame(frame)
    clearTimeout(leaveTimer)
})
</script>
