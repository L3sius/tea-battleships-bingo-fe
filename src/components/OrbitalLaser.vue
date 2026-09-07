<template>
    <div v-if="reticleVisible" class="laser-reticle-spin" :class="{ fading: reticleFading }" :style="anchorStyle">
        <div class="laser-reticle"></div>
    </div>

    <template v-if="phase === 'beam'">
        <div class="laser-beam-glow" :style="beamStyle"></div>
        <div class="laser-beam-core" :style="beamStyle"></div>
    </template>

    <div v-if="burst" class="laser-burst" :class="[burst, { fading: fadingOut }]" :style="anchorStyle">
        <div class="burst-flash"></div>
        <div class="burst-ring"></div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/orbitalLaser.css'
import { ref, onMounted, watch } from 'vue'
import type { ShotResult } from '@/api/types'
import { playSound } from '@/utils/sound'

const props = defineProps<{
    targetEl: HTMLElement
    /** null while the real shot is still in flight over the network */
    result: ShotResult | null
}>()

const emit = defineEmits<{ done: []; burst: [] }>()

// Timed to match public/sounds/laser.m4a: a 3.86s charging whine (telegraph)
// followed by a 3.24s laser-fire sound (beam), 7.10s total. Both are played
// from the same trigger point as the visuals so they can't drift apart.
const TELEGRAPH_DURATION = 3860
const BEAM_DURATION = 3240

const anchorStyle = ref<Record<string, string>>({})
const beamStyle = ref<Record<string, string>>({})
const phase = ref<'telegraph' | 'beam' | 'done'>('telegraph')
const reticleVisible = ref(true)
const reticleFading = ref(false)
const burst = ref<ShotResult | null>(null)
const fadingOut = ref(false)
let arrived = false

// The reticle pulses continuously, so removing it outright mid-pulse would
// pop rather than fade — give it a brief fade-out just before the beam fires.
const RETICLE_FADE = 150

onMounted(() => {
    const targetRect = props.targetEl.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2

    anchorStyle.value = { left: `${targetX}px`, top: `${targetY}px` }
    beamStyle.value = { left: `${targetX}px`, height: `${targetY}px` }

    playSound('/sounds/laser.m4a')

    setTimeout(() => (reticleFading.value = true), TELEGRAPH_DURATION - RETICLE_FADE)
    setTimeout(() => {
        reticleVisible.value = false
        phase.value = 'beam'
        setTimeout(() => {
            phase.value = 'done'
            arrived = true
            maybeShowBurst()
        }, BEAM_DURATION)
    }, TELEGRAPH_DURATION)
})

// The beam's timing is fixed and cosmetic; the real result can arrive before
// or after it lands. Only reveal once BOTH the beam has struck AND the real
// network result is known.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    setTimeout(() => (fadingOut.value = true), 400)
    setTimeout(() => emit('done'), 600)
}
</script>
