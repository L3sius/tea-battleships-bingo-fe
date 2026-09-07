// A dropped-in sound effect is a nice-to-have — never let a missing file or a
// blocked autoplay attempt break an attack animation. Always fire-and-forget.
export function playSound(path: string) {
    try {
        const audio = new Audio(path)
        audio.play().catch(() => {
            // Autoplay can still be refused in some contexts; ignore silently.
        })
    } catch {
        // Ignore — construction itself can throw in unsupported environments.
    }
}
