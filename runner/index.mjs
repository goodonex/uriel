/**
 * Cockpit-Runner (REBUILD-PLAN §6)
 * Lokaler Agenten-Runner: nimmt Button-Intents aus der Webapp entgegen,
 * spawnt `claude -p` headless mit cwd = Vault und schreibt das Ergebnis
 * als Markdown nach <Vault>/System/Runs/ — sichtbar in Obsidian + Cockpit.
 *
 * Bewusst zero-dependency (node:http). Bindet NUR an 127.0.0.1.
 * Start: node runner/index.mjs   (oder: npm run cockpit im Repo-Root)
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

// ---------- Konfiguration ----------
const PORT = Number(process.env.RUNNER_PORT ?? 4711)
const VAULT = resolve(process.env.VAULT_PATH ?? join(homedir(), 'Second Brain'))
const RUNS_DIR = join(VAULT, 'System', 'Runs')
const QUEUE_DIR = join(VAULT, 'System', 'Queue')
const TIMEOUT_MS = 10 * 60 * 1000 // 10 Minuten (Plan §6)

/** Erlaubte Agenten = Skills im Vault. Alles andere wird abgelehnt. */
const AGENTS = new Set(['wochenrecap', 'followup-entwuerfe', 'lead-research', 'dream-check'])

// ---------- Zustand ----------
/** @type {Map<string, {id:string, agent:string, startedAt:string, proc:import('node:child_process').ChildProcess}>} */
const running = new Map()

// ---------- Helpers ----------
function nowStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  let data = ''
  for await (const chunk of req) data += chunk
  return data ? JSON.parse(data) : {}
}

async function writeRunFile(id, agent, status, startedAt, content) {
  const file = join(RUNS_DIR, `${id}.md`)
  const frontmatter = [
    '---',
    `agent: ${agent}`,
    `status: ${status}`,
    `started: ${startedAt}`,
    `finished: ${new Date().toISOString()}`,
    '---',
    '',
  ].join('\n')
  await writeFile(file, frontmatter + content, 'utf8')
  return file
}

/** Frontmatter-light-Parser für die Runs-Liste. */
function parseRun(name, raw) {
  const meta = { agent: 'unbekannt', status: 'done', started: '', finished: '' }
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const [k, ...rest] = line.split(':')
      if (k && rest.length) meta[k.trim()] = rest.join(':').trim()
    }
  }
  const body = m ? raw.slice(m[0].length) : raw
  const preview = body.trim().split('\n').slice(0, 3).join(' ').slice(0, 160)
  return { id: name.replace(/\.md$/, ''), ...meta, preview }
}

// ---------- Agent starten ----------
async function startRun(agent, input) {
  const id = `${nowStamp()}-${agent}`
  const startedAt = new Date().toISOString()

  // Intent in die Queue (Nachvollziehbarkeit + Debugging)
  await writeFile(
    join(QUEUE_DIR, `${id}.json`),
    JSON.stringify({ id, agent, input, startedAt }, null, 2),
    'utf8',
  )

  const inputBlock = input && Object.keys(input).length
    ? `\n\nEingabedaten (JSON):\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``
    : ''
  const prompt = `/${agent}${inputBlock}`

  const proc = spawn('claude', ['-p', prompt, '--output-format', 'text'], {
    cwd: VAULT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', (c) => (stdout += c))
  proc.stderr.on('data', (c) => (stderr += c))

  const timeout = setTimeout(() => {
    proc.kill('SIGTERM')
  }, TIMEOUT_MS)

  running.set(id, { id, agent, startedAt, proc })

  proc.on('close', async (code) => {
    clearTimeout(timeout)
    running.delete(id)
    try {
      if (code === 0 && stdout.trim()) {
        await writeRunFile(id, agent, 'done', startedAt, stdout.trim() + '\n')
      } else {
        const err = [
          `# Run fehlgeschlagen (Exit ${code})`,
          '',
          '```',
          (stderr || stdout || 'kein Output').slice(-3000),
          '```',
        ].join('\n')
        await writeRunFile(id, agent, 'error', startedAt, err + '\n')
      }
    } catch (e) {
      console.error(`[runner] Run-Datei für ${id} konnte nicht geschrieben werden:`, e)
    }
  })

  return { id, agent, startedAt }
}

// ---------- Vault: zuletzt geänderte Notizen ----------
const EXCLUDE = new Set(['System', '.obsidian', '.claude', '.trash', '.git', '08 Anhänge', '10 Excalidraw'])

async function recentNotes(limit) {
  /** @type {Array<{path:string, name:string, mtime:number}>} */
  const found = []
  async function walk(dir, depth) {
    if (depth > 3) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || EXCLUDE.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full, depth + 1)
      } else if (e.name.endsWith('.md')) {
        const s = await stat(full)
        found.push({ path: full.slice(VAULT.length + 1), name: e.name.replace(/\.md$/, ''), mtime: s.mtimeMs })
      }
    }
  }
  await walk(VAULT, 0)
  found.sort((a, b) => b.mtime - a.mtime)
  return found.slice(0, limit)
}

// ---------- HTTP ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'OPTIONS') return json(res, 204, {})

  try {
    if (req.method === 'GET' && url.pathname === '/status') {
      return json(res, 200, {
        alive: true,
        vault: VAULT,
        running: [...running.values()].map(({ id, agent, startedAt }) => ({ id, agent, startedAt })),
        queued: [],
      })
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      const body = await readBody(req)
      const agent = String(body.agent ?? '')
      if (!AGENTS.has(agent)) return json(res, 400, { error: `Unbekannter Agent: ${agent}` })
      if ([...running.values()].some((r) => r.agent === agent)) {
        return json(res, 409, { error: `${agent} läuft bereits` })
      }
      const run = await startRun(agent, body.input ?? {})
      return json(res, 202, run)
    }

    if (req.method === 'GET' && url.pathname === '/runs') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100)
      const names = (await readdir(RUNS_DIR)).filter((n) => n.endsWith('.md')).sort().reverse().slice(0, limit)
      const runs = []
      for (const name of names) {
        const raw = await readFile(join(RUNS_DIR, name), 'utf8')
        runs.push(parseRun(name, raw))
      }
      // laufende Runs voranstellen
      const active = [...running.values()].map(({ id, agent, startedAt }) => ({
        id, agent, status: 'running', started: startedAt, finished: '', preview: 'läuft…',
      }))
      return json(res, 200, { runs: [...active, ...runs] })
    }

    if (req.method === 'GET' && url.pathname.startsWith('/runs/')) {
      const id = decodeURIComponent(url.pathname.slice('/runs/'.length))
      if (!/^[\w.\-]+$/.test(id)) return json(res, 400, { error: 'ungültige id' })
      const raw = await readFile(join(RUNS_DIR, `${id}.md`), 'utf8')
      return json(res, 200, { id, ...parseRun(`${id}.md`, raw), content: raw.replace(/^---\n[\s\S]*?\n---\n?/, '') })
    }

    if (req.method === 'GET' && url.pathname === '/vault/recent') {
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 15), 50)
      return json(res, 200, { notes: await recentNotes(limit) })
    }

    return json(res, 404, { error: 'not found' })
  } catch (e) {
    if (e && e.code === 'ENOENT') return json(res, 404, { error: 'nicht gefunden' })
    console.error('[runner]', e)
    return json(res, 500, { error: String(e?.message ?? e) })
  }
})

await mkdir(RUNS_DIR, { recursive: true })
await mkdir(QUEUE_DIR, { recursive: true })

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[runner] alive auf http://127.0.0.1:${PORT} · Vault: ${VAULT}`)
})
