const PALETTE = ['#4a9eff', '#ff4a4a', '#e0a83c', '#5cb85c', '#b478e0', '#4ad0c9']

/**
 * The API doesn't return a color per team, so we assign one deterministically
 * by each team's position in the (stable-ordered) teams list.
 */
export function teamColor(teams: { id: number }[], teamId: number): string {
    const index = teams.findIndex((t) => t.id === teamId)
    return PALETTE[index >= 0 ? index % PALETTE.length : 0]!
}
