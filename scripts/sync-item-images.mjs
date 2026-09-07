// Scans the discord-bot backend's task config for every "image" URL and
// downloads any we don't already have locally into public/images/items/.
// Re-run this whenever tasks get new images assigned.
//
// Usage: node scripts/sync-item-images.mjs [--backend <path to discord-bot repo>]

import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const outDir = path.join(repoRoot, 'public', 'images', 'items')

function parseArgs(argv) {
    const args = { backend: path.resolve(repoRoot, '..', 'discord-bot') }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--backend' && argv[i + 1]) args.backend = path.resolve(argv[i + 1])
    }
    return args
}

async function findJsonFiles(dir) {
    let entries
    try {
        entries = await readdir(dir, { withFileTypes: true })
    } catch {
        return []
    }
    const files = []
    for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await findJsonFiles(full)))
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(full)
        }
    }
    return files
}

/** Recursively collect every string value found under a key named "image". */
function collectImageUrls(node, out) {
    if (Array.isArray(node)) {
        for (const item of node) collectImageUrls(item, out)
    } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
            if (key === 'image' && typeof value === 'string') {
                out.add(value)
            } else {
                collectImageUrls(value, out)
            }
        }
    }
}

function targetFilename(url) {
    const withoutQuery = url.split('?')[0]
    const encoded = withoutQuery.split('/').pop()
    return decodeURIComponent(encoded)
}

async function fileExists(p) {
    try {
        await access(p)
        return true
    } catch {
        return false
    }
}

async function main() {
    const { backend } = parseArgs(process.argv.slice(2))
    const configDir = path.join(backend, 'config')

    if (!(await fileExists(configDir))) {
        console.error(`Can't find a config/ directory at ${configDir}`)
        console.error('Pass --backend <path to discord-bot repo> if it lives somewhere else.')
        process.exit(1)
    }

    const jsonFiles = await findJsonFiles(configDir)
    const urls = new Set()
    for (const file of jsonFiles) {
        try {
            const parsed = JSON.parse(await readFile(file, 'utf-8'))
            collectImageUrls(parsed, urls)
        } catch (err) {
            console.warn(`Skipping ${file}: ${err.message}`)
        }
    }

    console.log(`Scanned ${jsonFiles.length} task config files under ${configDir}`)
    console.log(`Found ${urls.size} unique image URLs`)

    await mkdir(outDir, { recursive: true })

    const byFilename = new Map()
    for (const url of urls) {
        const name = targetFilename(url)
        if (!byFilename.has(name)) byFilename.set(name, url)
    }

    let downloaded = 0
    let alreadyHad = 0
    const failed = []

    for (const [name, url] of byFilename) {
        const dest = path.join(outDir, name)
        if (await fileExists(dest)) {
            alreadyHad++
            continue
        }
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'tea-battleships-bingo-fe/1.0 (fan Discord bingo bot asset sync)' },
            })
            if (!res.ok) {
                failed.push(`${name}: HTTP ${res.status}`)
                continue
            }
            const buf = Buffer.from(await res.arrayBuffer())
            await writeFile(dest, buf)
            downloaded++
            console.log(`downloaded ${name} (${buf.length} bytes)`)
        } catch (err) {
            failed.push(`${name}: ${err.message}`)
        }
        await new Promise((r) => setTimeout(r, 150))
    }

    console.log(`\nDone: ${downloaded} downloaded, ${alreadyHad} already had, ${failed.length} failed`)
    if (failed.length) {
        console.log('Failed:')
        for (const f of failed) console.log(' -', f)
    }
}

main()
