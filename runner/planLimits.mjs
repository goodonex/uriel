/**
 * Wie voll ist der Max-Plan? (25.09.2026)
 *
 * Kevins Frage: Die Nutzung je Programm bringt nichts ohne die Zahl, wie viel
 * insgesamt zur Verfügung steht. Anthropic nennt für den Max-Plan keine feste
 * Tokenzahl — aber jede Antwort der Claude-CLI im Format `stream-json` trägt
 * ein `rate_limit_event` mit der Auslastung beider Fenster:
 *
 *   "unifiedWindows": { "five_hour": { "utilization": 0.07, "resetsAt": … },
 *                       "seven_day": { "utilization": 0.03, "resetsAt": … } }
 *
 * Daraus und aus dem, was seit dem Wochenstart verbraucht wurde (Token-Buch),
 * rechnet die Oberfläche hoch, was eine volle Woche hergibt.
 *
 * Quelle sind die Läufe des Runners selbst; ist der letzte Wert älter als
 * eine halbe Stunde, fragt `probe()` über `claude -p /usage` nach.
 */
import { spawn } from 'node:child_process'

/** Ab diesem Alter fragt der Runner selbst nach. */
export const LIMITS_FRISCH_MS = 30 * 60_000

function fenster(w) {
  const anteil = Number(w?.utilization)
  const reset = Number(w?.resetsAt)
  if (!Number.isFinite(anteil)) return null
  return { anteil, resetsAt: Number.isFinite(reset) ? new Date(reset * 1000).toISOString() : null }
}

/** Aus einer stream-json-Zeile (Objekt) die Auslastung lesen. Null, wenn keine drinsteht. */
export function limitsAusEreignis(ev, jetzt = Date.now()) {
  if (ev?.type !== 'rate_limit_event') return null
  const w = ev.rate_limit_info?.unifiedWindows
  if (!w) return null
  const fuenfStunden = fenster(w.five_hour)
  const woche = fenster(w.seven_day)
  if (!fuenfStunden && !woche) return null
  return { fuenfStunden, woche, gemessen: new Date(jetzt).toISOString() }
}

/** Aus der ganzen stdout eines Laufs die letzte Auslastung. */
export function limitsAusAusgabe(text, jetzt = Date.now()) {
  let letzte = null
  for (const zeile of String(text ?? '').split('\n')) {
    if (!zeile.includes('rate_limit_event')) continue
    try {
      letzte = limitsAusEreignis(JSON.parse(zeile), jetzt) ?? letzte
    } catch {
      /* halbe Zeile */
    }
  }
  return letzte
}

const MONATE = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }

/**
 * „resets Oct 1 at 9pm" → Zeitpunkt in der Ortszeit dieses Rechners (die CLI
 * schreibt in dessen Zeitzone). Ohne Jahr: liegt das Datum mehr als einen Tag
 * zurück, ist das nächste Jahr gemeint.
 */
export function resetAusText(text, jetzt = Date.now()) {
  const m = String(text ?? '').match(/resets (\w{3}) (\d{1,2})(?: at (\d{1,2})(?::(\d{2}))?\s*(am|pm))?/i)
  if (!m || !(m[1] in MONATE)) return null
  let std = m[3] ? Number(m[3]) % 12 : 0
  if (m[5]?.toLowerCase() === 'pm') std += 12
  const jahr = new Date(jetzt).getFullYear()
  let d = new Date(jahr, MONATE[m[1]], Number(m[2]), std, m[4] ? Number(m[4]) : 0)
  if (d.getTime() < jetzt - 86_400_000) d = new Date(jahr + 1, MONATE[m[1]], Number(m[2]), std, m[4] ? Number(m[4]) : 0)
  return d.toISOString()
}

/**
 * Die Ausgabe von `claude -p /usage` lesen:
 *   Current session: 9% used · resets Sep 25 at 4pm (Europe/Berlin)
 *   Current week (all models): 4% used · resets Oct 1 at 9pm (Europe/Berlin)
 */
export function limitsAusUsage(text, jetzt = Date.now()) {
  const zeile = (re) => String(text ?? '').split('\n').find((z) => re.test(z)) ?? null
  const lies = (z) => {
    if (!z) return null
    const p = z.match(/(\d{1,3})% used/)
    return p ? { anteil: Number(p[1]) / 100, resetsAt: resetAusText(z, jetzt) } : null
  }
  const fuenfStunden = lies(zeile(/^\s*Current session:/i))
  const woche = lies(zeile(/^\s*Current week \(all models\):/i))
  if (!fuenfStunden && !woche) return null
  return { fuenfStunden, woche, gemessen: new Date(jetzt).toISOString() }
}

/**
 * Die Auslastung erfragen: `claude -p /usage` ist ein lokaler Befehl der CLI
 * und kostet kein Modell. (Eine Haiku-Anfrage mit `rate_limit_event` war der
 * erste Weg — die CLI schickt das Ereignis aber nicht bei jedem Aufruf.)
 */
export function probe({ claudeBin = process.env.CLAUDE_BIN ?? 'claude', env = process.env, cwd = undefined, timeoutMs = 60_000 } = {}) {
  return new Promise((fertig) => {
    let aus = ''
    let p
    try {
      p = spawn(claudeBin, ['-p', '/usage'], { env, cwd, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      fertig(null)
      return
    }
    const t = setTimeout(() => p.kill('SIGTERM'), timeoutMs)
    p.stdout.on('data', (d) => (aus += d))
    p.on('error', () => {
      clearTimeout(t)
      fertig(null)
    })
    p.on('close', () => {
      clearTimeout(t)
      fertig(limitsAusUsage(aus))
    })
  })
}
