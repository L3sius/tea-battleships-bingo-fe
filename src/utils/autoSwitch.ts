import { ref, watch } from 'vue'

const KEY = 'bb:auto-switch'

function read(): boolean {
    try {
        return localStorage.getItem(KEY) !== '0'
    } catch {
        return true
    }
}

/** Jump to the attacking team's board when someone fires. On unless turned off. */
export const autoSwitch = ref(read())

watch(autoSwitch, (on) => {
    try {
        localStorage.setItem(KEY, on ? '1' : '0')
    } catch {
        // best-effort — a blocked localStorage just means it resets per visit
    }
})
