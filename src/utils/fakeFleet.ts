// Dev-only helper: the real API never sends ship positions (by design — see
// the integration spec), so this generates a plausible-looking but entirely
// fake layout purely for visual/layout QA. Never used against real data.

export interface FakeShipPlacement {
    key: string
    displayName: string
    length: number
    orientation: 'horizontal' | 'vertical'
    cells: [number, number][]
}

const FLEET = [
    { key: 'carrier', displayName: 'Carrier', length: 5 },
    { key: 'battleship', displayName: 'Battleship', length: 4 },
    { key: 'cruiser', displayName: 'Cruiser', length: 3 },
    { key: 'submarine', displayName: 'Submarine', length: 3 },
    { key: 'destroyer', displayName: 'Destroyer', length: 2 },
]

export function generateFakeFleet(boardSize = 10): FakeShipPlacement[] {
    const occupied = new Set<string>()
    const placements: FakeShipPlacement[] = []

    for (const ship of FLEET) {
        let attempts = 0
        while (attempts < 500) {
            attempts++
            const orientation: 'horizontal' | 'vertical' = Math.random() < 0.5 ? 'horizontal' : 'vertical'
            const maxRow = orientation === 'vertical' ? boardSize - ship.length : boardSize - 1
            const maxCol = orientation === 'horizontal' ? boardSize - ship.length : boardSize - 1
            const startRow = Math.floor(Math.random() * (maxRow + 1))
            const startCol = Math.floor(Math.random() * (maxCol + 1))
            const cells: [number, number][] = Array.from({ length: ship.length }, (_, i) =>
                orientation === 'horizontal' ? [startRow, startCol + i] : [startRow + i, startCol],
            )

            if (cells.every(([r, c]) => !occupied.has(`${r},${c}`))) {
                cells.forEach(([r, c]) => occupied.add(`${r},${c}`))
                placements.push({ key: ship.key, displayName: ship.displayName, length: ship.length, orientation, cells })
                break
            }
        }
    }

    return placements
}
