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
import { mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

// ---------- Konfiguration ----------
const PORT = Number(process.env.RUNNER_PORT ?? 4711)
const VAULT = resolve(process.env.VAULT_PATH ?? join(homedir(), 'Second Brain'))
const RUNS_DIR = join(VAULT, 'System', 'Runs')
const QUEUE_DIR = join(VAULT, 'System', 'Queue')
const TIMEOUT_MS = 10 * 60 * 1000 // 10 Minuten (Plan §6)

// Kunden-Ads (Cockpit /ads): Ad-Creatives + Manifeste liegen in den Kundenordnern.
const KUNDEN_ROOT = resolve(process.env.KUNDEN_ROOT ?? join(homedir(), 'Kevin OS', '02 Projekte', 'Kunden'))
const KUNDEN_CONFIG = join(KUNDEN_ROOT, 'cockpit-kunden.json')
const MANIFEST_MAX_BYTES = 2_000_000

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
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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

  // Unter launchd fehlt claude oft im PATH → gängige Bin-Verzeichnisse anhängen.
  const extraBins = [
    join(homedir(), '.nvm', 'versions', 'node', `v${process.versions.node}`, 'bin'),
    join(homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]
  const PATH = [process.env.PATH ?? '', ...extraBins].filter(Boolean).join(':')

  const proc = spawn(process.env.CLAUDE_BIN ?? 'claude', ['-p', prompt, '--output-format', 'text'], {
    cwd: VAULT,
    env: { ...process.env, PATH },
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

  // spawn-Fehler (z.B. claude nicht im PATH) dürfen den Runner NICHT crashen —
  // ohne diesen Handler wirft der ChildProcess ein unhandled 'error' Event
  // (beobachtet: ENOENT-Crash-Loop unter launchd am 08.07.).
  proc.on('error', async (e) => {
    clearTimeout(timeout)
    running.delete(id)
    try {
      await writeRunFile(
        id,
        agent,
        'error',
        startedAt,
        `# Run konnte nicht starten\n\n\`\`\`\n${String(e?.message ?? e)}\n\`\`\`\n`,
      )
    } catch {
      /* Log reicht */
    }
    console.error(`[runner] spawn-Fehler für ${id}:`, e?.message ?? e)
  })

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

// ---------- Vault: Wikilink-Graph (Obsidian-Gefühl) ----------
/** @type {{at:number, data:{nodes:Array<{path:string,name:string,links:number}>, edges:Array<{source:string,target:string}>}}|null} */
let graphCache = null
const GRAPH_CACHE_MS = 60_000
const GRAPH_MAX_NOTES = 100

async function vaultGraph() {
  if (graphCache && Date.now() - graphCache.at < GRAPH_CACHE_MS) return graphCache.data

  const notes = await recentNotes(GRAPH_MAX_NOTES)
  const byName = new Map() // basename (lowercase) → path
  for (const n of notes) byName.set(n.name.toLowerCase(), n.path)

  const edges = []
  const linkCount = new Map()
  for (const n of notes) {
    let raw
    try {
      raw = await readFile(join(VAULT, n.path), 'utf8')
    } catch {
      continue
    }
    // [[Ziel]] / [[Ziel|Alias]] / [[Ziel#Abschnitt]]
    for (const m of raw.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
      const target = byName.get(m[1].trim().toLowerCase())
      if (!target || target === n.path) continue
      edges.push({ source: n.path, target })
      linkCount.set(n.path, (linkCount.get(n.path) ?? 0) + 1)
      linkCount.set(target, (linkCount.get(target) ?? 0) + 1)
    }
  }

  const data = {
    nodes: notes.map((n) => ({ path: n.path, name: n.name, links: linkCount.get(n.path) ?? 0 })),
    edges,
  }
  graphCache = { at: Date.now(), data }
  return data
}

// ---------- Agentic-OS-Map (AGENTIC-OS-PLAN.md) ----------
const GLOBAL_SKILLS_DIR = join(homedir(), '.claude', 'skills')
const VAULT_SKILLS_DIR = join(VAULT, '.claude', 'skills')
const OS_APPS_FILE = join(VAULT, 'System', 'os-apps.json')

/** SKILL.md-Frontmatter-light: name + description (erste ~4KB reichen). */
function parseSkillMeta(raw) {
  const meta = {}
  const m = raw.match(/^---\n([\s\S]*?)\n---/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  return meta
}

async function collectSkills(dir, source) {
  const skills = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return skills
  }
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    const skillFile = join(dir, e.name, 'SKILL.md')
    let description = ''
    try {
      const raw = (await readFile(skillFile, 'utf8')).slice(0, 4096)
      description = parseSkillMeta(raw).description ?? ''
    } catch {
      continue // kein SKILL.md → kein Skill
    }
    skills.push({
      id: `${source}:${e.name}`,
      name: e.name,
      description: description.slice(0, 240),
      source,
      path: skillFile,
    })
  }
  return skills
}

let osMapCache = null
const OS_MAP_CACHE_MS = 60_000

async function osMap({ fresh = false } = {}) {
  // In-flight-Promise teilen: parallele Aufrufe bauen die Map nicht doppelt,
  // und ein Fehler invalidiert den Cache statt ihn zu vergiften.
  if (fresh) osMapCache = null
  if (osMapCache && Date.now() - osMapCache.at < OS_MAP_CACHE_MS) return osMapCache.promise
  const entry = { at: Date.now(), promise: null }
  entry.promise = buildOsMap().catch((e) => {
    if (osMapCache === entry) osMapCache = null
    throw e
  })
  osMapCache = entry
  return entry.promise
}

async function buildOsMap() {
  const [vaultSkills, globalSkills, graph] = await Promise.all([
    collectSkills(VAULT_SKILLS_DIR, 'vault'),
    collectSkills(GLOBAL_SKILLS_DIR, 'global'),
    vaultGraph(),
  ])

  // Apps + zusätzliche Routinen: Quelle der Wahrheit ist System/os-apps.json im Vault.
  let appsConfig = { apps: [], routines: [] }
  try {
    appsConfig = JSON.parse(await readFile(OS_APPS_FILE, 'utf8'))
  } catch {
    /* Datei fehlt → nur eingebaute Routinen */
  }

  const routines = [
    {
      id: 'routine:cockpit-runner',
      name: 'Cockpit-Runner',
      description: 'launchd de.kevinos.cockpit-runner · KeepAlive · Port 4711',
      schedule: 'immer an',
    },
    {
      id: 'routine:dream-check',
      name: 'Dream-Check',
      description: 'Analysiert Skill-/Run-Nutzung, 1-2 Verbesserungsvorschläge',
      schedule: 'täglich (erster Runner-Start)',
    },
    ...(Array.isArray(appsConfig.routines) ? appsConfig.routines : []).map((r, i) => ({
      id: `routine:${r.id ?? i}`,
      name: r.name ?? String(r.id ?? i),
      description: r.description ?? '',
      schedule: r.schedule ?? '',
    })),
  ]

  const apps = (Array.isArray(appsConfig.apps) ? appsConfig.apps : []).map((a, i) => ({
    id: `app:${a.id ?? i}`,
    name: a.name ?? String(a.id ?? i),
    description: a.description ?? '',
    kind: a.kind ?? 'tool', // mcp | api | cli | tool
    status: a.status ?? 'connected', // connected | manual | geplant
  }))

  // Memory: Notizen mit PARA-Bereich (erstes Pfadsegment) für Cluster-Zuordnung.
  const memory = graph.nodes.map((n) => ({
    ...n,
    area: n.path.includes('/') ? n.path.slice(0, n.path.indexOf('/')) : 'Vault',
  }))

  return {
    skills: [...vaultSkills, ...globalSkills],
    routines,
    apps,
    memory,
    memoryEdges: graph.edges,
    generatedAt: new Date().toISOString(),
  }
}

/** Erlaubte Roots einmalig realpath-auflösen (Symlink-sicher). */
let osFileRootsPromise = null
function osFileRoots() {
  osFileRootsPromise ??= Promise.all(
    [VAULT, GLOBAL_SKILLS_DIR].map(async (root) => {
      try {
        return await realpath(root)
      } catch {
        return null // Root existiert nicht → fällt aus der Allowlist
      }
    }),
  ).then((roots) => roots.filter(Boolean))
  return osFileRootsPromise
}

/** Read-only Dateizugriff fürs Detail-Panel. Nur Vault + globale Skills (realpath-geprüft). */
async function osFile(relOrAbs) {
  const candidate = resolve(relOrAbs.startsWith('/') ? relOrAbs : join(VAULT, relOrAbs))
  if (!/\.(md|json|mjs|txt|canvas|base)$/.test(candidate)) {
    throw Object.assign(new Error('nur Textdateien'), { code: 'EDENIED' })
  }
  // realpath schlägt Symlink-Escapes und ../-Tricks tot; ENOENT → 404 upstream.
  const real = await realpath(candidate)
  const roots = await osFileRoots()
  const allowed = roots.some((root) => real === root || real.startsWith(root + sep))
  if (!allowed) throw Object.assign(new Error('Pfad außerhalb des erlaubten Bereichs'), { code: 'EDENIED' })
  const raw = await readFile(real, 'utf8')
  return { path: real, content: raw.slice(0, 40_000), truncated: raw.length > 40_000 }
}

// ---------- Kunden-Ads (Cockpit /ads) ----------
/** MIME-Allowlist für die statische Auslieferung aus dem Kunden-Root. */
const KUNDEN_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

/** Kunden-Root einmalig realpath-auflösen (Symlink-sicher, analog osFileRoots). */
let kundenRootRealPromise = null
function kundenRootReal() {
  kundenRootRealPromise ??= realpath(KUNDEN_ROOT).catch(() => null)
  return kundenRootRealPromise
}

async function kundenRegistry() {
  try {
    const parsed = JSON.parse(await readFile(KUNDEN_CONFIG, 'utf8'))
    return Array.isArray(parsed.kunden) ? parsed.kunden : []
  } catch {
    return []
  }
}

function emptyManifest(slug) {
  return { schemaVersion: 1, customer: slug, updatedAt: null, overviewFiles: [], ads: [] }
}

/** Manifest-Pfad NUR über das Register (= Schreib-Allowlist). Unbekannter Slug → null. */
async function manifestPath(slug) {
  if (!slug) return null
  const k = (await kundenRegistry()).find((x) => x.slug === slug)
  if (!k || typeof k.folder !== 'string') return null
  return join(KUNDEN_ROOT, k.folder, k.adsDir ?? '05_leadgen', 'ads.json')
}

async function readBodyCapped(req, maxBytes) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
    if (data.length > maxBytes) {
      throw Object.assign(new Error('Body zu groß'), { code: 'ETOOBIG' })
    }
  }
  return data
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

    if (req.method === 'GET' && url.pathname === '/vault/graph') {
      return json(res, 200, await vaultGraph())
    }

    if (req.method === 'GET' && url.pathname === '/os/map') {
      return json(res, 200, await osMap({ fresh: url.searchParams.get('fresh') === '1' }))
    }

    if (req.method === 'GET' && url.pathname === '/os/file') {
      const p = url.searchParams.get('path')
      if (!p) return json(res, 400, { error: 'path fehlt' })
      try {
        return json(res, 200, await osFile(p))
      } catch (e) {
        if (e?.code === 'EDENIED') return json(res, 403, { error: e.message })
        throw e
      }
    }

    // ---------- Kunden-Ads: statische Dateien (HTML/PNG-Previews für /ads) ----------
    if (req.method === 'GET' && url.pathname.startsWith('/files/kunden/')) {
      const rel = decodeURIComponent(url.pathname.slice('/files/kunden/'.length))
      const dot = rel.lastIndexOf('.')
      const mime = dot >= 0 ? KUNDEN_MIME[rel.slice(dot).toLowerCase()] : undefined
      if (!mime) return json(res, 403, { error: 'Dateityp nicht erlaubt' })
      const root = await kundenRootReal()
      if (!root) return json(res, 404, { error: 'Kunden-Root existiert nicht' })
      // realpath schlägt ../-Tricks und Symlink-Escapes tot; ENOENT → 404 unten.
      const real = await realpath(resolve(join(KUNDEN_ROOT, rel)))
      if (real !== root && !real.startsWith(root + sep)) {
        return json(res, 403, { error: 'Pfad außerhalb Kunden-Root' })
      }
      const buf = await readFile(real)
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      })
      return res.end(buf)
    }

    // ---------- Kunden-Ads: Register + Manifest ----------
    if (req.method === 'GET' && url.pathname === '/ads/customers') {
      return json(res, 200, { kunden: await kundenRegistry() })
    }

    // Alle Kunden + Manifeste in einem Rutsch (fürs Dashboard).
    if (req.method === 'GET' && url.pathname === '/ads/overview') {
      const kunden = await kundenRegistry()
      const entries = []
      for (const k of kunden) {
        const file = join(KUNDEN_ROOT, k.folder, k.adsDir ?? '05_leadgen', 'ads.json')
        let manifest = emptyManifest(k.slug)
        try {
          manifest = JSON.parse(await readFile(file, 'utf8'))
        } catch (e) {
          if (e?.code !== 'ENOENT') throw e
        }
        entries.push({ kunde: k, manifest })
      }
      return json(res, 200, { entries })
    }

    if (url.pathname === '/ads/manifest') {
      const slug = url.searchParams.get('kunde') ?? ''
      const file = await manifestPath(slug)
      if (!file) return json(res, 400, { error: `Unbekannter Kunde: ${slug}` })

      let onDisk = null
      try {
        onDisk = JSON.parse(await readFile(file, 'utf8'))
      } catch (e) {
        if (e?.code !== 'ENOENT') throw e // kaputtes JSON soll auffallen, nicht leer wirken
      }

      if (req.method === 'GET') {
        return json(res, 200, onDisk ?? emptyManifest(slug))
      }

      if (req.method === 'PUT') {
        let body
        try {
          body = JSON.parse(await readBodyCapped(req, MANIFEST_MAX_BYTES))
        } catch (e) {
          if (e?.code === 'ETOOBIG') return json(res, 413, { error: 'Manifest zu groß (max 2 MB)' })
          return json(res, 400, { error: 'ungültiges JSON' })
        }
        const manifest = body?.manifest
        if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.ads)) {
          return json(res, 400, { error: 'Manifest mit schemaVersion 1 und ads[] erwartet' })
        }
        // Konflikt-Guard: App-Stand muss auf dem Disk-Stand basieren, sonst hat
        // z.B. eine Claude-Session parallel geschrieben → App lädt `current` neu.
        const diskUpdatedAt = onDisk?.updatedAt ?? null
        if ((body.baseUpdatedAt ?? null) !== diskUpdatedAt) {
          return json(res, 409, {
            error: 'Konflikt: Manifest wurde extern geändert',
            current: onDisk ?? emptyManifest(slug),
          })
        }
        manifest.updatedAt = new Date().toISOString()
        await writeFile(file, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
        return json(res, 200, { ok: true, updatedAt: manifest.updatedAt })
      }
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

/** Dream-Check (REBUILD-PLAN §8): beim Start, max. 1x pro Kalendertag. */
async function maybeDream() {
  try {
    const today = nowStamp().slice(0, 10)
    const names = await readdir(RUNS_DIR)
    if (names.some((n) => n.startsWith(today) && n.includes('dream-check'))) return

    const recentRuns = names
      .filter((n) => n.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 15)
      .map((n) => n.replace(/\.md$/, ''))
    console.log('[runner] dream-check startet (erster Lauf heute)…')
    await startRun('dream-check', { recentRuns })
  } catch (e) {
    console.error('[runner] dream-check übersprungen:', e?.message ?? e)
  }
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[runner] alive auf http://127.0.0.1:${PORT} · Vault: ${VAULT}`)
  // leicht verzögert, damit der Start nicht blockiert
  setTimeout(() => void maybeDream(), 5000)
})
