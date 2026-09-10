<template>
    <div class="sound-control">
        <button type="button" class="sound-btn" :class="{ muted }" :aria-label="muted ? 'Unmute sound' : 'Mute sound'"
            :title="muted ? 'Sound off — click to unmute' : `Sound ${pct}% — click to mute`" @click="toggleMute">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                <template v-if="muted">
                    <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </template>
                <template v-else>
                    <path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" />
                    <path v-if="pct > 55" d="M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor"
                        stroke-width="2" stroke-linecap="round" />
                </template>
            </svg>
        </button>

        <input class="sound-slider" type="range" min="0" max="100" step="5" :value="pct" aria-label="Sound volume"
            @input="onSlide" />
    </div>
</template>

<script setup lang="ts">
import '@/assets/soundControl.css'
import { computed } from 'vue'
import { useMasterVolume, setMasterVolume, toggleMute } from '@/utils/sound'

const volume = useMasterVolume()

const pct = computed(() => Math.round(volume.value * 100))
const muted = computed(() => volume.value === 0)

function onSlide(e: Event) {
    setMasterVolume(Number((e.target as HTMLInputElement).value) / 100)
}
</script>
