/**
 * runner/jophielNachziehen.mjs — Jophiel auf dem Mini selbst aktuell halten (28.09.2026).
 *
 * **Der Anlass.** Jophiel kam bisher nur per `git push` vom Laptop auf den
 * Mini (`betrieb/nachziehen.sh`, braucht mini.local im Heimnetz). Am 28.09.
 * war Kevin unterwegs, und zwei Korrekturen für den Vertriebsstart am 29.09.
 * (Loom-Aufnahme unter 100 MB, „Loom ja" → Bauliste) lagen auf GitHub fest:
 * Der Mini-Agent darf weder git noch npm noch launchctl ausführen. Der Runner
 * darf das — er holt seinen eigenen Code längst genauso (`codeCheckTick`).
 *
 * **Sicherungen, alle hart:**
 * - nur Fast-Forward von origin/main, nie bei eigenen Änderungen im Ordner;
 * - nie, solange eine Seite gebaut oder überarbeitet wird (`/api/projects`);
 * - nur nachts (23–7 Uhr), damit keine Loom-Aufnahme mitten im Upload stirbt;
 * - gebaut wird in `dist-neu`; nur ein fehlerfreier Build ersetzt `dist`,
 *   sonst bleibt die alte Oberfläche stehen und der Code wird zurückgesetzt.
 */
import { spawn } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { JOPHIEL_ROOT } from './jophiel.mjs'

const FERTIG = new Set(['done', 'needs-review', 'failed', 'paused', 'idle'])
const PORT = 4100
/** Unter launchd fehlen nvm und Homebrew im PATH — derselbe Pfad wie CLI_PATH im Runner. */
const PFAD = [
  process.env.PATH ?? '',
  join(homedir(), '.nvm', 'versions', 'node', `v${process.versions.node}`, 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
].filter(Boolean).join(':')

function lauf(cmd, args, { cwd = JOPHIEL_ROOT, timeoutMs = 10 * 60_000 } = {}) {
  return new Promise((fertig) => {
    let out = ''
    const p = spawn(cmd, args, { cwd, env: { ...process.env, PATH: PFAD }, stdio: ['ignore', 'pipe', 'pipe'] })
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { out += d })
    p.on('error', () => { clearTimeout(t); fertig({ ok: false, out }) })
    p.on('close', (code) => { clearTimeout(t); fertig({ ok: code === 0, out: out.trim() }) })
  })
}
const git = async (...args) => {
  const r = await lauf('git', args)
  return r.ok ? r.out : null
}

export function nachtFenster(jetzt = new Date()) {
  const h = jetzt.getHours()
  return h >= 23 || h < 7
}

async function baustelleOffen() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/projects`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return true
    const liste = await r.json()
    return liste.some((p) => !FERTIG.has(p.status))
  } catch {
    return true // Jophiel antwortet nicht: lieber nichts anfassen
  }
}

let laeuft = false
/** @returns {Promise<string>} was passiert ist, für das Log */
export async function jophielNachziehen({ jetzt = new Date(), erzwingeFenster = false } = {}) {
  if (laeuft) return 'läuft schon'
  if (!existsSync(join(JOPHIEL_ROOT, '.git'))) return 'kein Jophiel-Ordner'
  if (!erzwingeFenster && !nachtFenster(jetzt)) return 'außerhalb 23–7 Uhr'
  laeuft = true
  try {
    const schmutzig = await git('status', '--porcelain', '--untracked-files=no')
    if (schmutzig === null) return 'git nicht lesbar'
    if (schmutzig) return 'eigene Änderungen im Jophiel-Ordner — nichts geholt'
    if ((await git('remote', 'get-url', 'origin')) === null) {
      await git('remote', 'add', 'origin', 'https://github.com/goodonex/jophiel.git')
    }
    if ((await git('fetch', '--quiet', 'origin', 'main')) === null) return 'fetch fehlgeschlagen'
    const hier = await git('rev-parse', 'HEAD')
    const dort = await git('rev-parse', 'origin/main')
    if (!hier || !dort || hier === dort) return 'aktuell'
    if ((await git('merge-base', '--is-ancestor', hier, dort)) === null) return `kein Fast-Forward (${hier.slice(0, 7)} → ${dort.slice(0, 7)})`
    if (await baustelleOffen()) return 'eine Seite wird gerade gebaut — nächster Versuch'

    const zweig = (await git('rev-parse', '--abbrev-ref', 'HEAD')) || 'main'
    // Zurück auf den alten Stand ohne hartes Zurücksetzen: `checkout -B`
    // verweigert sich, wenn dabei eigene Änderungen verloren gingen.
    const zurueck = () => git('checkout', '--quiet', '-B', zweig, hier)
    if ((await git('merge', '--ff-only', '--quiet', dort)) === null) return 'merge fehlgeschlagen'
    const geaendert = (await git('diff', '--name-only', hier, dort)) ?? ''
    if (/(^|\n)package(-lock)?\.json($|\n)/.test(geaendert)) {
      const npm = await lauf('npm', ['install', '--no-audit', '--no-fund'])
      if (!npm.ok) {
        await zurueck()
        return 'npm install fehlgeschlagen — zurückgesetzt'
      }
    }
    const neu = join(JOPHIEL_ROOT, 'dist-neu')
    rmSync(neu, { recursive: true, force: true })
    const bau = await lauf('npx', ['vite', 'build', '--config', 'ui/vite.config.mjs', '--outDir', neu, '--emptyOutDir'])
    if (!bau.ok || !existsSync(join(neu, 'index.html'))) {
      rmSync(neu, { recursive: true, force: true })
      await zurueck()
      return `Build fehlgeschlagen — alter Stand bleibt: ${bau.out.slice(-300)}`
    }
    const dist = join(JOPHIEL_ROOT, 'dist')
    const alt = join(JOPHIEL_ROOT, 'dist-alt')
    rmSync(alt, { recursive: true, force: true })
    if (existsSync(dist)) renameSync(dist, alt)
    renameSync(neu, dist)
    rmSync(alt, { recursive: true, force: true })

    const uid = process.getuid?.() ?? 501
    await lauf('launchctl', ['kickstart', '-k', `gui/${uid}/de.jophiel.server`], { timeoutMs: 30_000 })
    await new Promise((r) => setTimeout(r, 4000))
    let gesund = false
    try {
      const h = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(5000) })
      gesund = h.ok
    } catch {}
    return `nachgezogen ${hier.slice(0, 7)} → ${dort.slice(0, 7)}, neu gebaut, Dienst ${gesund ? 'antwortet' : 'ANTWORTET NICHT'}`
  } finally {
    laeuft = false
  }
}
