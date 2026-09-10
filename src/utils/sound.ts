// A dropped-in sound effect is a nice-to-have — never let a missing file or a
// blocked autoplay attempt break an attack animation. Always fire-and-forget.

const VOLUME_KEY = 'bb:sfx-volume'

function readStoredVolume(): number {
    try {
        const raw = localStorage.getItem(VOLUME_KEY)
        if (raw !== null) {
            const n = Number(raw)
            if (Number.isFinite(n)) return Math.min(1, Math.max(0, n))
        }
    } catch {
        // localStorage can be unavailable (private mode, etc.) — fall through.
    }
    return 1
}

let masterVolume = readStoredVolume()

/** 0–1 multiplier applied to every attack sound played through playSound().
 *  Wired to the dev volume control in HomeView for now. */
export function getMasterVolume() {
    return masterVolume
}

export function setMasterVolume(v: number) {
    masterVolume = Math.min(1, Math.max(0, v))
    try {
        localStorage.setItem(VOLUME_KEY, String(masterVolume))
    } catch {
        // Persisting is best-effort only.
    }
}


export function playSound(path: string) {
    try {
        if (masterVolume === 0) return
        const audio = new Audio(path)
        audio.volume = masterVolume
        audio.play().catch(() => {
            // Autoplay can still be refused in some contexts; ignore silently.
        })
    } catch {
        // Ignore — construction itself can throw in unsupported environments.
    }
}
