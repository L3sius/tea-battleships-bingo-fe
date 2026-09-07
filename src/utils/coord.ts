export interface RowCol {
    row: number
    col: number
}

/** Parses a board coordinate like "C4" or "j10" into 0-indexed {row, col}. */
export function parseCoord(coord: string): RowCol {
    const match = coord.trim().toUpperCase().match(/^([A-Z])(\d{1,2})$/)
    if (!match) throw new Error(`Invalid coordinate: ${coord}`)
    const [, letter, number] = match
    return {
        col: letter!.charCodeAt(0) - 65,
        row: Number(number) - 1,
    }
}

export function formatCoord(row: number, col: number): string {
    return `${String.fromCharCode(65 + col)}${row + 1}`
}
