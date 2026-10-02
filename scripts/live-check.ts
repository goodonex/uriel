/**
 * Ist es wirklich live? (02.10.2026)
 *
 * Kevin: „Ich hätte gerne die Aussage, jawohl, das ist in dieser Sekunde
 * definitiv hundertprozentig live." Dieses Skript vergleicht drei Dinge und
 * sagt Ja oder Nein, mit dem Grund:
 *
 *   1. origin/main — der Stand, der live sein soll
 *   2. die Website (frameworkos.de) — enthält ihr Bundle genau diesen Commit?
 *   3. der Runner auf dem Mini — meldet er genau diesen Commit (`runner_version`)?
 *
 * Start: npx tsx scripts/live-check.ts
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const wurzel = join(import.meta.dirname, '..')
const git = (a: string) => execSync(`git ${a}`, { cwd: wurzel, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
const env = Object.fromEntries(
  readFileSync(join(wurzel, 'runner/.env'), 'utf8').split('\n').filter((z) => /^[A-Z_]+=/.test(z)).map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1).trim()]),
)

git('fetch -q origin')
const soll = git('rev-parse origin/main')
const kurz = soll.slice(0, 7)
// Wichtig: nur Commits zählen, die App oder Runner ändern — ein reiner Doku-Commit baut zwar neu, aber das ist egal.
console.log(`Soll-Stand: origin/main = ${kurz}`)

let web = false
try {
  const html = await (await fetch('https://frameworkos.de/', { cache: 'no-store' })).text()
  const bundle = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  const js = bundle ? await (await fetch(`https://frameworkos.de/${bundle}`, { cache: 'no-store' })).text() : ''
  const gebaut = js.match(/__URIEL_COMMIT__\s*=\s*["`']([0-9a-f]{7,40})["`']/)?.[1]
  web = Boolean(gebaut && gebaut === soll)
  console.log(`Website:    ${gebaut ? gebaut.slice(0, 7) : 'kein Commit im Bundle (alter Build?)'} → ${web ? 'JA, aktuell' : 'NEIN'}`)
} catch (e) {
  console.log('Website:    nicht erreichbar →', (e as Error).message)
}

let mini = false
try {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/runner_snapshots?key=eq.runner_version&select=data,updated_at`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })
  const [z] = await r.json()
  if (!z) console.log('Runner:     meldet noch keine Version (läuft noch alter Code)')
  else {
    const d = z.data
    const alter = Math.round((Date.now() - new Date(z.updated_at).getTime()) / 60000)
    mini = d.commit === soll && alter < 30
    console.log(`Runner:     ${String(d.commit).slice(0, 7)} auf ${d.host}, gemeldet vor ${alter} Min. → ${mini ? 'JA, aktuell' : 'NEIN'}`)
    if (d.eigeneAenderungen) console.log('            ACHTUNG: im Ordner liegen eigene Änderungen, der Runner holt deshalb keinen neuen Code')
    if (d.laufendeLaeufe) console.log(`            ${d.laufendeLaeufe} Lauf/Läufe aktiv, der Pull wartet bis sie fertig sind`)
    if (d.origin && d.origin !== d.commit) console.log(`            origin steht bei ${String(d.origin).slice(0, 7)}, der Runner noch nicht`)
  }
} catch (e) {
  console.log('Runner:     nicht lesbar →', (e as Error).message)
}

console.log(web && mini ? '\nLIVE: Website und Runner laufen auf dem Soll-Stand.' : '\nNOCH NICHT LIVE (siehe oben).')
process.exit(web && mini ? 0 : 1)
