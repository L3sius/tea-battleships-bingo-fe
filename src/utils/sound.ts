// A dropped-in sound effect is a nice-to-have — never let a missing file or a
// blocked autoplay attempt break an attack animation. Always fire-and-forget.

import { readonly, ref, watch } from 'vue'

const VOLUME_KEY = 'bb:sfx-volume'
const PREMUTE_KEY = 'bb:sfx-premute' // level to restore when un-muting

function clamp01(n: number) {
    return Math.min(1, Math.max(0, n))
}

function readStoredVolume(): number {
    try {
        const raw = localStorage.getItem(VOLUME_KEY)
        if (raw !== null) {
            const n = Number(raw)
            if (Number.isFinite(n)) return clamp01(n)
        }
    } catch {
        // localStorage can be unavailable (private mode, etc.) — fall through.
    }
    return 1
}

// 0–1 multiplier applied to every attack sound played through playSound().
// Persisted so the choice survives a reload, same as the selected team.
const volume = ref(readStoredVolume())

watch(volume, (v) => {
    try {
        localStorage.setItem(VOLUME_KEY, String(v))
    } catch {
        // Persisting is best-effort only.
    }
})

/** Reactive, read-only view of the master volume (0–1). */
export function useMasterVolume() {
    return readonly(volume)
}

export function getMasterVolume() {
    return volume.value
}

export function setMasterVolume(v: number) {
    volume.value = clamp01(v)
}

export function isMuted() {
    return volume.value === 0
}

/** Mute drops to 0 and remembers the level; un-mute restores it. */
export function toggleMute() {
    if (volume.value > 0) {
        try {
            localStorage.setItem(PREMUTE_KEY, String(volume.value))
        } catch {
            // best-effort
        }
        volume.value = 0
        return
    }
    let restore = 0.8
    try {
        const raw = localStorage.getItem(PREMUTE_KEY)
        const n = raw === null ? NaN : Number(raw)
        if (Number.isFinite(n) && n > 0) restore = clamp01(n)
    } catch {
        // best-effort
    }
    volume.value = restore
}

export function playSound(path: string) {
    try {
        if (volume.value === 0) return
        const audio = new Audio(path)
        audio.volume = volume.value
        audio.play().catch(() => {
            // Autoplay can still be refused in some contexts; ignore silently.
        })
    } catch {
        // Ignore — construction itself can throw in unsupported environments.
    }
}
