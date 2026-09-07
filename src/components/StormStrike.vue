<template>
    <div class="storm-clouds" :class="{ fading: fadingOut }" :style="cloudAnchorStyle">
        <span class="storm-cloud-puff p1"></span>
        <span class="storm-cloud-puff p2"></span>
        <span class="storm-cloud-puff p3"></span>
        <span class="storm-cloud-puff p4"></span>
        <span class="storm-cloud-puff p5"></span>
        <div v-if="phase === 'charging'" class="storm-charge-glow"></div>
    </div>

    <div v-if="phase === 'raining' || phase === 'charging' || phase === 'strike' || phase === 'done'"
        class="storm-rain" :class="{ fading: fadingOut }" :style="rainStyle">
        <span class="storm-rain-column c1"></span>
        <span class="storm-rain-column c2"></span>
        <span class="storm-rain-column c3"></span>
        <span class="storm-rain-column c4"></span>
        <span class="storm-rain-column c5"></span>
        <span class="storm-rain-column c6"></span>
        <span class="storm-rain-column c7"></span>
        <span class="storm-rain-column c8"></span>
    </div>

    <svg v-if="boltVisible" class="storm-bolt-svg" :width="viewportWidth" :height="viewportHeight">
        <path :d="boltPath" class="storm-bolt-glow" />
        <path :d="boltPath" class="storm-bolt-core" />
    </svg>

    <div v-if="burst" class="storm-burst" :class="[burst, { fading: fadingOut }]" :style="anchorStyle">
        <div class="burst-flash"></div>
        <div class="burst-ring"></div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/stormStrike.css'
import { ref, onMounted, watch } from 'vue'
import type { ShotResult } from '@/api/types'
import { playSound } from '@/utils/sound'

const props = defineProps<{
    targetEl: HTMLElement
    /** null while the real shot is still in flight over the network */
    result: ShotResult | null
}>()

const emit = defineEmits<{ done: []; burst: [] }>()

// Timed to match public/sounds/storm.m4a: rain starts instantly, the
// lightning hits at 2.9s, and the whole clip runs 6.15s (the remainder
// after the strike is the impact hold/fade, matching thunder's decay).
const RAIN_AT = 150
const CHARGE_AT = 2400
const STRIKE_AT = 2700
const ARRIVED_AT = 2900
// The bolt itself lingers a bit after the impact rather than vanishing the
// instant it strikes — the impact/result reveal still happens at ARRIVED_AT.
const BOLT_LINGER = 1000
// Rain (and the clouds) keep going for a beat after the strike too, instead
// of cutting off the instant lightning hits, then fade out together.
const RAIN_LINGER = 1000
const CLOUD_BOTTOM_Y = 70

const anchorStyle = ref<Record<string, string>>({})
const cloudAnchorStyle = ref<Record<string, string>>({})
const rainStyle = ref<Record<string, string>>({})
const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)
const boltPath = ref('')
const phase = ref<'forming' | 'raining' | 'charging' | 'strike' | 'done'>('forming')
const boltVisible = ref(false)
const burst = ref<ShotResult | null>(null)
const fadingOut = ref(false)
let arrived = false

onMounted(() => {
    const targetRect = props.targetEl.getBoundingClientRect()
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2

    anchorStyle.value = { left: `${targetX}px`, top: `${targetY}px` }
    cloudAnchorStyle.value = { left: `${targetX}px`, top: '0px' }
    rainStyle.value = { left: `${targetX}px`, top: `${CLOUD_BOTTOM_Y}px`, height: `${Math.max(0, targetY - CLOUD_BOTTOM_Y)}px` }
    boltPath.value = buildBoltPath(targetX, CLOUD_BOTTOM_Y, targetX, targetY)

    playSound('/sounds/storm.m4a')

    setTimeout(() => (phase.value = 'raining'), RAIN_AT)
    setTimeout(() => (phase.value = 'charging'), CHARGE_AT)
    setTimeout(() => {
        phase.value = 'strike'
        boltVisible.value = true
    }, STRIKE_AT)
    setTimeout(() => {
        phase.value = 'done'
        arrived = true
        maybeShowBurst()
    }, ARRIVED_AT)
    setTimeout(() => (boltVisible.value = false), ARRIVED_AT + BOLT_LINGER)
})

// A fixed jagged zigzag scaled to the real start/end points — doesn't need
// true randomness, just needs to read as a lightning bolt at any length.
function buildBoltPath(startX: number, startY: number, endX: number, endY: number) {
    const segments = 6
    const dx = endX - startX
    const dy = endY - startY
    const jitter = [16, -20, 12, -14, 18, -9]
    const points: [number, number][] = [[startX, startY]]
    for (let i = 1; i < segments; i++) {
        const t = i / segments
        points.push([startX + dx * t + jitter[i % jitter.length]!, startY + dy * t])
    }
    points.push([endX, endY])
    return 'M' + points.map((p) => p.join(',')).join(' L')
}

// The buildup's duration is fixed and cosmetic; the real result can arrive
// before or after it lands. Only reveal once BOTH the bolt has struck AND
// the real network result is known.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    setTimeout(() => (fadingOut.value = true), RAIN_LINGER)
    setTimeout(() => emit('done'), Math.max(BOLT_LINGER, RAIN_LINGER) + 450)
}
</script>
