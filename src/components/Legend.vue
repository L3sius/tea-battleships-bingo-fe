<template>
    <button class="legend-button" title="What do the icons mean?" @click="open = true">?</button>

    <div v-if="open" class="legend-backdrop" @click.self="open = false">
        <div class="legend-modal">
            <div class="legend-header">
                <h2 class="legend-title">Legend</h2>
                <button class="legend-close" @click="open = false">✕</button>
            </div>

            <div class="legend-items">
                <div class="legend-item">
                    <span class="legend-icon legend-difficulty">3</span>
                    <span>Task difficulty rating</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon">
                        <span class="legend-progress-track"><span class="legend-progress-fill"></span></span>
                    </span>
                    <span>Progress toward a multi-step task</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon legend-fire">⌖</span>
                    <span>Task completed — click the tile to fire!</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon legend-hit">✕</span>
                    <span>A shot you fired here hit an enemy ship</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon legend-wreck">☠ 2</span>
                    <span>You sank an enemy ship — its full shape is revealed</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon"><span class="legend-miss-dot"></span></span>
                    <span>A shot you fired here missed</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon">
                        <span class="legend-hp-track"><span class="legend-hp-fill"></span></span>
                    </span>
                    <span>Ship health — green healthy, orange damaged, red critical, "Sunk" destroyed</span>
                </div>
                <div class="legend-item">
                    <span class="legend-icon legend-unknown">?</span>
                    <span>An undiscovered hidden challenge</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import '@/assets/legend.css'
import { ref } from 'vue'

const open = ref(false)
</script>
