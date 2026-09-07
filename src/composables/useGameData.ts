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

function pushLiveMessage(message: ActionMessage, atStart: boolean) {
    if (atStart) {
        liveMessages.value.unshift(message)
    } else {
        liveMessages.value.push(message)
    }
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
        history: (ev) => pushLiveMessage(JSON.parse(ev.data) as ActionMessage, false),
        history_complete: () => {
            connected.value = true
        },
        action: (ev) => pushLiveMessage(JSON.parse(ev.data) as ActionMessage, true),
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
