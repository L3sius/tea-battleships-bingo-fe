export interface Player {
    name: string
    alts: string[]
}

export interface Team {
    id: number
    name: string
    players: Player[]
}

export interface GetTeamsResponse {
    teams: Team[]
}

export interface Task {
    id: number
    name: string
    description: string
    category: string
    type: string
    difficulty: number
    imageUrl: string | null
}

export type ShotResult = 'hit' | 'miss' | 'sunk'

export interface IncomingShot {
    result: ShotResult
    sunkShipKey: string | null
    firedAt: string
    /** Backend-chosen seed; every client resolves it to the same attack animation. */
    animationSeed: number
}

export interface BoardTile {
    coord: string
    task: Task | null
    progress: number
    target: number
    completed: boolean
    completedAt: string | null
    completedBy: string | null
    fired: boolean
    firedAt: string | null
    incoming: IncomingShot | null
}

export interface BoardTeam {
    teamId: number
    teamName: string
    locked: boolean
    tiles: BoardTile[]
}

export interface GetBoardResponse {
    boardSize: number
    layoutGenerated: boolean
    teams: BoardTeam[]
}

export interface ShipStatusShip {
    key: string
    displayName: string
    length: number
    hits: number
    sunk: boolean
}

export interface ShipStatusTeam {
    teamId: number
    teamName: string
    locked: boolean
    fleetDestroyed: boolean
    ships: ShipStatusShip[]
}

export interface GetShipStatusResponse {
    teams: ShipStatusTeam[]
}

export interface BonusCompletion {
    teamId: number
    teamName: string
    completedBy: string
    completedAt: string
}

export interface BonusTask {
    id: number
    revealed: boolean
    title?: string
    caption?: string
    description?: string
    completions?: BonusCompletion[]
}

export interface GetBonusBoardResponse {
    tasks: BonusTask[]
}

export interface Shot {
    attackerTeamId: number
    targetTeamId: number
    coord: string
    result: ShotResult
    sunkShipKey: string | null
    /** Every cell of the ship, present only once it's fully sunk. */
    sunkShipCells?: string[]
    firedBy: string | null
    firedAt: string
    /** Backend-chosen seed; every client resolves it to the same attack animation. */
    animationSeed: number
}

export interface GetShotsResponse {
    shots: Shot[]
}

export interface FireRequest {
    teamId: number
    coord: string
    firedBy?: string
}

export interface FireResponse {
    attackerTeamId: number
    attackerTeamName: string
    targetTeamId: number
    targetTeamName: string
    coord: string
    result: 'miss' | 'hit' | 'sunk'
    sunkShipKey: string | null
    gameWon: boolean
    /** Backend-chosen seed; every client resolves it to the same attack animation. */
    animationSeed: number
}

export interface ApiErrorBody {
    error: string
}

export interface ActionMessage {
    timestamp: string
    isSuccessAction: boolean
    message: string
}

export type GameStreamEvent =
    | { event: 'tile_progress'; teamId: number; coord: string; progress: number; target: number }
    | { event: 'tile_completed'; teamId: number; teamName: string; coord: string; taskName: string; completedBy: string }
    | {
          event: 'shot_fired'
          attackerTeamId: number
          targetTeamId: number
          coord: string
          result: ShotResult
          sunkShipKey: string | null
          firedBy: string
          /** Backend-chosen seed; every client resolves it to the same attack animation. */
          animationSeed: number
      }
    | {
          event: 'bonus_completed'
          taskId: number
          title: string
          caption: string
          description: string
          teamId: number
          teamName: string
          completedBy: string
          newlyRevealed: boolean
      }
    | { event: 'board_locked'; teamId: number; teamName: string; locked: boolean }
    | { event: 'game_won'; winnerTeamId: number; winnerTeamName: string }
