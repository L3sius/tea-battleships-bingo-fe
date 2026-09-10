import { ref } from 'vue'
import * as api from '@/api/client'
import type { ActionMessage, BonusTask, GameStreamEvent, GetBoardResponse, ShipStatusTeam, Shot, Team } from '@/api/types'

const teams = ref<Team[]>([])
const board = ref<GetBoardResponse | null>(null)
const shipStatusTeams = ref<ShipStatusTeam[]>([])
const bonusTasks = ref<BonusTask[]>([])
const shots = ref<Shot[]>([])
const liveMessages = ref<ActionMessage[]>([])
const errorMessage = ref<string | null>(null)
const connected = ref(false)

const MAX_LIVE_MESSAGES = 100

let started = false

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
        await Promise.all([refreshBoard(), refreshShipStatus(), refreshShots()])
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
        fireAt,
        refreshBoard,
    }
}
