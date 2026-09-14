<template>
    <button type="button" class="auto-switch" :class="{ on: autoSwitch }" role="switch" :aria-checked="autoSwitch"
        aria-label="Auto-switch to the attacking team's board" @click="toggle">
        <span class="auto-switch-track"><span class="auto-switch-knob" /></span>
        <span class="auto-switch-label">Auto-switch</span>
    </button>
</template>

<script setup lang="ts">
import '@/assets/autoSwitchToggle.css'
import { autoSwitch } from '@/utils/autoSwitch'

function toggle() {
    autoSwitch.value = !autoSwitch.value
}
</script>
