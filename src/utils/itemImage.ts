/**
 * The backend sends a full external wiki URL for a task's image. We keep a
 * local mirror of the common ones (see scripts/sync-item-images.mjs) for
 * speed and to not depend on the wiki's uptime — this just guesses the local
 * path from that URL's filename; the caller falls back to the original
 * remote URL via the <img> element's error handler if we don't have it yet.
 */
export function localItemImagePath(imageUrl: string): string | null {
    try {
        const { pathname } = new URL(imageUrl)
        const filename = decodeURIComponent(pathname.split('/').pop() ?? '')
        return filename ? `/images/items/${filename}` : null
    } catch {
        return null
    }
}
