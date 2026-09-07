<template>
    <div class="cannon-rig" :class="{ appear: appearing, 'fade-out': cannonFading }">
        <div class="cannon-rotator" :style="{ transform: `rotate(${angleDeg}deg)` }">
            <img src="/images/cannon.png" class="cannon-sprite" alt="" />
            <div v-if="showFlash" class="muzzle-flash"></div>
        </div>
    </div>

    <div ref="ballRef" class="cannon-projectile" :style="ballAnchorStyle">
        <div v-if="!burst" class="cannonball-big"></div>
        <div v-else class="impact-boom" :class="burst">
            <div class="boom-flash"></div>
            <div class="boom-ring"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/cannonShot.css'
import { ref, onMounted, watch } from 'vue'
import type { ShotResult } from '@/api/types'

const props = defineProps<{
    targetEl: HTMLElement
    /** null while the real shot is still in flight over the network */
    result: ShotResult | null
}>()

const emit = defineEmits<{ done: []; burst: [] }>()

// Must match .cannon-rig's fixed size/position in cannonShot.css.
const RIG_SIZE = 260
const RIG_MARGIN = 40

// Measured directly from cannon.png: the muzzle opening sits this far from
// the sprite's center (as a fraction of its size) at a baked-in upward tilt,
// since the art rests with the barrel elevated rather than dead level.
const MUZZLE_FRACTION = 0.4941
const MUZZLE_BASE_ANGLE = (-15.2 * Math.PI) / 180

const ballRef = ref<HTMLDivElement>()
const ballAnchorStyle = ref<Record<string, string>>({})
const angleDeg = ref(0)
const appearing = ref(false)
const showFlash = ref(false)
const cannonFading = ref(false)
const burst = ref<ShotResult | null>(null)
let arrived = false

onMounted(() => {
    const cannonX = RIG_MARGIN + RIG_SIZE / 2
    const cannonY = window.innerHeight - RIG_MARGIN - RIG_SIZE / 2

    const targetRect = props.targetEl.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2

    const angleRad = Math.atan2(targetY - cannonY, targetX - cannonX)
    angleDeg.value = (angleRad * 180) / Math.PI

    // Rotate the muzzle's resting-tilt vector by the aim angle to find where
    // the barrel opening actually ends up on screen, so the ball spawns
    // exactly there instead of at a generic offset.
    const muzzleOffset = RIG_SIZE * MUZZLE_FRACTION
    const muzzleAngle = angleRad + MUZZLE_BASE_ANGLE
    const muzzleX = cannonX + Math.cos(muzzleAngle) * muzzleOffset
    const muzzleY = cannonY + Math.sin(muzzleAngle) * muzzleOffset
    ballAnchorStyle.value = { left: `${muzzleX}px`, top: `${muzzleY}px` }

    // Let it fade/scale into view already aimed, then hold the pose briefly before firing.
    requestAnimationFrame(() => {
        appearing.value = true
    })

    setTimeout(() => {
        showFlash.value = true
        setTimeout(() => (showFlash.value = false), 140)
        cannonFading.value = true

        const dx = targetX - muzzleX
        const dy = targetY - muzzleY
        const anim = ballRef.value!.animate(
            [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${dx}px, ${dy}px)` }],
            { duration: 620, easing: 'linear', fill: 'forwards' },
        )
        anim.finished.then(() => {
            arrived = true
            maybeShowBurst()
        })
    }, 800)
})

// The projectile's flight time is fixed and cosmetic; the real result can
// arrive before or after it lands. Only reveal once BOTH the ball has
// visually arrived AND the real network result is known.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    setTimeout(() => emit('done'), 650)
}
</script>
