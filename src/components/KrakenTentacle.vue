<template>
    <div v-if="phase === 'telegraph'" class="kraken-churn" :style="anchorStyle"></div>

    <div v-if="phase === 'rising' || phase === 'receding'" class="kraken-tentacle"
        :class="{ receding: phase === 'receding' }" :style="tentacleAnchorStyle">
        <img src="/images/kraken.png" class="kraken-sprite" alt="" />
    </div>

    <div v-if="burst" class="kraken-burst" :class="[burst, { fading: fadingOut }]" :style="anchorStyle">
        <div class="burst-flash"></div>
        <div class="burst-ring"></div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/krakenTentacle.css'
import { ref, onMounted, watch } from 'vue'
import type { ShotResult } from '@/api/types'
import { playSound } from '@/utils/sound'

const props = defineProps<{
    targetEl: HTMLElement
    /** null while the real shot is still in flight over the network */
    result: ShotResult | null
}>()

const emit = defineEmits<{ done: []; burst: [] }>()

// Unlike the other three, the kraken doesn't travel FROM anywhere — it
// erupts into view AT the target itself. The sprite is a full symmetric
// creature face (not a tapering tentacle), so it scales up from the tile's
// center rather than rising from below it. The "impact" is the moment it
// bursts into view, not a separate downward slam.
//
// Timed to match public/sounds/kraken.m4a: a 1.68s "release the kraken"
// voice line, then a roar until the clip ends at 6.04s. The churn plays
// under the voice line, the burst-in lands exactly as the roar starts, and
// it holds at full size roaring for a while before the splash impact.
const VOICE_DURATION = 1680
const RISE_DURATION = 320
const HOLD_DURATION = 1800
const TELEGRAPH_DURATION = VOICE_DURATION - RISE_DURATION
const RECEDE_DURATION = 400

const anchorStyle = ref<Record<string, string>>({})
const tentacleAnchorStyle = ref<Record<string, string>>({})
const phase = ref<'telegraph' | 'rising' | 'receding'>('telegraph')
const burst = ref<ShotResult | null>(null)
const fadingOut = ref(false)
let arrived = false

onMounted(() => {
    const targetRect = props.targetEl.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2

    anchorStyle.value = { left: `${targetX}px`, top: `${targetY}px` }
    tentacleAnchorStyle.value = { left: `${targetX}px`, top: `${targetY}px` }

    playSound('/sounds/kraken.m4a')

    setTimeout(() => {
        phase.value = 'rising'
        setTimeout(() => {
            arrived = true
            maybeShowBurst()
        }, RISE_DURATION + HOLD_DURATION)
    }, TELEGRAPH_DURATION)
})

// The rise's duration is fixed and cosmetic; the real result can arrive
// before or after it lands. Only reveal once BOTH the tentacle has visually
// burst out AND the real network result is known.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    phase.value = 'receding'
    setTimeout(() => (fadingOut.value = true), RECEDE_DURATION - 100)
    setTimeout(() => emit('done'), RECEDE_DURATION + 150)
}
</script>
