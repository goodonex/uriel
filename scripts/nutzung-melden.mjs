/**
 * scripts/nutzung-melden.mjs — die Token-Nutzung DIESES Rechners nach Uriel
 * melden (25.09.2026).
 *
 * Auf dem Mini macht das der Runner von selbst (Spiegel `nutzung_<rechner>`).
 * Gebaut wird aber vor allem am Laptop, und dessen Sitzungen sieht der Mini
 * nicht. Dieses Skript rechnet dieselbe Übersicht aus denselben Protokollen
 * (`runner/tokenBuch.mjs`, keine zweite Fassung) und legt sie unter dem
 * Namen dieses Rechners ab. Uriel zählt alle Rechner zusammen.
 *
 * Start:  node scripts/nutzung-melden.mjs            (einmal melden)
 *         node scripts/nutzung-melden.mjs --pruefen  (nur ausgeben)
 * Dauerhaft alle 30 Minuten: scripts/install-nutzung-autostart.sh
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aktualisiereBuch, neuesBuch, nutzung, projektOrdner, rechnerName } from '../runner/tokenBuch.mjs'
import { probe } from '../runner/planLimits.mjs'

const HIER = fileURLToPath(new URL('..', import.meta.url))
const projekteWurzel = resolve(join(homedir(), 'Kevin OS', '02 Projekte'))
const { projekte, programme } = await projektOrdner(projekteWurzel)
const buch = neuesBuch()
await aktualisiereBuch(buch, { protokollWurzel: join(homedir(), '.claude', 'projects'), projekteWurzel, projekte, programme })
// Auslastung des Max-Plans über `claude -p /usage` — kostet kein Modell.
const stand = { ...nutzung(buch, { tage: 30, rechner: rechnerName(), programme }), plan: await probe({ cwd: homedir() }) }

if (process.argv.includes('--pruefen')) {
  for (const z of stand.projekte) {
    const mio = (n) => (n / 1e6).toFixed(1).padStart(7)
    console.log(`${z.projekt.padEnd(24)} bauen ${mio(z.bauen.tokens)} · betrieb ${mio(z.betrieb.tokens)} · arbeit ${mio(z.arbeit.tokens)} Mio.`)
  }
  console.log('Plan:', JSON.stringify(stand.plan))
  process.exit(0)
}

const env = Object.fromEntries(
  readFileSync(join(HIER, 'runner/.env'), 'utf8')
    .split('\n')
    .filter((z) => z.includes('=') && !z.trim().startsWith('#'))
    .map((z) => {
      const i = z.indexOf('=')
      return [z.slice(0, i).trim(), z.slice(i + 1).trim()]
    }),
)
const url = (env.SUPABASE_URL ?? '').replace(/\/$/, '')
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('runner/.env ohne SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — nichts gemeldet.')
  process.exit(1)
}
const res = await fetch(`${url}/rest/v1/runner_snapshots`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify({ key: `nutzung_${stand.rechner}`, data: stand, updated_at: new Date().toISOString() }),
})
if (!res.ok) {
  console.error(`Melden fehlgeschlagen: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  process.exit(1)
}
console.log(`Nutzung von ${stand.rechner} gemeldet: ${stand.projekte.length} Projekte, 30 Tage.`)
