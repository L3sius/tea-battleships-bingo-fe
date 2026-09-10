// The backend live feed sends one prose string per event. These are regular
// enough to tokenize on the frontend for styling — player names, team names,
// coords, bosses, loot, outcome tags. Anything that doesn't match a pattern
// falls through as plain text, so a reworded backend line still renders fine.

export type FeedKind =
    | 'loot'
    | 'kill'
    | 'slayer'
    | 'ca'
    | 'clue'
    | 'pet'
    | 'death'
    | 'completion'
    | 'progress'
    | 'bonus'
    | 'lock'
    | 'shot-hit'
    | 'shot-miss'
    | 'shot-sunk'
    | 'win'
    | 'system'
    | 'plain'

export type SegType = 'text' | 'player' | 'team' | 'coord' | 'boss' | 'loot' | 'emph' | 'outcome'

export interface LootLine {
    name: string
    qty: number
}

export interface FeedSeg {
    t: SegType
    v: string
    /** player segment: the team it belongs to (for colour + tooltip) */
    team?: string
    /** boss segment: extra tooltip text (e.g. kill count / time) */
    meta?: string
    /** outcome segment: colour tone */
    tone?: 'good' | 'bad' | 'muted'
    /** loot segment: the items in the drop, shown on hover */
    items?: LootLine[]
}

export interface ParsedFeed {
    kind: FeedKind
    segs: FeedSeg[]
}

const CO = '[A-Z](?:2[0-6]|1[0-9]|[1-9])' // board coordinate, up to Z26

/** a matched, non-optional capture group is always present */
const g = (m: RegExpMatchArray, i: number): string => m[i] as string

const txt = (v: string): FeedSeg => ({ t: 'text', v })
const plr = (v: string, team?: string): FeedSeg => ({ t: 'player', v, team })
const tm = (v: string): FeedSeg => ({ t: 'team', v })
const crd = (v: string): FeedSeg => ({ t: 'coord', v })
const bss = (v: string, meta?: string): FeedSeg => ({ t: 'boss', v, meta })
const loot = (items: LootLine[]): FeedSeg => ({ t: 'loot', v: 'loot', items })
const emp = (v: string): FeedSeg => ({ t: 'emph', v })
const out = (v: string, tone: FeedSeg['tone']): FeedSeg => ({ t: 'outcome', v, tone })

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "name (team)" → player+team; a bare "team" → team (force-complete lines) */
function parseWho(who: string): FeedSeg[] {
    const m = who.match(/^(.+?) \((.+?)\)$/)
    return m ? [plr(g(m, 1), g(m, 2))] : [tm(who)]
}

function summaryKind(s: string): FeedKind {
    if (s.startsWith('looted ')) return 'loot'
    if (s.startsWith('killed ')) return 'kill'
    if (s.includes('slayer task')) return 'slayer'
    if (s.includes('combat achievement')) return 'ca'
    if (s.includes('casket')) return 'clue'
    if (s.includes('pet')) return 'pet'
    if (s.startsWith('died')) return 'death'
    return 'plain'
}

/** the `event.summary()` half of a Dink line */
function parseSummary(s: string): FeedSeg[] {
    let m = s.match(/^looted (.+) from (.+)$/)
    if (m) {
        const items: LootLine[] = g(m, 1)
            .split(', ')
            .map((it) => {
                const q = it.match(/^(.+?) x(\d+)$/)
                return q ? { name: g(q, 1), qty: Number(g(q, 2)) } : { name: it, qty: 1 }
            })
        return [txt('got '), loot(items), txt(' from '), bss(g(m, 2))]
    }
    m = s.match(/^killed (.+?) \(KC (\d+)(?:, ([\d.]+)s)?\)$/)
    if (m) {
        const meta = `Kill count ${g(m, 2)}${m[3] ? ` · ${m[3]}s` : ''}`
        return [txt('killed '), bss(g(m, 1), meta), txt(' '), out(`KC ${g(m, 2)}`, 'muted')]
    }
    m = s.match(/^completed a (.+?) slayer task \((.+?)\)$/)
    if (m) return [txt('finished a '), bss(g(m, 1)), txt(' slayer task · '), emp(g(m, 2))]
    m = s.match(/^completed the (.+?) combat achievement '(.+?)'$/)
    if (m) return [txt('completed the '), emp(g(m, 1)), txt(' CA — '), emp(`‘${g(m, 2)}’`)]
    m = s.match(/^opened a (.+?) casket worth (.+?) gp$/)
    if (m) return [txt('opened a '), emp(g(m, 1)), txt(' casket '), out(`${g(m, 2)} gp`, 'good')]
    m = s.match(/^got the (.+?) pet!$/)
    if (m) return [txt('got the '), emp(g(m, 1)), txt(' pet '), out('PET', 'good')]
    m = s.match(/^got a duplicate (.+?) pet$/)
    if (m) return [txt('got a duplicate '), emp(g(m, 1)), txt(' pet')]
    return [txt(s)]
}

export function parseFeedLine(message: string, isSuccess: boolean): ParsedFeed {
    const msg = message.trim()
    let m: RegExpMatchArray | null

    // ── shot lines (team names, no parens) ──
    m = msg.match(new RegExp(`^(.+?) fired at (${CO}) on (.+?)'s board\\.\\.\\. (miss|HIT)!$`, 'i'))
    if (m) {
        const hit = g(m, 4).toLowerCase() === 'hit'
        return {
            kind: hit ? 'shot-hit' : 'shot-miss',
            segs: [tm(g(m, 1)), txt(' fired at '), crd(g(m, 2)), txt(' on '), tm(g(m, 3)), txt("'s board "), out(hit ? 'HIT' : 'MISS', hit ? 'bad' : 'muted')],
        }
    }
    m = msg.match(new RegExp(`^(.+?) fired at (${CO}) and SANK (.+?)'s (.+?)!$`))
    if (m) {
        return {
            kind: 'shot-sunk',
            segs: [tm(g(m, 1)), txt(' sank '), tm(g(m, 3)), txt("'s "), emp(cap(g(m, 4))), txt(' at '), crd(g(m, 2)), txt(' '), out('SUNK', 'bad')],
        }
    }
    m = msg.match(/^(.+?) has sunk the entire enemy fleet\. .+ WINS!$/)
    if (m) return { kind: 'win', segs: [tm(g(m, 1)), txt(' wiped out the enemy fleet — '), emp('WINS!')] }

    // ── bracketed: "[who] …" (completion / progress / bonus / force-complete) ──
    m = msg.match(/^\[(.+?)\] (.+)$/)
    if (m) {
        const who = parseWho(g(m, 1))
        const rest = g(m, 2)
        let r = rest.match(new RegExp(`^completed (${CO}): (.+?)(?: - (.+))?$`))
        if (r) {
            return {
                kind: 'completion',
                segs: [...who, txt(' completed '), crd(g(r, 1)), txt(' '), out('TILE', 'good'), txt(' — '), emp(g(r, 2)), ...(r[3] ? [txt(' · '), ...parseSummary(r[3])] : [])],
            }
        }
        r = rest.match(new RegExp(`^(${CO}) progress (\\d+)/(\\d+)(?: - (.+))?$`))
        if (r) {
            return {
                kind: 'progress',
                segs: [...who, txt(' '), crd(g(r, 1)), txt(' '), out(`${g(r, 2)}/${g(r, 3)}`, 'muted'), ...(r[4] ? [txt(' — '), ...parseSummary(r[4])] : [])],
            }
        }
        r = rest.match(/^unlocked bonus achievement '(.+?)'(?: - (.+))?$/)
        if (r) {
            return {
                kind: 'bonus',
                segs: [...who, txt(' unlocked '), emp(g(r, 1)), txt(' '), out('BONUS', 'good'), ...(r[2] ? [txt(' — '), txt(r[2])] : [])],
            }
        }
        r = rest.match(new RegExp(`^(${CO}) force-completed by (.+?): (.+)$`))
        if (r) {
            return { kind: 'completion', segs: [...who, txt(' — '), crd(g(r, 1)), txt(' force-completed by '), txt(g(r, 2)), txt(' — '), emp(g(r, 3))] }
        }
        return { kind: 'plain', segs: [...who, txt(' ' + rest)] }
    }

    // ── "{team} has locked in their fleet!" ──
    m = msg.match(/^(.+?) has locked in their fleet!$/)
    if (m) return { kind: 'lock', segs: [tm(g(m, 1)), txt(' locked in their fleet '), out('READY', 'good')] }

    // ── "{player} is not in any team" ──
    if (/ is not in any team$/.test(msg)) {
        return { kind: 'system', segs: [plr(msg.replace(/ is not in any team$/, '')), txt(' is not on any team')] }
    }

    // ── activity: "{name} ({team}) {summary}[ - {tag}]" ──
    m = msg.match(/^(.+?) \((.+?)\) (.+)$/)
    if (m) {
        const p = plr(g(m, 1), g(m, 2))
        let body = g(m, 3)
        const tags: FeedSeg[] = []
        const tail = body.match(/^(.*?) - (no tile matched|but the event hasn't started yet|duplicate loot from .+, ignoring)$/)
        if (tail) {
            body = g(tail, 1)
            const tag = g(tail, 2)
            if (tag === 'no tile matched') tags.push(txt(' '), out('no tile', 'muted'))
            else if (tag.startsWith('but the event')) tags.push(txt(' '), out('event not started', 'muted'))
            else tags.push(txt(' '), out('duplicate', 'muted'))
        }
        return { kind: summaryKind(body), segs: [p, txt(' '), ...parseSummary(body), ...tags] }
    }

    // ── fallback ──
    return { kind: isSuccess ? 'plain' : 'system', segs: [txt(msg)] }
}
