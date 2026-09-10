/**
 * scripts/an-den-mini.mjs — einen Auftrag auf den Mac mini schieben (10.09.2026).
 *
 * **Der Anlass, Kevins Worte:** *„Ich hab eben im Café gesessen, da hat auf
 * einmal jemand mit Lautsprecher telefoniert und da wollt ich einfach gehen."*
 * Große Arbeit soll in Sekunden den Rechner wechseln, damit der Laptop
 * zuklappen kann — ohne dass der Mini bei null anfängt.
 *
 * Der Weg ist der, den Kevins Handy schon benutzt: eine Zeile in
 * `runner_jobs`. Der Runner auf dem Mini fragt die Tabelle alle vier Sekunden
 * ab, nimmt den ältesten offenen Auftrag und startet den Agenten `auftrag`
 * damit. Kein SSH, kein offener Laptop, keine Wartezeit.
 *
 * Der Auftragstext kommt über stdin, weil er lang ist und Anführungszeichen,
 * Zeilenumbrüche und Backticks enthält — als Kommandozeilen-Argument wäre er
 * eine Zitier-Falle.
 *
 * Start:
 *   node scripts/an-den-mini.mjs --titel "Erstnachrichten schreiben" \
 *     --cwd "/Users/kevin/Kevin OS/02 Projekte/uriel" < auftrag.md
 *
 * Optionen:
 *   --titel <text>   Kurzname für die Rückmeldung (Pflicht)
 *   --ort <ort>      Wo der Mini arbeitet: `projekte` (Standard), `uriel` oder
 *                    `vault`. Der Mini löst das Kurzwort selbst auf.
 *                    ACHTUNG `vault`: Dort darf ein Agent nur LESEN
 *                    (`deny: [Bash, Write, Edit]` in der settings.json des
 *                    Vaults, mit Absicht). Ein Auftrag, der dort schreiben
 *                    soll, scheitert - genau daran starb die erste Probe.
 *   --cwd <pfad>     Absoluter Pfad statt Kurzwort. Nur nehmen, wenn es keinen
 *                    passenden Ort gibt — ein Pfad vom Laptop muss auf dem Mini
 *                    nicht gelten (anderer Benutzername, anderer Vault-Pfad).
 *                    Genau daran scheiterte der erste echte Auftrag.
 *   --pruefen        Nur zeigen, was gesendet würde, und nichts schreiben.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// `fileURLToPath`, nicht `.pathname`: Der Repo-Pfad enthält Leerzeichen
// („Kevin OS"), und die kämen sonst als %20 zurück.
const HIER = fileURLToPath(new URL('..', import.meta.url))
const VAULT = join(homedir(), 'Second Brain')
/** Dieselben Wurzeln, die `runner/index.mjs` durchlässt — hier nur früher geprüft. */
const WURZELN = [resolve(VAULT), resolve(join(homedir(), 'Kevin OS'))]

function argWert(name, standard = null) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : standard
}

/** Kurzworte, die der ausführende Rechner selbst auflöst. */
const ORTE = ['vault', 'uriel', 'projekte']

const titel = argWert('titel')
const nurPruefen = process.argv.includes('--pruefen')
const ort = argWert('ort')
const pfad = argWert('cwd')

if (!titel) {
  console.error('FEHLT: --titel "Kurzname des Auftrags"')
  process.exit(1)
}
if (ort && !ORTE.includes(ort)) {
  console.error(`Unbekannter Ort "${ort}". Möglich: ${ORTE.join(', ')} — oder --cwd <absoluter Pfad>.`)
  process.exit(1)
}

/**
 * Ein Kurzwort reist als Kurzwort mit; nur ein ausdrücklicher Pfad wird hier
 * schon geprüft. Was auf diesem Laptop existiert, muss auf dem Mini nicht
 * existieren — deshalb ist das Kurzwort der Normalfall.
 */
const cwd = pfad ? resolve(pfad) : (ort ?? 'projekte')
if (pfad && !WURZELN.some((w) => cwd === w || cwd.startsWith(w + sep))) {
  console.error(
    `Arbeitsordner liegt außerhalb der erlaubten Wurzeln:\n  ${cwd}\nErlaubt: ${WURZELN.join(' · ')}\n` +
      `Meist besser: --ort ${ORTE.join('|')} — das löst der Mini selbst auf.`,
  )
  process.exit(1)
}

if (cwd === 'vault' || cwd === resolve(VAULT)) {
  console.error(
    'Hinweis: Im Vault darf ein Agent nur LESEN — Bash, Write und Edit sind dort gesperrt (Absicht).\n' +
      'Soll der Auftrag etwas schreiben, nimm --ort projekte oder --ort uriel.',
  )
}

const auftrag = readFileSync(0, 'utf8').trim()
if (!auftrag) {
  console.error('Kein Auftragstext auf stdin. Der Mini hat den Chat nicht — ohne Text weiß er nichts.')
  process.exit(1)
}
/**
 * Ein Zweizeiler ist fast immer ein vergessener Kontext, kein knapper Auftrag.
 * Der Mini kann nicht nachfragen: Was hier fehlt, fehlt endgültig.
 */
if (auftrag.length < 120) {
  console.error(
    `Der Auftrag ist mit ${auftrag.length} Zeichen zu dünn. Der Mini sieht diesen Chat nicht —\n` +
      'schreib hinein, was er wissen muss: Ziel, Ausgangslage, Dateien, wann er fertig ist.',
  )
  process.exit(1)
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
const kopf = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

/** Läuft der Mini überhaupt? Ein Auftrag an einen schlafenden Rechner wartet still. */
const hb = await fetch(`${url}/rest/v1/runner_heartbeat?select=last_seen,running&id=eq.global`, { headers: kopf })
  .then((r) => (r.ok ? r.json() : []))
  .catch(() => [])
const gesehen = hb[0]?.last_seen ? new Date(hb[0].last_seen) : null
const stillSeitMin = gesehen ? Math.round((Date.now() - gesehen.getTime()) / 60000) : null
const laeuft = Array.isArray(hb[0]?.running) ? hb[0].running : []

if (nurPruefen) {
  console.log(`TITEL: ${titel}\nORDNER: ${cwd}\nZEICHEN: ${auftrag.length}`)
  console.log(`MINI: ${stillSeitMin === null ? 'kein Lebenszeichen' : `zuletzt vor ${stillSeitMin} Min gesehen`}`)
  console.log(`\n--- Auftrag ---\n${auftrag.slice(0, 600)}${auftrag.length > 600 ? '\n…' : ''}`)
  process.exit(0)
}

const res = await fetch(`${url}/rest/v1/runner_jobs`, {
  method: 'POST',
  headers: { ...kopf, Prefer: 'return=representation' },
  body: JSON.stringify({
    kind: 'agent_run',
    payload: { agent: 'auftrag', input: { auftrag, cwd, titel } },
  }),
})
if (!res.ok) {
  console.error(`Auftrag nicht angenommen — HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}

const [job] = await res.json()
console.log(`Auftrag liegt auf dem Mini: ${titel}`)
console.log(`  Job ${job.id.slice(0, 8)} · Ordner ${cwd} · ${auftrag.length} Zeichen Kontext`)
if (stillSeitMin === null) {
  console.log('  ACHTUNG: Der Mini hat kein Lebenszeichen gesendet — der Auftrag wartet, bis er wieder da ist.')
} else if (stillSeitMin > 5) {
  console.log(`  ACHTUNG: Letztes Lebenszeichen vor ${stillSeitMin} Minuten. Der Auftrag wartet so lange.`)
} else {
  console.log(`  Der Mini war vor ${stillSeitMin} Min da${laeuft.length ? ` (arbeitet gerade an ${laeuft.length})` : ''} — er greift binnen Sekunden zu.`)
}
