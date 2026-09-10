<template>
    <button type="button" class="dink-setup-trigger" @click="open = true">Dink setup</button>

    <Teleport to="body">
        <div v-if="open" class="dink-setup-backdrop" @click.self="onBackdrop">
            <div class="dink-setup-modal" role="dialog" aria-label="Dink setup guide">
                <div class="dink-setup-header">
                    <div>
                        <h2 class="dink-setup-title">Dink Setup</h2>
                        <p class="dink-setup-subtitle">How to connect the Dink plugin</p>
                    </div>
                    <button class="dink-setup-close" aria-label="Close" @click="close">✕</button>
                </div>

                <ol class="dink-setup-steps">
                    <li>Install <strong>Dink</strong> from the RuneLite Plugin Hub.</li>
                    <li>Open <strong>Dink Settings → Advanced</strong>.</li>
                    <li>
                        Paste the dynamic config URL:
                        <button type="button" class="dink-setup-code" @click="copyUrl">
                            <code>{{ configUrl }}</code>
                            <span class="dink-setup-copy-hint">{{ copied ? 'Copied!' : 'Click to copy' }}</span>
                        </button>
                    </li>
                    <li>Set <strong>Import policy</strong> to <strong>Overwrite Webhooks</strong>.</li>
                    <li>Turn the Dink plugin <strong>off</strong>, then back <strong>on</strong>.</li>
                    <li>Close the settings panel using the <strong>'&lt;'</strong> back arrow.</li>
                </ol>

                <p class="dink-setup-note">
                    ⚠ Manually changing Dink settings afterward may cause your actions to be tracked
                    incorrectly.
                </p>

                <div v-if="forced" class="dink-setup-footer">
                    <button type="button" class="dink-setup-done" @click="close">I've done it!</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import '@/assets/dinkSetupModal.css'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { BASE_URL } from '@/api/client'

const SEEN_KEY = 'bb:dink-guide-seen'

const configUrl = `${BASE_URL}/config`
const open = ref(false)
/** true only when auto-shown on first visit: dismissable by button / ✕ only */
const forced = ref(false)
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

function markSeen() {
    try {
        localStorage.setItem(SEEN_KEY, '1')
    } catch {
        /* private mode / storage disabled — just show it every load */
    }
}

function close() {
    open.value = false
    forced.value = false
    markSeen()
}

function onBackdrop() {
    if (!forced.value) close()
}

function copyUrl() {
    navigator.clipboard.writeText(configUrl).then(() => {
        copied.value = true
        clearTimeout(copyTimer)
        copyTimer = setTimeout(() => (copied.value = false), 2000)
    })
}

function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !forced.value) close()
}

watch(open, (isOpen) => {
    if (isOpen) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
})

onMounted(() => {
    let seen = false
    try {
        seen = localStorage.getItem(SEEN_KEY) === '1'
    } catch {
        seen = false
    }
    if (!seen) {
        open.value = true
        forced.value = true
    }
})

onUnmounted(() => {
    window.removeEventListener('keydown', onKey)
    clearTimeout(copyTimer)
})
</script>
