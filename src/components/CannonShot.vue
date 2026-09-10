<template>
    <div class="cannon-dim" :style="{ opacity: overlayOpacity }" role="dialog" aria-modal="true"
        :aria-label="`Cannon attack on ${coord}`"></div>

    <div v-if="showTarget" class="cannon-target-label">
        TARGET:&nbsp;<span class="cannon-target-coord">{{ coord }}</span>
    </div>

    <div v-if="showTarget && layout" class="cannon-reticle" :style="{ left: layout.tx + 'px', top: layout.ty + 'px' }">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <polyline points="4,16 4,4 16,4" stroke="#ff5533" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <polyline points="48,4 60,4 60,16" stroke="#ff5533" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <polyline points="60,48 60,60 48,60" stroke="#ff5533" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <polyline points="16,60 4,60 4,48" stroke="#ff5533" stroke-width="3.5" fill="none" stroke-linecap="round" />
            <line x1="32" y1="22" x2="32" y2="42" stroke="#ff5533" stroke-width="1.5" opacity="0.65" />
            <line x1="22" y1="32" x2="42" y2="32" stroke="#ff5533" stroke-width="1.5" opacity="0.65" />
            <circle cx="32" cy="32" r="4.5" fill="#ff5533" opacity="0.88" />
        </svg>
    </div>

    <div v-if="showCannon" class="cannon-rig-fixed" :style="cannonRigStyle">
        <svg :width="cannonW" :height="cannonH" viewBox="0 0 130 195" aria-hidden="true">
            <ellipse cx="65" cy="191" rx="50" ry="7" fill="rgba(0,0,0,0.42)" />

            <g class="cannon-barrel-group" :style="barrelStyle">
                <rect x="46" y="1" width="38" height="114" rx="17" fill="#181818" />
                <rect x="48" y="3" width="10" height="108" rx="8" fill="#262626" />
                <rect x="73" y="3" width="7" height="108" rx="5" fill="#0c0c0c" />

                <ellipse cx="65" cy="5" rx="21" ry="11" fill="#111111" />
                <ellipse cx="65" cy="5" rx="14" ry="7.5" fill="#090909" />
                <ellipse cx="65" cy="5" rx="7" ry="3.8" fill="#050505" />
                <ellipse cx="65" cy="5" rx="22" ry="12" fill="none" stroke="#242424" stroke-width="1.5" />

                <rect x="43" y="18" width="44" height="13" rx="5.5" fill="#161616" />
                <rect x="45" y="19" width="40" height="6" rx="3" fill="#202020" />

                <rect x="41" y="34" width="48" height="13" rx="5.5" fill="#8a5e0e" />
                <rect x="42" y="35" width="46" height="6" rx="3.5" fill="#c9972a" />
                <rect x="42" y="40" width="46" height="2.5" fill="#d9aa3a" opacity="0.55" />

                <rect x="51" y="55" width="28" height="3" rx="1.5" fill="#131313" />
                <rect x="51" y="62" width="28" height="2" rx="1" fill="#151515" />

                <rect x="42" y="70" width="46" height="12" rx="4.5" fill="#8a5e0e" />
                <rect x="43" y="71" width="44" height="5.5" rx="3" fill="#c9972a" />
                <rect x="43" y="75" width="44" height="2.5" fill="#d9aa3a" opacity="0.5" />

                <rect x="51" y="88" width="28" height="2" rx="1" fill="#131313" />

                <rect x="42" y="100" width="46" height="11" rx="4" fill="#8a5e0e" />
                <rect x="43" y="101" width="44" height="5" rx="3" fill="#c9972a" />

                <ellipse cx="65" cy="113" rx="27" ry="14" fill="#141414" />
                <ellipse cx="65" cy="113" rx="18" ry="9" fill="#0e0e0e" />
                <circle cx="65" cy="113" r="4.5" fill="#080808" />
                <circle cx="65" cy="113" r="2" fill="#040404" />
            </g>

            <ellipse cx="65" cy="122" rx="21" ry="10" fill="#1c1206" />
            <ellipse cx="65" cy="122" rx="13" ry="6.5" fill="#130d04" />

            <rect x="14" y="120" width="102" height="40" rx="7" fill="#5a3010" />
            <rect x="16" y="122" width="98" height="17" rx="5" fill="#6a3c14" />
            <line x1="16" y1="128" x2="114" y2="128" stroke="#4a2808" stroke-width="0.8" opacity="0.5" />
            <line x1="16" y1="133" x2="114" y2="133" stroke="#4a2808" stroke-width="0.8" opacity="0.44" />
            <line x1="16" y1="138" x2="114" y2="138" stroke="#4a2808" stroke-width="0.8" opacity="0.35" />

            <rect x="34" y="120" width="7" height="40" rx="2.5" fill="#1c1106" />
            <rect x="89" y="120" width="7" height="40" rx="2.5" fill="#1c1106" />
            <circle cx="37.5" cy="124" r="2.5" fill="#0d0904" />
            <circle cx="37.5" cy="156" r="2.5" fill="#0d0904" />
            <circle cx="92.5" cy="124" r="2.5" fill="#0d0904" />
            <circle cx="92.5" cy="156" r="2.5" fill="#0d0904" />

            <ellipse cx="21" cy="136" rx="7.5" ry="5.5" fill="none" stroke="#8a6a30" stroke-width="2" />
            <ellipse cx="21" cy="136" rx="4" ry="3" fill="none" stroke="#7a5a24" stroke-width="1.5" />
            <line x1="21" y1="130" x2="21" y2="126" stroke="#7a5a24" stroke-width="1.5" />

            <circle cx="24" cy="170" r="27" fill="#261402" stroke="#130a01" stroke-width="2.5" />
            <circle cx="24" cy="170" r="25" fill="none" stroke="#321a04" stroke-width="1.2" />
            <line v-for="spoke in wheelSpokes" :key="'lw-' + spoke.a" :x1="24 + spoke.x1" :y1="170 + spoke.y1"
                :x2="24 + spoke.x2" :y2="170 + spoke.y2" stroke="#130a01" stroke-width="2.8" stroke-linecap="round" />
            <circle cx="24" cy="170" r="8" fill="#130a01" />
            <circle cx="24" cy="170" r="5" fill="#c9972a" />
            <circle cx="24" cy="170" r="2.2" fill="#7a5210" />

            <circle cx="106" cy="170" r="27" fill="#261402" stroke="#130a01" stroke-width="2.5" />
            <circle cx="106" cy="170" r="25" fill="none" stroke="#321a04" stroke-width="1.2" />
            <line v-for="spoke in wheelSpokes" :key="'rw-' + spoke.a" :x1="106 + spoke.x1" :y1="170 + spoke.y1"
                :x2="106 + spoke.x2" :y2="170 + spoke.y2" stroke="#130a01" stroke-width="2.8" stroke-linecap="round" />
            <circle cx="106" cy="170" r="8" fill="#130a01" />
            <circle cx="106" cy="170" r="5" fill="#c9972a" />
            <circle cx="106" cy="170" r="2.2" fill="#7a5210" />

            <line x1="99" y1="70" x2="99" y2="26" stroke="#3c1e04" stroke-width="3.5" stroke-linecap="round" />
            <polygon points="99,26 127,36 99,46" :fill="attackerColor" opacity="0.94" />
            <polygon points="99,28 121,36 99,43" :fill="attackerColor" opacity="0.38" />
        </svg>

        <div v-if="flashOn" class="cannon-muzzle-flash-burst">
            <svg width="90" height="90" viewBox="0 0 90 90" aria-hidden="true">
                <circle cx="45" cy="45" r="43" fill="#ff9820" opacity="0.14" />
                <polygon
                    points="45,3 49,32 70,14 52,36 82,33 56,45 76,61 48,50 54,80 45,56 36,80 42,50 14,61 34,45 8,33 38,36 20,14 41,32"
                    fill="#ffd040" />
                <circle cx="45" cy="45" r="18" fill="#ffffff" opacity="0.96" />
                <circle cx="45" cy="45" r="10" fill="#fff8d0" />
            </svg>
        </div>
    </div>

    <template v-if="smokeOn && layout">
        <div v-for="(p, i) in SMOKE_PUFFS" :key="'smoke-' + i" class="cannon-smoke-puff" :style="smokeStyle(p)"></div>
    </template>

    <div v-if="fuseOn && layout" class="cannon-fuse-glow" :style="{ left: layout.mx + 'px', top: layout.my + 'px' }">
    </div>

    <div v-for="(p, i) in trail" :key="'trail-' + i" class="cannon-fire-trail" :style="trailStyle(p, i)"></div>

    <div v-if="ball" class="cannon-ball" :style="{ left: ball.x + 'px', top: ball.y + 'px' }"></div>

    <AttackImpact v-if="phase === 'impact' && resolvedResult && layout" :x="layout.tx" :y="layout.ty"
        :result="resolvedResult" :attacker-color="attackerColor" :defender-name="defenderName" :speed="MOB"
        @done="emit('done')" />

    <button class="cannon-skip-btn" @click="skip">Skip →</button>
</template>

<script setup lang="ts">
import '@/assets/cannonShot.css'
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

type Phase = 'dim_in' | 'target_mark' | 'enter' | 'aim' | 'fuse' | 'fire' | 'travel' | 'impact'

interface Pos {
    x: number
    y: number
}

interface Layout {
    tx: number
    ty: number
    pivotX: number
    pivotY: number
    mx: number
    my: number
    angle: number
    ctrlX: number
    ctrlY: number
}

// Computed once at module load, same as the reference — this doesn't need to
// react to a mid-session resize or an OS setting flipped while an attack is
// mid-flight.
const PREFERS_REDUCED_MOTION =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768
const MOB = IS_MOBILE ? 0.6 : 1

const cannonW = IS_MOBILE ? 96 : 130
const cannonH = IS_MOBILE ? 144 : 195

// Timed to public/sounds/cannon.m4a: the muzzle boom is at 0:00 of the clip
// and the ball strikes the target ~3.7s in. The sound starts on the 'fire'
// phase (visual boom = audio boom); TRAVEL_MS stretches the ball's flight so
// impact lands on that 3.7s mark.
const TRAVEL_MS = IS_MOBILE ? 2600 : 3560

const wheelSpokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180
    return { a, x1: 6 * Math.cos(a), y1: 6 * Math.sin(a), x2: 22 * Math.cos(a), y2: 22 * Math.sin(a) }
})

// Fixed (non-random) muzzle smoke puffs — matches the reference exactly.
const SMOKE_PUFFS = [
    { dx: -32, delay: 0, sz: 30 },
    { dx: 26, delay: 55, sz: 26 },
    { dx: -16, delay: 105, sz: 34 },
    { dx: 38, delay: 165, sz: 24 },
    { dx: -6, delay: 215, sz: 28 },
    { dx: 20, delay: 275, sz: 22 },
]

const phase = ref<Phase>('dim_in')
const overlayOpacity = ref(0)
const cannonY = ref(220)
const cannonAngle = ref(0)
const recoil = ref(false)
const flashOn = ref(false)
const smokeOn = ref(false)
const fuseOn = ref(false)
const ball = ref<Pos | null>(null)
const trail = ref<Pos[]>([])
const layout = ref<Layout | null>(null)
// Snapshot of props.result at the moment we commit to revealing it — taken
// once (inside triggerImpact, which only ever runs after props.result is
// known) so AttackImpact always gets a definite ShotResult, never null.
const resolvedResult = ref<ShotResult | null>(null)

const coord = props.targetEl.dataset.coord ?? ''

const showTarget = computed(() => phase.value !== 'dim_in')
const showCannon = computed(() => phase.value !== 'dim_in')

const cannonTransition = computed(() => {
    if (phase.value === 'enter') return `transform ${(500 * MOB).toFixed(0)}ms cubic-bezier(0.22,1,0.36,1)`
    if (phase.value === 'aim') return `transform ${(440 * MOB).toFixed(0)}ms cubic-bezier(0.38,0,0.18,1)`
    return 'none'
})
const cannonRigStyle = computed(() => ({
    transform: `translateX(-50%) translateY(${cannonY.value}px) rotate(${cannonAngle.value}deg)`,
    transition: cannonTransition.value,
}))
const barrelStyle = computed(() => ({
    transform: recoil.value ? 'translateY(10px)' : 'translateY(0)',
    transition: recoil.value ? 'transform 0.07s ease-out' : 'transform 0.16s ease-in',
}))

function smokeStyle(p: { dx: number; delay: number; sz: number }) {
    if (!layout.value) return {}
    return {
        left: `${layout.value.mx - p.sz / 2}px`,
        top: `${layout.value.my - p.sz / 2}px`,
        width: `${p.sz}px`,
        height: `${p.sz}px`,
        animationDelay: `${p.delay}ms`,
        '--dx': `${p.dx}px`,
    }
}

function trailStyle(p: Pos, i: number) {
    const alpha = (i + 1) / trail.value.length
    const sz = 5 + alpha * 9
    return {
        left: `${p.x - sz / 2}px`,
        top: `${p.y - sz / 2}px`,
        width: `${sz}px`,
        height: `${sz}px`,
        background: `rgba(255,${Math.floor(80 + alpha * 90)},${Math.floor(alpha * 30)},${(alpha * 0.72).toFixed(2)})`,
        boxShadow: `0 0 ${Math.floor(sz * 1.8)}px rgba(255,110,20,${(alpha * 0.6).toFixed(2)})`,
    }
}

function qbez(t: number, p0: Pos, p1: Pos, p2: Pos): Pos {
    const m = 1 - t
    return {
        x: m * m * p0.x + 2 * m * t * p1.x + t * t * p2.x,
        y: m * m * p0.y + 2 * m * t * p1.y + t * t * p2.y,
    }
}

let raf = 0
function startTravel(L: Layout) {
    const travelMs = TRAVEL_MS
    const p0: Pos = { x: L.mx, y: L.my }
    const p2: Pos = { x: L.tx, y: L.ty }
    const p1: Pos = { x: L.ctrlX, y: L.ctrlY }
    const tStart = performance.now()

    const step = () => {
        const t = Math.min((performance.now() - tStart) / travelMs, 1)
        const pos = qbez(t, p0, p1, p2)
        ball.value = pos
        const next = [...trail.value, pos]
        trail.value = next.length > 9 ? next.slice(-9) : next
        if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
}

const timers: ReturnType<typeof setTimeout>[] = []
function T(fn: () => void, ms: number) {
    timers.push(setTimeout(fn, ms * MOB))
}

// The timeline below is fixed and cosmetic; the real network result can
// arrive before or after the cannonball would visually land. The ball just
// holds at the target until both are true, then impact/result/sunk play —
// same reveal-timing trick the other four attacks use, adapted for a
// multi-stage cinematic instead of a single travel animation.
let burstEmitted = false
function emitBurstOnce() {
    if (burstEmitted) return
    burstEmitted = true
    emit('burst')
}

let awaitingCallback: (() => void) | null = null
function awaitResultThen(cb: () => void) {
    if (props.result) {
        cb()
        return
    }
    awaitingCallback = cb
}
watch(
    () => props.result,
    (r) => {
        if (r && awaitingCallback) {
            const cb = awaitingCallback
            awaitingCallback = null
            cb()
        }
    },
)

// Hands off to AttackImpact for the actual hit/miss/sunk reveal — it owns
// the rest of the timeline (and its own 'done') from here.
function triggerImpact() {
    phase.value = 'impact'
    ball.value = null
    trail.value = []
    smokeOn.value = false
    resolvedResult.value = props.result
    emitBurstOnce()
}

onMounted(() => {
    const tRect = props.targetEl.getBoundingClientRect()
    const tx = tRect.left + tRect.width / 2
    const ty = tRect.top + tRect.height / 2

    const pivotX = window.innerWidth / 2
    const pivotY = window.innerHeight + 28

    const muzzleLen = IS_MOBILE ? 106 : 162
    const rawAngle = Math.atan2(tx - pivotX, pivotY - ty) * (180 / Math.PI)
    const angle = Math.max(-58, Math.min(58, rawAngle))
    const rad = (angle * Math.PI) / 180

    const mx = pivotX + muzzleLen * Math.sin(rad)
    const my = pivotY - muzzleLen * Math.cos(rad)

    // A tall lob — the ball is in the air for ~3.5s, so it needs a real arc.
    const arcH = Math.max(170, Math.hypot(tx - mx, ty - my) * 0.62)
    const ctrlX = (mx + tx) / 2
    const ctrlY = Math.min(my, ty) - arcH

    layout.value = { tx, ty, pivotX, pivotY, mx, my, angle, ctrlX, ctrlY }

    const D = {
        dimIn: 220,
        target: 400,
        enter: 500,
        aim: 440,
        aimHold: 160,
        fuse: 290,
        fire: 135,
        travel: TRAVEL_MS,
    }

    if (PREFERS_REDUCED_MOTION) {
        overlayOpacity.value = 1
        cannonAngle.value = angle
        cannonY.value = 0
        phase.value = 'aim'
        playSound('/sounds/cannon.m4a')
        awaitResultThen(triggerImpact)
        return
    }

    let t = 0
    requestAnimationFrame(() => {
        overlayOpacity.value = 1
    })

    t += D.dimIn
    T(() => {
        phase.value = 'target_mark'
    }, t)

    t += D.target
    T(() => {
        phase.value = 'enter'
        cannonAngle.value = 0
        requestAnimationFrame(() => {
            cannonY.value = 0
        })
    }, t)

    t += D.enter
    T(() => {
        phase.value = 'aim'
        cannonAngle.value = angle
    }, t)

    t += D.aim + D.aimHold
    T(() => {
        phase.value = 'fuse'
        fuseOn.value = true
    }, t)

    t += D.fuse
    T(() => {
        phase.value = 'fire'
        fuseOn.value = false
        recoil.value = true
        flashOn.value = true
        smokeOn.value = true
        playSound('/sounds/cannon.m4a')
        setTimeout(() => {
            recoil.value = false
        }, 82 * MOB)
        setTimeout(() => {
            flashOn.value = false
        }, 230 * MOB)
    }, t)

    t += D.fire
    T(() => {
        phase.value = 'travel'
        trail.value = []
        if (layout.value) startTravel(layout.value)
    }, t)

    t += D.travel
    T(() => {
        awaitResultThen(triggerImpact)
    }, t)
})

onUnmounted(() => {
    timers.forEach(clearTimeout)
    cancelAnimationFrame(raf)
})

function skip() {
    timers.forEach(clearTimeout)
    timers.length = 0
    cancelAnimationFrame(raf)
    if (props.result) emitBurstOnce()
    emit('done')
}
</script>
