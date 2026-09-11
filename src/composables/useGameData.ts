import { ref } from 'vue'
import * as api from '@/api/client'
import { playSound } from '@/utils/sound'
import type {
    ActionMessage,
    BonusTask,
    GameStreamEvent,
    GetBoardResponse,
    ShipStatusTeam,
    Shot,
    ShotResult,
    Team,
} from '@/api/types'

/**
 * How long every client holds a fired shot before showing it. The backend
 * broadcasts shot_fired the moment /fire resolves, so this window starts at the
 * same instant everywhere — giving people time to switch to the attacking
 * team's board and watch it land.
 */
export const ATTACK_WARNING_MS = 9000

/** A shot that has been fired but whose animation is still counting down. */
export interface PendingAttack {
    attackerTeamId: number
    targetTeamId: number
    coord: string
}

/** A shot someone (possibly another client) just fired, for replaying its animation. */
export interface ShotFiredSignal {
    attackerTeamId: number
    targetTeamId: number
    coord: string
    result: ShotResult
    sunkShipKey: string | null
    animationSeed: number
}

const teams = ref<Team[]>([])
const board = ref<GetBoardResponse | null>(null)
const shipStatusTeams = ref<ShipStatusTeam[]>([])
const bonusTasks = ref<BonusTask[]>([])
const shots = ref<Shot[]>([])
const liveMessages = ref<ActionMessage[]>([])
const errorMessage = ref<string | null>(null)
const connected = ref(false)
// Reassigned on every shot_fired game event (from any client), but only once the
// warning window has elapsed. Components watch its identity to replay the attack
// animation in sync across all viewers.
const lastShotFired = ref<ShotFiredSignal | null>(null)
// Shots inside their warning window right now — drives the blinking fleet card.
const pendingAttacks = ref<PendingAttack[]>([])

// Twice the backend's ACTION_QUEUE_SIZE (500): a reload replays the server's 500,
// and a tab left open keeps accumulating live lines up to this before trimming.
export const MAX_LIVE_MESSAGES = 1000

let started = false
// `${attackerTeamId}:${coord}` for shots already announced, so a shot never
// opens two warning windows (a coord can only be fired once).
const announced = new Set<string>()

function reportError(err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
}

async function refreshTeams() {
    teams.value = (await api.getTeams()).teams
}

async function refreshBoard() {
    board.value = await api.getBoard()
}

async function refreshShipStatus() {
    shipStatusTeams.value = (await api.getShipStatus()).teams
}

async function refreshBonusBoard() {
    bonusTasks.value = (await api.getBonusBoard()).tasks
}

async function refreshShots() {
    shots.value = (await api.getShots()).shots
}

function handleGameEvent(evt: GameStreamEvent) {
    switch (evt.event) {
        case 'tile_progress':
        case 'tile_completed':
        case 'board_locked':
            refreshBoard().catch(reportError)
            break
        case 'shot_fired':
            announceAttack({
                attackerTeamId: evt.attackerTeamId,
                targetTeamId: evt.targetTeamId,
                coord: evt.coord,
                result: evt.result,
                sunkShipKey: evt.sunkShipKey,
                animationSeed: evt.animationSeed,
            })
            break
        case 'game_won':
            refreshBoard().catch(reportError)
            refreshShipStatus().catch(reportError)
            refreshShots().catch(reportError)
            break
        case 'bonus_completed':
            refreshBonusBoard().catch(reportError)
            break
    }
}

/**
 * Opens the warning window for a shot: siren + blinking card now, animation and
 * refreshed board data once it closes. Refreshes are held back too — landing
 * them early would pop the hit marker on the board before the shell arrives.
 */
function announceAttack(shot: ShotFiredSignal) {
    const key = `${shot.attackerTeamId}:${shot.coord}`
    if (announced.has(key)) return
    announced.add(key)

    pendingAttacks.value.push({
        attackerTeamId: shot.attackerTeamId,
        targetTeamId: shot.targetTeamId,
        coord: shot.coord,
    })
    playSound('/sounds/attack_incoming.mp3')

    setTimeout(() => {
        pendingAttacks.value = pendingAttacks.value.filter(
            (a) => !(a.attackerTeamId === shot.attackerTeamId && a.coord === shot.coord),
        )
        lastShotFired.value = shot
        refreshBoard().catch(reportError)
        refreshShipStatus().catch(reportError)
        refreshShots().catch(reportError)
    }, ATTACK_WARNING_MS)
}

let nextMessageId = 0

// The /getActionStream frames don't quite match the rest of the API: the
// backend's BingoAction is serialized snake_case (`is_success_action`) and its
// `timestamp` is a Unix seconds integer, not a date string. Normalize both here
// so the rest of the app sees a clean ActionMessage regardless.
function toActionMessage(raw: Record<string, unknown>): ActionMessage {
    const ts = raw.timestamp
    let timestamp = ''
    if (typeof ts === 'number') {
        timestamp = new Date(ts < 1e12 ? ts * 1000 : ts).toISOString()
    } else if (typeof ts === 'string') {
        timestamp = ts
    }
    return {
        id: nextMessageId++,
        message: typeof raw.message === 'string' ? raw.message : '',
        isSuccessAction: (raw.isSuccessAction ?? raw.is_success_action ?? true) === true,
        timestamp,
    }
}

// Always prepend, for both the history backlog (streamed oldest-first) and live
// frames — so liveMessages stays strictly newest-first and same-second events
// keep their arrival order. The stale tail is trimmed off the end.
function pushLiveMessage(message: ActionMessage) {
    liveMessages.value.unshift(message)
    if (liveMessages.value.length > MAX_LIVE_MESSAGES) {
        liveMessages.value.length = MAX_LIVE_MESSAGES
    }
}

function start() {
    if (started) return
    started = true

    refreshTeams().catch(reportError)
    refreshBoard().catch(reportError)
    refreshShipStatus().catch(reportError)
    refreshBonusBoard().catch(reportError)
    refreshShots().catch(reportError)

    api.connectActionStream({
        history: (ev) => pushLiveMessage(toActionMessage(JSON.parse(ev.data))),
        history_complete: () => {
            connected.value = true
        },
        action: (ev) => pushLiveMessage(toActionMessage(JSON.parse(ev.data))),
    })

    api.connectGameStream({
        connected: () => {},
        update: (ev) => handleGameEvent(JSON.parse(ev.data) as GameStreamEvent),
    })
}

async function fireAt(teamId: number, coord: string, firedBy?: string) {
    try {
        const result = await api.fire({ teamId, coord, firedBy })
        // Open the window locally too, in case our own game stream is lagging —
        // `announced` keeps this and the shot_fired echo from doubling up.
        announceAttack({
            attackerTeamId: result.attackerTeamId,
            targetTeamId: result.targetTeamId,
            coord: result.coord,
            result: result.result,
            sunkShipKey: result.sunkShipKey,
            animationSeed: result.animationSeed,
        })
        return result
    } catch (err) {
        reportError(err)
        throw err
    }
}

export function useGameData() {
    start()
    return {
        teams,
        board,
        shipStatusTeams,
        bonusTasks,
        shots,
        liveMessages,
        errorMessage,
        connected,
        lastShotFired,
        pendingAttacks,
        fireAt,
        refreshBoard,
    }
}
