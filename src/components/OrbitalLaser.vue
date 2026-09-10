<template>
    <div class="laser-fx" :style="{ '--beam-tint': attackerColor }">
        <div v-if="phase !== 'done'" class="laser-vignette" :class="{ armed: charging || phase === 'beam' }"></div>

        <div v-if="phase === 'telegraph'" class="laser-track" :class="{ hot: charging }" :style="beamStyle"></div>

        <div v-if="charging" class="laser-origin" :class="{ inhale: inhaling }" :style="originStyle">
            <span class="laser-origin-core"></span>
            <span class="laser-origin-ring r1"></span>
            <span class="laser-origin-ring r2"></span>
        </div>

        <template v-if="charging">
            <span v-for="m in motes" :key="'m' + m.id" class="laser-mote" :style="m.style"></span>
        </template>

        <div v-if="reticleVisible" class="laser-reticle-spin" :class="{ locking, fading: reticleFading }"
            :style="anchorStyle">
            <div class="laser-reticle"></div>
            <span class="laser-bracket tl"></span>
            <span class="laser-bracket tr"></span>
            <span class="laser-bracket bl"></span>
            <span class="laser-bracket br"></span>
        </div>

        <div v-if="flashOn" class="laser-flash"></div>

        <template v-if="phase === 'beam'">
            <div class="laser-beam-haze" :class="{ cutoff }" :style="beamStyle"></div>
            <div class="laser-beam-glow" :class="{ cutoff }" :style="beamStyle"></div>
            <div class="laser-beam-core" :class="{ cutoff }" :style="beamStyle"></div>

            <span v-for="p in pulses" :key="'p' + p.id" class="laser-pulse" :style="p.style"></span>

            <div class="laser-impact" :class="{ cutoff }" :style="anchorStyle">
                <span class="laser-impact-flare"></span>
                <span class="laser-impact-ring r1"></span>
                <span class="laser-impact-ring r2"></span>
            </div>
            <span v-for="e in embers" :key="'e' + e.id" class="laser-ember" :style="e.style"></span>
        </template>

        <div v-if="cutoff" class="laser-collapse" :style="originStyle"></div>

        <div v-if="scorchVisible" class="laser-scorch" :style="anchorStyle"></div>
    </div>

    <AttackImpact v-if="burst && targetPos" :x="targetPos.x" :y="targetPos.y" :result="burst"
        :attacker-color="attackerColor" :defender-name="defenderName" @done="emit('done')" />
</template>

<script setup lang="ts">
import '@/assets/orbitalLaser.css'
import { ref, onMounted, onUnmounted, watch } from 'vue'
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

// Timed to public/sounds/laser.m4a: a 3.86s charging whine, then 3.24s of
// laser-fire, 7.10s total. Every sub-beat below sits inside those two windows.
const TELEGRAPH_DURATION = 3860
const BEAM_DURATION = 3240
const CHARGE_AT = 900 // the lock snaps shut and the orbital cannon spins up
const INHALE_AT = 3660 // everything stills and dims for the final 200ms
const RETICLE_FADE = 150
const FLASH_MS = 90
const SHAKE_MS = 360
const CUTOFF_AT = 3040 // beam collapses just before the fire sound ends

interface FxItem {
    id: number
    style: Record<string, string>
}

const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const anchorStyle = ref<Record<string, string>>({})
const originStyle = ref<Record<string, string>>({})
const beamStyle = ref<Record<string, string>>({})
const targetPos = ref<{ x: number; y: number } | null>(null)

const phase = ref<'telegraph' | 'beam' | 'done'>('telegraph')
const locking = ref(true)
const charging = ref(false)
const inhaling = ref(false)
const cutoff = ref(false)
const flashOn = ref(false)
const scorchVisible = ref(false)
const reticleVisible = ref(true)
const reticleFading = ref(false)
const burst = ref<ShotResult | null>(null)

const motes = ref<FxItem[]>([])
const pulses = ref<FxItem[]>([])
const embers = ref<FxItem[]>([])

let arrived = false
const timers: ReturnType<typeof setTimeout>[] = []
const T = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms))

onMounted(() => {
    const r = props.targetEl.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2

    anchorStyle.value = { left: `${x}px`, top: `${y}px` }
    originStyle.value = { left: `${x}px`, top: '0px' }
    beamStyle.value = { left: `${x}px`, height: `${y}px` }
    targetPos.value = { x, y }

    playSound('/sounds/laser.m4a')

    T(() => {
        locking.value = false
        charging.value = true
        // Motes are pulled up the beam path toward the cannon while it charges.
        motes.value = Array.from({ length: 10 }, (_, i) => ({
            id: i,
            style: {
                left: `${x + (Math.random() - 0.5) * 34}px`,
                '--mote-from': `${y * (0.25 + Math.random() * 0.7)}px`,
                '--mote-dur': `${700 + Math.random() * 700}ms`,
                '--mote-delay': `${Math.random() * 1700}ms`,
            },
        }))
    }, CHARGE_AT)

    T(() => (inhaling.value = true), INHALE_AT)
    T(() => (reticleFading.value = true), TELEGRAPH_DURATION - RETICLE_FADE)

    T(() => {
        reticleVisible.value = false
        charging.value = false
        phase.value = 'beam'
        scorchVisible.value = true

        pulses.value = Array.from({ length: 3 }, (_, i) => ({
            id: i,
            style: {
                left: `${x}px`,
                '--pulse-to': `${y}px`,
                '--pulse-dur': `${260 + i * 90}ms`,
                '--pulse-delay': `${i * 120}ms`,
            },
        }))
        embers.value = Array.from({ length: 16 }, (_, i) => {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7 // upward-biased cone
            const d = 34 + Math.random() * 96
            return {
                id: i,
                style: {
                    left: `${x}px`,
                    top: `${y}px`,
                    '--ember-x': `${(Math.cos(a) * d).toFixed(1)}px`,
                    '--ember-y': `${(Math.sin(a) * d).toFixed(1)}px`,
                    '--ember-delay': `${Math.floor(Math.random() * 220)}ms`,
                },
            }
        })

        if (!reduced) {
            flashOn.value = true
            T(() => (flashOn.value = false), FLASH_MS)
            const app = document.getElementById('app')
            app?.classList.add('laser-shaking')
            T(() => app?.classList.remove('laser-shaking'), SHAKE_MS)
        }

        T(() => (cutoff.value = true), CUTOFF_AT)
        T(() => {
            phase.value = 'done'
            arrived = true
            maybeShowBurst()
        }, BEAM_DURATION)
    }, TELEGRAPH_DURATION)
})

onUnmounted(() => {
    timers.forEach(clearTimeout)
    document.getElementById('app')?.classList.remove('laser-shaking')
})

// The beam's timing is fixed and cosmetic; the real result can arrive before
// or after it lands. Only reveal once BOTH the beam has struck AND the real
// network result is known. AttackImpact (mounted alongside the burst) owns the
// actual hit/miss/sunk reveal and the eventual 'done'.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
}
</script>
