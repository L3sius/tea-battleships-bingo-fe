<template>
    <div class="nuke-shadow" :style="anchorStyle"></div>

    <div v-if="countdown !== null" :key="countdown" class="nuke-countdown">{{ countdown }}</div>

    <div v-if="!burst && countdown === null" ref="bombRef" class="nuke-bomb" :style="bombAnchorStyle">
        <img src="/images/nuke.png" class="nuke-sprite" alt="" />
    </div>

    <div v-if="burst" class="nuke-boom" :class="[burst, { fading: fadingOut }]" :style="anchorStyle">
        <div class="boom-flash-big"></div>
        <div class="boom-shock-big"></div>
        <div class="mushroom-stem"></div>
        <div class="mushroom-cap"></div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/nukeDrop.css'
import { ref, onMounted, nextTick, watch } from 'vue'
import type { ShotResult } from '@/api/types'

const props = defineProps<{
    targetEl: HTMLElement
    /** null while the real shot is still in flight over the network */
    result: ShotResult | null
}>()

const emit = defineEmits<{ done: []; burst: [] }>()

// Always drops straight down from just above the viewport, regardless of
// how far down the board the target tile actually sits. Starts big and
// close (as if it just left the screen right in front of you) and shrinks
// down to normal size as it falls away into the board, like a dolly/zoom
// perspective shot rather than physically realistic scaling.
const START_Y = -320
const FALL_DURATION = 1300
const COUNTDOWN_BEAT = 700
const START_SCALE = 1.8
const MID_SCALE = 1.05
const END_SCALE = 0.45

const bombRef = ref<HTMLDivElement>()
const bombAnchorStyle = ref<Record<string, string>>({})
const anchorStyle = ref<Record<string, string>>({})
const countdown = ref<number | null>(3)
const burst = ref<ShotResult | null>(null)
const fadingOut = ref(false)
let arrived = false

onMounted(() => {
    const targetRect = props.targetEl.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2

    anchorStyle.value = { left: `${targetX}px`, top: `${targetY}px` }
    bombAnchorStyle.value = { left: `${targetX}px`, top: `${START_Y}px` }

    tickCountdown(targetY)
})

// Each number (3, 2, 1) gets a full beat on screen before the next step —
// counting down TO zero, not skipping past 1 the moment it's reached.
function tickCountdown(targetY: number) {
    if (countdown.value === null) return
    setTimeout(() => {
        const next = (countdown.value ?? 1) - 1
        if (next <= 0) {
            countdown.value = null
            nextTick(() => startFall(targetY))
        } else {
            countdown.value = next
            tickCountdown(targetY)
        }
    }, COUNTDOWN_BEAT)
}

function startFall(targetY: number) {
    const dy = targetY - START_Y
    const anim = bombRef.value!.animate(
        [
            { transform: `translate(0px, 0px) rotate(-6deg) scale(${START_SCALE})` },
            { transform: `translate(8px, ${dy * 0.55}px) rotate(4deg) scale(${MID_SCALE})` },
            { transform: `translate(0px, ${dy}px) rotate(0deg) scale(${END_SCALE})` },
        ],
        { duration: FALL_DURATION, easing: 'cubic-bezier(0.55, 0.05, 0.85, 0.45)', fill: 'forwards' },
    )
    anim.finished.then(() => {
        arrived = true
        maybeShowBurst()
    })
}

// The fall's duration is fixed and cosmetic; the real result can arrive
// before or after it lands. Only reveal once BOTH the bomb has visually
// arrived AND the real network result is known.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    setTimeout(() => (fadingOut.value = true), 650)
    setTimeout(() => emit('done'), 950)
}
</script>
