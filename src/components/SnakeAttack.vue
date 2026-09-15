<template>
    <svg v-if="snakes.length" class="snake-attack" :class="{ leaving }" :width="vw" :height="vh"
        :viewBox="`0 0 ${vw} ${vh}`" aria-hidden="true">
        <defs>
            <pattern v-for="s in snakes" :id="s.patternId" :key="s.patternId" patternUnits="userSpaceOnUse"
                :width="s.tile" :height="s.tile" :patternTransform="s.patternTransform">
                <image :href="s.variant.pattern" x="0" y="0" :width="s.tile" :height="s.tile" />
            </pattern>
        </defs>
        <g v-for="s in snakes" :key="s.id">
            <path class="snake-attack-body" :d="s.d" :fill="`url(#${s.patternId})`" :stroke="s.variant.edge" />
            <image :href="s.variant.head" :width="s.headW" :height="s.headH" :transform="s.headTransform" />
        </g>
    </svg>

    <AttackImpact v-if="burst && targetPos" :x="targetPos.x" :y="targetPos.y" :result="burst"
        :attacker-color="attackerColor" :defender-name="defenderName" @done="onImpactDone" />
</template>

<script setup lang="ts">
import '@/assets/snakeAttack.css'
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

// Snakes pour in from every side of the screen and all strike the tile at the
// same instant. Bodies are the snakes-and-ladders ribbon — a tapered outline
// filled with the scale texture, heads leading — but rebuilt every frame so a
// travelling side-to-side wave makes them slither. The wave dies out near the
// tile, so every head lands dead-centre.

// Art and edge colours from the snakes-and-ladders repo (src/utils/snakeColors.ts);
// the images here are web-sized copies of public/images/snake_*.png.
const VARIANTS = [
    { head: '/images/snakes/head_green.png', pattern: '/images/snakes/pattern_green.png', edge: '#0b3d1f' },
    { head: '/images/snakes/head_pink.png', pattern: '/images/snakes/pattern_pink.png', edge: '#4a0e42' },
    { head: '/images/snakes/head_blue.png', pattern: '/images/snakes/pattern_blue.png', edge: '#0b2b4a' },
]
const HEAD_ASPECT = 1298 / 1254

const PREFERS_REDUCED_MOTION =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768

const COUNT = IS_MOBILE ? 6 : 10
// Timed to public/sounds/snake.m4a: 4.67s of slithering while the snakes close
// in, then the damage part until 7.44s. Every head strikes as the damage
// starts, and they keep biting at the tile until it ends.
/** Spawn → every head on the tile at once. */
const APPROACH_MS = 4670
/** Biting stops and the snakes fade out. */
const BITE_END_MS = 7440
const BITE_HZ = 3
/** How far a head pulls back between bites. */
const BITE_DEPTH = IS_MOBILE ? 12 : 18
/** Must match the opacity transition on .snake-attack.leaving. */
const LEAVE_MS = 450
const BODY_SAMPLES = 36
const SLITHER_HZ = 2.2
/** How far from the tile the wave starts fading, so heads converge exactly. */
const SETTLE_DIST = 140

interface Variant {
    head: string
    pattern: string
    edge: string
}

interface SnakeView {
    id: number
    patternId: string
    variant: Variant
    tile: number
    headW: number
    headH: number
    d: string
    patternTransform: string
    headTransform: string
}

interface SnakeRun {
    sx: number
    sy: number
    /** unit vector from spawn towards the tile */
    dx: number
    dy: number
    /** spawn → tile distance */
    dist: number
    length: number
    headW: number
    headH: number
    widthHead: number
    amp: number
    wavelength: number
    phase: number
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

const vw = ref(0)
const vh = ref(0)
const snakes = ref<SnakeView[]>([])
const leaving = ref(false)
const targetPos = ref<{ x: number; y: number } | null>(null)
const burst = ref<ShotResult | null>(null)
let runs: SnakeRun[] = []
let arrived = false
let impactDone = false
let snakesGone = false
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

function spawn(tx: number, ty: number) {
    const uid = Math.random().toString(36).slice(2, 8)
    const offset = Math.random() * Math.PI * 2
    const slice = (Math.PI * 2) / COUNT
    const colourStart = Math.floor(Math.random() * VARIANTS.length)
    runs = []
    const views: SnakeView[] = []
    for (let i = 0; i < COUNT; i++) {
        // Evenly around the tile (jittered), so they arrive from every side.
        const angle = offset + i * slice + rand(-0.35, 0.35) * slice
        const ux = Math.cos(angle)
        const uy = Math.sin(angle)
        const headW = IS_MOBILE ? rand(38, 48) : rand(52, 70)
        const length = IS_MOBILE ? rand(120, 170) : rand(170, 260)
        // Start fully off-screen: head plus the whole body beyond the edge.
        const dist = exitDistance(tx, ty, ux, uy, headW + length)
        const run: SnakeRun = {
            sx: tx + ux * dist,
            sy: ty + uy * dist,
            dx: -ux,
            dy: -uy,
            dist,
            length,
            headW,
            headH: headW * HEAD_ASPECT,
            widthHead: headW * 0.55,
            amp: rand(14, 22) * (IS_MOBILE ? 0.7 : 1),
            wavelength: rand(110, 160),
            phase: rand(0, Math.PI * 2),
        }
        runs.push(run)
        const variant = VARIANTS[(colourStart + i) % VARIANTS.length]!
        views.push({
            id: i,
            patternId: `snake-scales-${uid}-${i}`,
            variant,
            tile: run.widthHead * 1.15,
            headW: run.headW,
            headH: run.headH,
            d: '',
            patternTransform: '',
            headTransform: '',
        })
    }
    snakes.value = views
}

/** Accelerates into the strike rather than easing out of it. */
const approach = (u: number) => 0.6 * u + 0.4 * u * u

function drawFrame(now: number) {
    const t = now - startedAt
    const u = Math.min(1, t / APPROACH_MS)
    const wave = (2 * Math.PI * SLITHER_HZ * t) / 1000

    runs.forEach((r, i) => {
        const view = snakes.value[i]
        if (!view) return
        // After the strike, each head jabs in and out at the tile on its own beat
        // (eased in over 150ms so none of them jump back at the moment of impact).
        const sinceStrike = t - APPROACH_MS
        const bite =
            sinceStrike > 0
                ? BITE_DEPTH *
                  Math.min(1, sinceStrike / 150) *
                  Math.abs(Math.sin((Math.PI * BITE_HZ * sinceStrike) / 1000 + r.phase))
                : 0
        const head = r.dist * approach(u) - bite
        const nx = -r.dy
        const ny = r.dx

        // Centre line from head (k = 0) back to tail, riding a travelling wave.
        const pts: { x: number; y: number }[] = []
        for (let k = 0; k <= BODY_SAMPLES; k++) {
            const s = head - (r.length * k) / BODY_SAMPLES
            const settle = Math.max(0, Math.min(1, (r.dist - s) / SETTLE_DIST))
            const off = r.amp * settle * Math.sin((2 * Math.PI * s) / r.wavelength + r.phase - wave)
            pts.push({ x: r.sx + r.dx * s + nx * off, y: r.sy + r.dy * s + ny * off })
        }

        // Tapered ribbon around it (thick behind the head, thin at the tail).
        const left: string[] = []
        const right: string[] = []
        for (let k = 0; k <= BODY_SAMPLES; k++) {
            const a = pts[Math.max(0, k - 1)]!
            const b = pts[Math.min(BODY_SAMPLES, k + 1)]!
            const tx = a.x - b.x
            const ty = a.y - b.y
            const len = Math.hypot(tx, ty) || 1
            const half = (3 + (r.widthHead - 3) * Math.pow(1 - k / BODY_SAMPLES, 1.4)) / 2
            const p = pts[k]!
            left.push(`${(p.x - (ty / len) * half).toFixed(1)} ${(p.y + (tx / len) * half).toFixed(1)}`)
            right.push(`${(p.x + (ty / len) * half).toFixed(1)} ${(p.y - (tx / len) * half).toFixed(1)}`)
        }
        const tail = pts[BODY_SAMPLES]!
        view.d = `M ${left.join(' L ')} Q ${tail.x.toFixed(1)} ${tail.y.toFixed(1)} ${right.reverse().join(' L ')} Z`

        // Scales ride along with the body instead of sliding underneath it.
        const angleDeg = (Math.atan2(r.dy, r.dx) * 180) / Math.PI
        view.patternTransform = `translate(${r.sx.toFixed(1)} ${r.sy.toFixed(1)}) rotate(${angleDeg.toFixed(1)}) translate(${head.toFixed(1)} 0)`

        // Faces stay upright (they're faces) with a lean into the travel direction and a wobble.
        const lead = pts[0]!
        const cx = lead.x + r.dx * r.headW * 0.15
        const cy = lead.y + r.dy * r.headW * 0.15
        const tilt = r.dx * 12 + 8 * Math.sin(wave * 0.75 + r.phase)
        view.headTransform = `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${tilt.toFixed(1)}) translate(${(-r.headW / 2).toFixed(1)} ${(-r.headH / 2).toFixed(1)})`
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
        snakesGone = true
        maybeShowBurst()
        return
    }
    playSound('/sounds/snake.m4a')
    vw.value = window.innerWidth
    vh.value = window.innerHeight
    spawn(tx, ty)
    startedAt = performance.now()
    frame = requestAnimationFrame(drawFrame)
})

// Reveal once every head has struck AND the real result is known — whichever
// is later. AttackImpact then owns the hit/miss/sunk reveal; the snakes keep
// biting underneath it until the damage sound ends, then fade away.
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
            snakes.value = []
            snakesGone = true
            maybeDone()
        }, LEAVE_MS)
    }, Math.max(0, BITE_END_MS - elapsed))
}

function onImpactDone() {
    impactDone = true
    maybeDone()
}

// A plain hit's reveal finishes before the biting does, so wait for both.
function maybeDone() {
    if (impactDone && snakesGone) emit('done')
}

onUnmounted(() => {
    cancelAnimationFrame(frame)
    clearTimeout(leaveTimer)
})
</script>
