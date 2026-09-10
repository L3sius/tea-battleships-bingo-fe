<template>
    <div class="storm-cell" :class="{ fading: fadingOut }" :style="cellAnchorStyle">
        <span class="storm-cell-puff p1"></span>
        <span class="storm-cell-puff p2"></span>
        <span class="storm-cell-puff p3"></span>
        <span class="storm-cell-puff p4"></span>
        <span class="storm-cell-puff p5"></span>
        <div v-if="phase === 'charging'" class="storm-cell-glow"></div>
    </div>

    <div v-if="phase === 'raining' || phase === 'charging' || phase === 'strike' || phase === 'done'"
        class="storm-rain" :class="{ fading: fadingOut }" :style="rainStyle">
        <span class="storm-rain-column c1"></span>
        <span class="storm-rain-column c2"></span>
        <span class="storm-rain-column c3"></span>
        <span class="storm-rain-column c4"></span>
        <span class="storm-rain-column c5"></span>
        <span class="storm-rain-column c6"></span>
    </div>

    <svg v-if="boltVisible" class="storm-bolt-svg" :width="boltBox.w" :height="boltBox.h"
        :style="{ left: boltBox.x + 'px', top: boltBox.y + 'px' }">
        <path :d="boltPath" class="storm-bolt-glow" />
        <path :d="boltPath" class="storm-bolt-core" />
    </svg>

    <AttackImpact v-if="burst && targetPos" :x="targetPos.x" :y="targetPos.y" :result="burst"
        :attacker-color="attackerColor" :defender-name="defenderName" @done="emit('done')" />
</template>

<script setup lang="ts">
import '@/assets/stormStrike.css'
import { ref, onMounted, watch } from 'vue'
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
// Rain (and the cell) keep going for a beat after the strike too, instead of
// cutting off the instant lightning hits, then fade out together.
const RAIN_LINGER = 1000
// A small, local storm cell hovering just above the target tile — this is
// the gap between the tile and the point the cell's rain/bolt fall from.
// Deliberately compact so the attack reads as hitting one tile, not the
// whole board (the previous version anchored a cloud band to the very top
// of the viewport with rain running the full height of the board).
const CELL_GAP = 100
const BOLT_PADDING = 20

interface BoltBox {
    x: number
    y: number
    w: number
    h: number
}

const anchorStyle = ref<Record<string, string>>({})
const cellAnchorStyle = ref<Record<string, string>>({})
const rainStyle = ref<Record<string, string>>({})
const targetPos = ref<{ x: number; y: number } | null>(null)
const boltBox = ref<BoltBox>({ x: 0, y: 0, w: 1, h: 1 })
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
    // Clamped so the cell still has room to render above tiles near the very
    // top of the viewport instead of drifting off-screen.
    const cellBottomY = Math.max(50, targetY - CELL_GAP)

    anchorStyle.value = { left: `${targetX}px`, top: `${targetY}px` }
    targetPos.value = { x: targetX, y: targetY }
    cellAnchorStyle.value = { left: `${targetX}px`, top: `${cellBottomY}px` }
    rainStyle.value = {
        left: `${targetX}px`,
        top: `${cellBottomY}px`,
        height: `${Math.max(0, targetY - cellBottomY)}px`,
    }
    boltBox.value = buildBoltBox(targetX, cellBottomY, targetY)
    boltPath.value = buildBoltPath(boltBox.value, targetX, cellBottomY, targetX, targetY)

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

// A tight local bounding box around just the cell-to-tile strike, instead of
// an SVG sized to the whole viewport — the bolt never travels far now.
function buildBoltBox(startX: number, startY: number, endY: number): BoltBox {
    return {
        x: startX - BOLT_PADDING,
        y: startY - BOLT_PADDING,
        w: BOLT_PADDING * 2,
        h: endY - startY + BOLT_PADDING * 2,
    }
}

// A fixed jagged zigzag scaled to the real start/end points — doesn't need
// true randomness, just needs to read as a lightning bolt at any length.
// Coordinates are relative to the bolt's own local bounding box (`box`).
function buildBoltPath(box: BoltBox, startX: number, startY: number, endX: number, endY: number) {
    const segments = 4
    const dx = endX - startX
    const dy = endY - startY
    const jitter = [9, -11, 6]
    const points: [number, number][] = [[startX - box.x, startY - box.y]]
    for (let i = 1; i < segments; i++) {
        const t = i / segments
        points.push([startX + dx * t + jitter[(i - 1) % jitter.length]! - box.x, startY + dy * t - box.y])
    }
    points.push([endX - box.x, endY - box.y])
    return 'M' + points.map((p) => p.join(',')).join(' L')
}

// The buildup's duration is fixed and cosmetic; the real result can arrive
// before or after it lands. Only reveal once BOTH the bolt has struck AND
// the real network result is known. AttackImpact (mounted alongside the
// burst) now owns the actual hit/miss/sunk reveal and the eventual 'done' —
// the cell/rain just fade out on their own timing underneath it.
watch(() => props.result, maybeShowBurst)

function maybeShowBurst() {
    if (!arrived || !props.result || burst.value) return
    burst.value = props.result
    emit('burst')
    setTimeout(() => (fadingOut.value = true), RAIN_LINGER)
}
</script>
