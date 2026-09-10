<template>
    <template v-if="isHit">
        <div class="atk-hit-flash" :style="hitFlashStyle"></div>
        <div class="atk-hit-ring r1" :style="hitRing1Style"></div>
        <div class="atk-hit-ring r2" :style="hitRing2Style"></div>
        <div v-for="(s, i) in sparks" :key="'spark-' + i" class="atk-hit-spark" :style="sparkStyle(s)"></div>
        <div v-for="(dx, i) in HIT_SMOKE_OFFSETS" :key="'hsmoke-' + i" class="atk-hit-smoke"
            :style="hitSmokeStyle(dx, i)"></div>
    </template>
    <template v-else>
        <div class="atk-miss-column" :style="missColumnStyle"></div>
        <div v-for="(sc, i) in MISS_RING_SCALES" :key="'ring-' + i" class="atk-miss-ring" :style="missRingStyle(sc, i)">
        </div>
        <div v-for="(d, i) in drops" :key="'drop-' + i" class="atk-miss-drop" :style="dropStyle(d)"></div>
    </template>

    <div v-if="showResult" class="atk-result-text" :style="{ color: resultColor }">{{ resultLabel }}</div>

    <div v-if="showSunk" class="atk-sunk-scene">
        <div class="atk-sunk-ship-wrap">
            <svg :width="SHIP_W" :height="SHIP_H" viewBox="0 0 260 130" aria-hidden="true">
                <path d="M15 78 Q130 60 245 78 L233 104 Q130 112 27 104 Z" fill="#1a3050" />
                <path d="M15 78 Q130 62 245 78 L242 84 Q130 68 18 84 Z" fill="#243d60" opacity="0.65" />
                <line x1="80" y1="22" x2="80" y2="78" stroke="#162a40" stroke-width="4" />
                <path d="M80 24 L80 66 L54 60 Z" fill="#162a40" opacity="0.9" />
                <path d="M80 24 L80 56 L58 51 Z" fill="#1e3450" opacity="0.55" />
                <line x1="130" y1="5" x2="130" y2="78" stroke="#162a40" stroke-width="5" />
                <path d="M130 8 L130 70 L92 63 Z" fill="#162a40" opacity="0.92" />
                <path d="M130 8 L130 56 L96 50 Z" fill="#1e3450" opacity="0.62" />
                <path d="M130 8 L130 30 L110 24 Z" fill="#162a40" opacity="0.8" />
                <line x1="178" y1="28" x2="178" y2="78" stroke="#162a40" stroke-width="3.5" />
                <path d="M178 30 L178 66 L152 60 Z" fill="#162a40" opacity="0.88" />
                <polygon points="130,5 156,15 130,24" :fill="attackerColor" opacity="0.92" />
                <circle v-for="px in [55, 90, 118, 148, 182, 214]" :key="'port-' + px" :cx="px" cy="92" r="4"
                    fill="#0d2035" stroke="#1a3a55" stroke-width="1" />
                <ellipse v-for="(fx, i) in [78, 120, 162]" :key="'flame-' + fx" :cx="fx" cy="62" rx="10" ry="18"
                    :fill="i === 1 ? '#ff8800' : '#ff4400'" opacity="0.72" />
                <line x1="15" y1="104" x2="245" y2="104" stroke="#2a6a99" stroke-width="1.5" opacity="0.42" />
            </svg>
        </div>
        <div class="atk-sunk-caption">{{ defenderCaption }}</div>
    </div>
</template>

<script setup lang="ts">
// The shared "moment of truth" for every attack style: once an attack's own
// lead-up (cannon fuse, bomb drop, laser beam, tentacle burst, storm bolt...)
// reaches its impact point AND the real network result is known, the parent
// mounts this to reveal hit/miss/sunk consistently — same explosion/splash,
// same "DIRECT HIT! / MISS! / SHIP SUNK!" text slam, same sunk-ship scene,
// regardless of which attack got the ball there.
import '@/assets/attackImpact.css'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ShotResult } from '@/api/types'

const props = defineProps<{
    x: number
    y: number
    result: ShotResult
    attackerColor: string
    /** Only known once the fire response has come back; null until then. */
    defenderName: string | null
    /** Timer speed multiplier (e.g. 0.6 on mobile) — defaults to normal speed. */
    speed?: number
}>()

const emit = defineEmits<{ done: [] }>()

interface Spark {
    sx: string
    sy: string
    color: string
    sz: number
    delay: number
    dur: number
}

interface Drop {
    dx: string
    dy: string
    delay: number
}

const IMPACT_HOLD = 380
const RESULT_HOLD = 1020
const SUNK_DELAY = 580
const SUNK_HOLD = 2200

const SHIP_W = window.innerWidth < 768 ? 190 : 270
const SHIP_H = Math.round(SHIP_W * 0.5)
const HIT_SMOKE_OFFSETS = [-18, 0, 18]
const MISS_RING_SCALES = [0.9, 1.55, 2.2]

const phase = ref<'impact' | 'result' | 'sunk'>('impact')
const sparks = ref<Spark[]>([])
const drops = ref<Drop[]>([])

const isHit = computed(() => props.result === 'hit' || props.result === 'sunk')
const isSunk = computed(() => props.result === 'sunk')
const resultLabel = computed(() => (isSunk.value ? 'SHIP SUNK!' : isHit.value ? 'DIRECT HIT!' : 'MISS!'))
const resultColor = computed(() => (isHit.value ? '#ff4d1a' : '#4a9acf'))
const defenderCaption = computed(() => `${props.defenderName ?? 'The enemy'}'s fleet takes a direct hit`)

const showResult = computed(() => phase.value === 'result' || phase.value === 'sunk')
const showSunk = computed(() => phase.value === 'sunk')

function impactRadius() {
    return isSunk.value ? 70 : 56
}

const hitFlashStyle = computed(() => {
    const R = impactRadius()
    return {
        left: `${props.x - R}px`,
        top: `${props.y - R}px`,
        width: `${R * 2}px`,
        height: `${R * 2}px`,
        animationDuration: isSunk.value ? '0.5s' : '0.42s',
    }
})
const hitRing1Style = computed(() => {
    const R = impactRadius()
    return {
        left: `${props.x - R * 1.5}px`,
        top: `${props.y - R * 1.5}px`,
        width: `${R * 3}px`,
        height: `${R * 3}px`,
    }
})
const hitRing2Style = computed(() => {
    const R = impactRadius()
    return {
        left: `${props.x - R * 2.1}px`,
        top: `${props.y - R * 2.1}px`,
        width: `${R * 4.2}px`,
        height: `${R * 4.2}px`,
    }
})

function sparkStyle(s: Spark) {
    return {
        left: `${props.x - s.sz / 2}px`,
        top: `${props.y - s.sz / 2}px`,
        width: `${s.sz}px`,
        height: `${s.sz}px`,
        background: s.color,
        boxShadow: `0 0 ${s.sz * 2}px ${s.color}`,
        animationDuration: `${s.dur}ms`,
        animationDelay: `${s.delay}ms`,
        '--sx': s.sx,
        '--sy': s.sy,
    }
}

function hitSmokeStyle(dx: number, i: number) {
    return {
        left: `${props.x - 14 + dx}px`,
        top: `${props.y - 18}px`,
        width: '26px',
        height: '36px',
        background: `rgba(255, ${80 + i * 30}, 0, 0.65)`,
        animationDelay: `${i * 90}ms`,
        '--dx': `${dx * 0.6}px`,
    }
}

const missColumnStyle = computed(() => ({
    left: `${props.x - 14}px`,
    top: `${props.y - 64}px`,
    width: '28px',
    height: '64px',
}))

function missRingStyle(sc: number, i: number) {
    return {
        left: `${props.x - 32 * sc}px`,
        top: `${props.y - 32 * sc}px`,
        width: `${64 * sc}px`,
        height: `${64 * sc}px`,
        animationDelay: `${i * 95}ms`,
    }
}

function dropStyle(d: Drop) {
    return {
        left: `${props.x - 3}px`,
        top: `${props.y - 3}px`,
        animationDelay: `${d.delay}ms`,
        '--dx': d.dx,
        '--dy': d.dy,
    }
}

function generateSparks(sunk: boolean) {
    const count = sunk ? 18 : 14
    sparks.value = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.3
        const d = 48 + Math.random() * 46
        return {
            sx: `${(d * Math.cos(a)).toFixed(1)}px`,
            sy: `${(d * Math.sin(a)).toFixed(1)}px`,
            color: Math.random() > 0.45 ? '#ffcc33' : '#ff5511',
            sz: 4 + Math.random() * 5,
            delay: Math.floor(Math.random() * 70),
            dur: 580 + Math.floor(Math.random() * 160),
        }
    })
}

function generateDrops() {
    drops.value = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        const d = 34 + Math.random() * 28
        return {
            dx: `${(d * Math.cos(a)).toFixed(1)}px`,
            dy: `${(d * Math.sin(a) - 36).toFixed(1)}px`,
            delay: Math.floor(Math.random() * 90),
        }
    })
}

// No impact SFX for now — the old procedural Web Audio hit-thud / splash-tone
// were cut (felt cheap). Real hit/miss/sunk sound assets will be added here
// later, shared by every attack style the way this reveal already is.

const timers: ReturnType<typeof setTimeout>[] = []
function T(fn: () => void, ms: number) {
    timers.push(setTimeout(fn, ms * (props.speed ?? 1)))
}

onMounted(() => {
    if (isHit.value) generateSparks(isSunk.value)
    else generateDrops()

    T(() => {
        phase.value = 'result'
    }, IMPACT_HOLD)

    if (isSunk.value) {
        T(() => {
            phase.value = 'sunk'
        }, IMPACT_HOLD + SUNK_DELAY)
        T(() => emit('done'), IMPACT_HOLD + SUNK_DELAY + SUNK_HOLD)
    } else {
        T(() => emit('done'), IMPACT_HOLD + RESULT_HOLD)
    }
})

onUnmounted(() => {
    timers.forEach(clearTimeout)
})
</script>
