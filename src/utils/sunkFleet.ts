// The API never sends a sunk ship's cell list. What it gives is one damage mark
// per cell plus, on the one cell whose hit finished a ship, that ship's key.
// Reconstructing the hull outline is therefore an exact-fit puzzle: every hull
// is a straight run of its known length, made entirely of damaged cells, that
// contains its anchor and overlaps no other hull.
//
// A greedy pass isn't enough — hulls sit flush against each other, so an anchor
// usually has several runs that look valid in isolation and only one that lets
// its neighbours fit too. Hence the backtracking search below.

import type { ShipStatusShip } from '@/api/types'
import { formatCoord, parseCoord } from '@/utils/coord'

/** One cell known to hold an enemy hull, and the hull it finished off (if any). */
export interface DamageMark {
    coord: string
    sunkShipKey: string | null
}

export interface SunkShipPlacement {
    key: string
    image: string | null
    cells: string[]
    /** Top-left cell of the run, for grid placement. */
    row: number
    col: number
    length: number
    orientation: 'horizontal' | 'vertical'
}

interface Anchor {
    key: string
    image: string | null
    coord: string
    length: number
    runs: string[][]
}

/**
 * Every straight run of `length` damaged cells that contains `coord`.
 * Ordered so runs with the anchor at an end come first — the finishing hit
 * tends to land on a hull's tip, so this reaches a solution sooner.
 */
function candidateRuns(coord: string, length: number, damaged: Set<string>, boardSize: number): string[][] {
    if (length <= 1) return [[coord]]
    const { row, col } = parseCoord(coord)
    const runs: string[][] = []
    // offset = where the anchor sits within the run; ends first, then inward.
    const offsets = [length - 1, 0, ...Array.from({ length: length - 2 }, (_, i) => i + 1)]
    for (const [dr, dc] of [
        [1, 0],
        [0, 1],
    ] as const) {
        for (const offset of offsets) {
            const startRow = row - dr * offset
            const startCol = col - dc * offset
            const endRow = startRow + dr * (length - 1)
            const endCol = startCol + dc * (length - 1)
            if (startRow < 0 || startCol < 0 || endRow >= boardSize || endCol >= boardSize) continue
            const cells: string[] = []
            for (let i = 0; i < length; i++) cells.push(formatCoord(startRow + dr * i, startCol + dc * i))
            if (cells.every((c) => damaged.has(c))) runs.push(cells)
        }
    }
    return runs
}

/** Depth-first assignment; anchors are pre-sorted fewest-options-first. */
function solve(anchors: Anchor[], index: number, taken: Set<string>): string[][] | null {
    if (index === anchors.length) return []
    for (const run of anchors[index]!.runs) {
        if (run.some((c) => taken.has(c))) continue
        for (const c of run) taken.add(c)
        const rest = solve(anchors, index + 1, taken)
        for (const c of run) taken.delete(c)
        if (rest) return [run, ...rest]
    }
    return null
}

/**
 * Rebuilds the outline of every hull the attacker has sunk, from the cells they
 * landed damage on. Returns an empty list if the damage can't be resolved into a
 * consistent layout — better to draw nothing than to draw wrong hulls.
 */
export function reconstructSunkShips(
    damage: DamageMark[],
    fleet: ShipStatusShip[],
    boardSize: number,
    excludeCoords?: Set<string>,
): SunkShipPlacement[] {
    const damaged = new Set(damage.map((d) => d.coord))
    if (!damaged.size) return []

    const byKey = new Map(fleet.map((s) => [s.key, s]))
    const anchors: Anchor[] = []
    for (const mark of damage) {
        if (!mark.sunkShipKey) continue
        if (excludeCoords?.has(mark.coord)) continue
        const def = byKey.get(mark.sunkShipKey)
        if (!def) continue
        anchors.push({
            key: mark.sunkShipKey,
            image: def.image ?? null,
            coord: mark.coord,
            length: def.length,
            runs: candidateRuns(mark.coord, def.length, damaged, boardSize),
        })
    }
    if (!anchors.length) return []

    // Most-constrained first: an anchor with a single possible run pins cells
    // that immediately rule out options for its neighbours.
    anchors.sort((a, b) => a.runs.length - b.runs.length)

    const assigned = solve(anchors, 0, new Set())
    if (!assigned) return []

    return anchors.map((anchor, i) => {
        const cells = assigned[i]!
        const positions = cells.map(parseCoord)
        const rows = positions.map((p) => p.row)
        const cols = positions.map((p) => p.col)
        return {
            key: anchor.key,
            image: anchor.image,
            cells,
            row: Math.min(...rows),
            col: Math.min(...cols),
            length: cells.length,
            // A 1-cell hull has no meaningful orientation — leave its art unrotated.
            orientation: cells.length > 1 && new Set(rows).size === 1 ? 'horizontal' : 'vertical',
        }
    })
}
