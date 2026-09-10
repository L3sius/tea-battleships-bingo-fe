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

    <AttackImpact v-if="burst && targetPos" :x="targetPos.x" :y="targetPos.y" :result="burst"
        :attacker-color="attackerColor" :defender-name="defenderName" @done="onImpactDone" />
</template>

<script setup lang="ts">
import '@/assets/nukeDrop.css'
import { ref, onMounted, nextTick, watch } from 'vue'
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

// Timed to public/sounds/nuke.m4a (10.33s total):
//   0.00–3.23s  spoken countdown "3 … 2 … 1"
//   3.23–7.51s  launch + long whistling fall
//   7.51–10.33s detonation + rumble
// Always drops straight down from just above the viewport, regardless of how
// far down the board the target tile sits. Starts big and close (as if it
// just left the screen in front of you) and shrinks to normal size as it
// falls away into the board — a dolly/zoom perspective, not realistic scaling.
const COUNTDOWN_TOTAL = 3230
const COUNTDOWN_BEAT = Math.round(COUNTDOWN_TOTAL / 3) // ~1077ms per number
const FALL_DURATION = 4280
// The blast visuals and the shared hit/miss reveal share this window so the
// mushroom cloud lingers for the length of the explosion audio.
const EXPLOSION_HOLD = 2900
// Just above the viewport so the bomb is on screen and visibly descending for
// the whole 4.3s fall (a hard ease-in over that long left it off-screen most
// of the way).
const START_Y = -110
const START_SCALE = 1.5
const MID_SCALE = 1.05
const END_SCALE = 0.42

const bombRef = ref<HTMLDivElement>()
const bombAnchorStyle = ref<Record<string, string>>({})
const anchorStyle = ref<Record<string, string>>({})
const targetPos = ref<{ x: number; y: number } | null>(null)
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
    targetPos.value = { x: targetX, y: targetY }

    playSound('/sounds/nuke.m4a')
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
    // A steady tumbling descent that eases into a final plunge, stretched over
    // the ~4.3s the m4a spends whistling down. Kept close to linear so the bomb
    // is visibly moving the whole time, not parked off-screen.
    const anim = bombRef.value!.animate(
        [
            { transform: `translate(0px, 0px) rotate(-9deg) scale(${START_SCALE})`, offset: 0 },
            { transform: `translate(14px, ${(dy * 0.36).toFixed(0)}px) rotate(7deg) scale(${MID_SCALE})`, offset: 0.42 },
            { transform: `translate(-9px, ${(dy * 0.66).toFixed(0)}px) rotate(-4deg) scale(0.74)`, offset: 0.8 },
            { transform: `translate(0px, ${dy}px) rotate(0deg) scale(${END_SCALE})`, offset: 1 },
        ],
        // Linear time; the keyframe offsets do the shaping — steady descent for
        // most of it, then the last fifth covers a third of the distance for an
        // accelerating plunge into the target.
        { duration: FALL_DURATION, easing: 'linear', fill: 'forwards' },
    )
    anim.finished.then(() => {
        arrived = true
        maybeShowBurst()
    })
}

// The fall's duration is fixed and cosmetic; the real result can arrive
// before or after it lands. Only reveal once BOTH the bomb has visually
// arrived AND the real network result is known. The mushroom cloud fades on
// its own shortly after; AttackImpact (mounted alongside it) now owns the
// actual hit/miss/sunk reveal and the eventual 'done'.
watch(() => props.result, maybeShowBurst)

let burstAt = 0

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    burstAt = performance.now()
    emit('burst')
    setTimeout(() => (fadingOut.value = true), EXPLOSION_HOLD - 400)
}

// AttackImpact finishes its hit/miss reveal well before the explosion audio
// tails off; hold 'done' so the mushroom cloud stays up for the full blast.
function onImpactDone() {
    const elapsed = performance.now() - burstAt
    setTimeout(() => emit('done'), Math.max(0, EXPLOSION_HOLD - elapsed))
}
</script>
