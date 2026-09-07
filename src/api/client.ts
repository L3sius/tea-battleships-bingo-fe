import type {
    ApiErrorBody,
    FireRequest,
    FireResponse,
    GetBoardResponse,
    GetBonusBoardResponse,
    GetShipStatusResponse,
    GetShotsResponse,
    GetTeamsResponse,
} from './types'

export const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const FIRE_API_KEY = import.meta.env.VITE_FIRE_API_KEY

async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) {
        throw new Error(await extractError(res))
    }
    return res.json() as Promise<T>
}

async function extractError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as ApiErrorBody
        if (body?.error) return body.error
    } catch {
        // response wasn't JSON — fall through to the generic message
    }
    return `Request failed (${res.status})`
}

export function getTeams() {
    return apiGet<GetTeamsResponse>('/getTeams')
}

export function getBoard() {
    return apiGet<GetBoardResponse>('/getBoard')
}

export function getShipStatus() {
    return apiGet<GetShipStatusResponse>('/getShipStatus')
}

export function getBonusBoard() {
    return apiGet<GetBonusBoardResponse>('/getBonusBoard')
}

export function getShots() {
    return apiGet<GetShotsResponse>('/getShots')
}

export async function fire(request: FireRequest): Promise<FireResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (FIRE_API_KEY) headers['X-Api-Key'] = FIRE_API_KEY

    const res = await fetch(`${BASE_URL}/fire`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    })
    if (!res.ok) {
        throw new Error(await extractError(res))
    }
    return res.json() as Promise<FireResponse>
}

type SSEListeners = Record<string, (ev: MessageEvent) => void>

/**
 * Opens an EventSource with exponential backoff reconnection (the browser's
 * built-in retry is a fixed short interval; this avoids hammering the server
 * if it's down for a while). Returns a function that permanently closes it.
 */
export function connectSSE(path: string, listeners: SSEListeners): () => void {
    let es: EventSource | null = null
    let stopped = false
    let delay = 1000
    const maxDelay = 30000

    function open() {
        if (stopped) return
        es = new EventSource(`${BASE_URL}${path}`)
        for (const [name, handler] of Object.entries(listeners)) {
            es.addEventListener(name, handler)
        }
        es.onopen = () => {
            delay = 1000
        }
        es.onerror = () => {
            es?.close()
            if (stopped) return
            setTimeout(open, delay)
            delay = Math.min(delay * 2, maxDelay)
        }
    }

    open()

    return () => {
        stopped = true
        es?.close()
    }
}

export function connectActionStream(listeners: SSEListeners): () => void {
    return connectSSE('/getActionStream', listeners)
}

export function connectGameStream(listeners: SSEListeners): () => void {
    return connectSSE('/getGameStream', listeners)
}
