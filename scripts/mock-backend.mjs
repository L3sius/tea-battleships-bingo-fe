// Local mock of the battleships backend, for playing with the board and the
// attack animations without touching prod. It serves the same HTTP API and SSE
// streams the frontend uses; state lives in memory and resets on restart.
//
//   npm run mock      → http://localhost:3999
//   GET /cheat        → where every ship is, to sink one on purpose
//   GET /reset        → a fresh board and fleets (then reload the page)
import http from 'node:http'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.MOCK_PORT ?? 3999)
const SIZE = 10

const TEAMS = [
    { id: 1, name: 'Salty Barnacles', players: [{ name: 'Zezima', alts: ['Zezima Jr'] }, { name: 'Torvesta', alts: [] }] },
    { id: 2, name: 'Drunken Sailors', players: [{ name: 'Woox', alts: [] }, { name: 'B0aty', alts: [] }] },
]

// Mirrors the backend's config/battleships.toml fleet, with the hull art in public/images/ships.
const FLEET = [
    ['dingy_1', 'Dingy', 1, 'dingy-1.png'],
    ['dingy_2', 'Dingy', 1, 'dingy-2.png'],
    ['speedboat_1', 'Speedboat', 2, 'speedboat-1.png'],
    ['speedboat_2', 'Speedboat', 2, 'speedboat-2.png'],
    ['speedboat_3', 'Speedboat', 2, 'speedboat-3.png'],
    ['submarine_1', 'Submarine', 3, 'submarine-1.png'],
    ['submarine_2', 'Submarine', 3, 'submarine-2.png'],
    ['submarine_3', 'Submarine', 3, 'submarine-3.png'],
    ['destroyer_1', 'Destroyer', 3, 'destroyer-1.png'],
    ['destroyer_2', 'Destroyer', 3, 'destroyer-2.png'],
    ['destroyer_3', 'Destroyer', 3, 'destroyer-3.png'],
    ['battleship_1', 'Battleship', 4, 'battleship-1.png'],
    ['battleship_2', 'Battleship', 4, 'battleship-2.png'],
    ['carrier_1', 'Carrier', 5, 'carrier-1.png'],
    ['cargo_ship_1', 'Cargo ship', 7, 'cargo-ship-1.png'],
].map(([key, displayName, length, image]) => ({ key, displayName, length, image }))

const coordOf = (row, col) => String.fromCharCode(65 + col) + (row + 1)
const ALL_COORDS = Array.from({ length: SIZE * SIZE }, (_, i) => coordOf(Math.floor(i / SIZE), i % SIZE))

// Real task art: one tile per mirrored item image (repeating once they run out).
const ITEMS = readdirSync(fileURLToPath(new URL('../public/images/items/', import.meta.url))).filter((f) => f.endsWith('.png'))
const TASKS = ALL_COORDS.map((_, i) => {
    const file = ITEMS[i % ITEMS.length]
    const name = file.slice(0, -4).replace(/_/g, ' ')
    return {
        id: i + 1,
        name,
        description: `Get a ${name}`,
        category: 'loot',
        type: 'item',
        difficulty: 1 + (i % 5),
        imageUrl: `https://oldschool.runescape.wiki/images/${file}`,
    }
})

/** Random, non-overlapping placement (hulls may touch, as in the real game). */
function placeFleet() {
    const longestFirst = [...FLEET].sort((a, b) => b.length - a.length)
    for (let attempt = 0; attempt < 500; attempt++) {
        const taken = new Set()
        const ships = []
        for (const def of longestFirst) {
            let cells = null
            for (let tries = 0; tries < 300 && !cells; tries++) {
                const vertical = Math.random() < 0.5
                const r = Math.floor(Math.random() * (vertical ? SIZE - def.length + 1 : SIZE))
                const c = Math.floor(Math.random() * (vertical ? SIZE : SIZE - def.length + 1))
                const run = Array.from({ length: def.length }, (_, i) => (vertical ? coordOf(r + i, c) : coordOf(r, c + i)))
                if (!run.some((x) => taken.has(x))) cells = run
            }
            if (!cells) break
            for (const x of cells) taken.add(x)
            ships.push({ ...def, cells, hit: new Set() })
        }
        if (ships.length === FLEET.length) return ships
    }
    throw new Error('could not place the fleet')
}

const isSunk = (ship) => ship.hit.size === ship.length
const nowIso = () => new Date().toISOString()

// ── state ──
let state
const feedHistory = []
const actionClients = new Set()
const gameClients = new Set()

function sse(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** A live-feed line, in the backend's BingoAction shape (snake_case, unix seconds). */
function feed(ok, message) {
    const action = { timestamp: Math.floor(Date.now() / 1000), is_success_action: ok, message }
    feedHistory.push(action)
    if (feedHistory.length > 500) feedHistory.shift()
    for (const c of actionClients) sse(c, 'action', action)
}

function broadcast(update) {
    for (const c of gameClients) sse(c, 'update', update)
}

function resetState() {
    state = {
        tiles: Object.fromEntries(
            TEAMS.map((t) => [
                t.id,
                new Map(
                    ALL_COORDS.map((coord, i) => [
                        coord,
                        {
                            coord,
                            task: TASKS[i],
                            progress: 1,
                            target: 1,
                            completed: true,
                            completedAt: nowIso(),
                            completedBy: t.players[i % t.players.length].name,
                            fired: false,
                            firedAt: null,
                            incoming: null,
                        },
                    ]),
                ),
            ]),
        ),
        fleets: Object.fromEntries(TEAMS.map((t) => [t.id, placeFleet()])),
        shots: [],
        winner: null,
    }
    feedHistory.length = 0
    // Some activity in the backend's real message formats, so the feed isn't empty.
    feed(false, 'Zezima (Salty Barnacles) looted Death rune x60, Big bones from The Hueycoatl - no tile matched')
    feed(false, 'Woox (Drunken Sailors) killed Vorkath (KC 412, 58.3s) - no tile matched')
    feed(true, '[Zezima (Salty Barnacles)] completed A1: Get a Abyssal whip - looted Abyssal whip from Abyssal demon')
    feed(false, "B0aty (Drunken Sailors) completed the GRANDMASTER combat achievement 'Perfection of Crondis' - no tile matched")
    feed(true, "[Torvesta (Salty Barnacles)] unlocked bonus achievement 'The Pet Chaser' - Get any boss pet")
}

/** POST /fire — the same checks and outcome shape as the real backend. */
function fire({ teamId, coord, firedBy }) {
    const attacker = TEAMS.find((t) => t.id === teamId)
    if (!attacker) return [404, { error: `no team with id ${teamId}` }]
    if (state.winner) return [409, { error: `the game is over — ${state.winner} won. GET /reset for a new one` }]
    const target = TEAMS.find((t) => t.id !== teamId)
    const c = String(coord ?? '').toUpperCase()
    const tile = state.tiles[attacker.id].get(c)
    if (!tile) return [400, { error: `'${coord}' is not a coordinate on this board` }]
    if (!tile.completed) return [409, { error: `tile ${c} hasn't been completed` }]
    if (tile.fired) return [409, { error: `a shot has already been fired from ${c}` }]

    const ship = state.fleets[target.id].find((s) => s.cells.includes(c))
    let result = 'miss'
    let sunkShipKey = null
    if (ship) {
        ship.hit.add(c)
        result = isSunk(ship) ? 'sunk' : 'hit'
        if (result === 'sunk') sunkShipKey = ship.key
    }
    const firedAt = nowIso()
    const animationSeed = Math.floor(Math.random() * 2 ** 32)
    tile.fired = true
    tile.firedAt = firedAt
    state.tiles[target.id].get(c).incoming = { result, sunkShipKey, firedAt, animationSeed }
    state.shots.push({ attackerTeamId: attacker.id, targetTeamId: target.id, coord: c, result, sunkShipKey, firedBy: firedBy ?? 'frontend', firedAt, animationSeed })
    const gameWon = result === 'sunk' && state.fleets[target.id].every(isSunk)

    const line =
        result === 'sunk'
            ? `${attacker.name} fired at ${c} and SANK ${target.name}'s ${sunkShipKey}!`
            : `${attacker.name} fired at ${c} on ${target.name}'s board... ${result === 'hit' ? 'HIT' : 'miss'}!`
    feed(result !== 'miss', line)
    broadcast({ event: 'shot_fired', attackerTeamId: attacker.id, targetTeamId: target.id, coord: c, result, sunkShipKey, firedBy: firedBy ?? 'frontend', animationSeed })
    if (gameWon) {
        state.winner = attacker.name
        feed(true, `${attacker.name} has sunk the entire enemy fleet. ${attacker.name} WINS!`)
        broadcast({ event: 'game_won', winnerTeamId: attacker.id, winnerTeamName: attacker.name })
    }
    console.log(`  ${attacker.name} → ${c}: ${result}${sunkShipKey ? ` (${sunkShipKey})` : ''}${gameWon ? '  — GAME WON' : ''}`)
    return [200, { attackerTeamId: attacker.id, attackerTeamName: attacker.name, targetTeamId: target.id, targetTeamName: target.name, coord: c, result, sunkShipKey, gameWon, animationSeed }]
}

// ── read models ──
const routes = {
    '/health': () => ({ success: true, message: 'mock backend is running' }),
    '/getTeams': () => ({ teams: TEAMS }),
    '/getBoard': () => ({
        boardSize: SIZE,
        layoutGenerated: true,
        teams: TEAMS.map((t) => ({ teamId: t.id, teamName: t.name, locked: true, tiles: [...state.tiles[t.id].values()] })),
    }),
    // Like the real API: afloat/sunk only, never how damaged a ship is.
    '/getShipStatus': () => ({
        teams: TEAMS.map((t) => {
            const fleet = state.fleets[t.id]
            return {
                teamId: t.id,
                teamName: t.name,
                locked: true,
                fleetDestroyed: fleet.every(isSunk),
                ships: FLEET.map((def) => ({ key: def.key, displayName: def.displayName, length: def.length, sunk: isSunk(fleet.find((s) => s.key === def.key)), image: def.image })),
            }
        }),
    }),
    '/getBonusBoard': () => ({
        tasks: [
            { id: 1, revealed: false },
            { id: 2, revealed: true, title: 'The Pet Chaser', caption: 'Now you need to add "-cho" to your name.', description: 'Get any boss pet', completedBy: 'Torvesta', teamId: 1, teamName: 'Salty Barnacles', completedAt: nowIso() },
            { id: 3, revealed: false },
            { id: 4, revealed: false },
            { id: 5, revealed: false },
        ],
    }),
    '/getShots': () => ({ shots: state.shots }),
    '/cheat': () =>
        Object.fromEntries(
            TEAMS.map((t) => {
                const shooter = TEAMS.find((o) => o.id !== t.id)
                return [
                    `${t.name}'s fleet — hit it by firing from ${shooter.name}'s board`,
                    Object.fromEntries(state.fleets[t.id].map((s) => [s.key, { cells: s.cells.join(' '), hit: [...s.hit].join(' ') || '—', sunk: isSunk(s) }])),
                ]
            }),
        ),
}

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
}

function readJson(req) {
    return new Promise((resolve) => {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'))
            } catch {
                resolve({})
            }
        })
    })
}

function openStream(req, res, clients, greet) {
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    greet(res)
    clients.add(res)
    const ping = setInterval(() => res.write(': keep-alive\n\n'), 15000)
    req.on('close', () => {
        clearInterval(ping)
        clients.delete(res)
    })
}

resetState()

http
    .createServer(async (req, res) => {
        const { pathname } = new URL(req.url ?? '/', 'http://localhost')
        const reply = (status, body) => {
            res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' })
            res.end(JSON.stringify(body, null, pathname === '/cheat' ? 2 : 0))
        }
        if (req.method === 'OPTIONS') {
            res.writeHead(204, CORS)
            return res.end()
        }
        if (pathname === '/fire' && req.method === 'POST') return reply(...fire(await readJson(req)))
        if (pathname === '/reset') {
            resetState()
            console.log('  board reset — reload the page')
            return reply(200, { reset: true, note: 'Fresh board and fleets. Reload the page.' })
        }
        if (pathname === '/getActionStream') {
            return openStream(req, res, actionClients, (r) => {
                for (const a of feedHistory) sse(r, 'history', a)
                sse(r, 'history_complete', {})
            })
        }
        if (pathname === '/getGameStream') return openStream(req, res, gameClients, (r) => sse(r, 'connected', {}))
        if (routes[pathname]) return reply(200, routes[pathname]())
        reply(404, { error: `no route ${pathname}` })
    })
    .listen(PORT, () => {
        console.log(`Mock battleships backend on http://localhost:${PORT}`)
        console.log(`  every tile is ready to fire; ${FLEET.length} hulls per team, placed at random`)
        console.log(`  GET /cheat for ship positions · GET /reset for a fresh board`)
    })
