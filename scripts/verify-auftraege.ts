/**
 * Verifikation der Auftrags-Ansicht (24.09.2026): Phasen aus STAND.md und
 * FORTSCHRITT.json, Prozent der laufenden Phase, Hochrechnung der Tokens,
 * Zuordnung der Sitzungsprotokolle zu Projekt und Phase.
 *
 * Kevins Beispiel ist der Maßstab: fünf Phasen, 1 und 2 durch, Phase 3 bei
 * 46 %, 4 und 5 kommen noch — und daneben verbraucht gegen geplant.
 *
 * Start: npx tsx scripts/verify-auftraege.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Dateien, die der Runner lädt.
import { aktiverAbschnitt, bewerteAuftrag, parseFortschritt, parseStand, startAusTitel, zustandVon } from '../runner/auftraege.mjs'
// @ts-expect-error — .mjs ohne Typen
import { OHNE_PROJEKT, neuesBuch, nimmZeile, nutzung, preisUsd, projektAusCwd, titelAusPrompt, titelZerlegen, tokensVon, zuordnen } from '../runner/tokenBuch.mjs'

// @ts-expect-error — .mjs ohne Typen
import { limitsAusAusgabe, limitsAusEreignis, limitsAusUsage, resetAusText } from '../runner/planLimits.mjs'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

// 1. STAND.md wie laplace: neueste Kette oben, alte Ketten mit Schlusszeile darunter.
const STAND = `# LAPLACE — STAND

KETTE: FERTIG

# KETTE 4 (ab 2026-09-20) — vom Beobachtungsstand zum Arbeitsplatz

## Phasen KETTE 4

- [x] **A1 Der Knopf muss buchen.** Die Order-Leitung aus dem Browser
  nach laplace_kevin_orders.
- [ ] **A2 Orderbuch-Sammler anwerfen.** Die Daten für die Heatmap.
  - [x] Sammler schreibt
  - [x] Takt steht
  - [ ] Gate grün
  - [ ] Doku
- [ ] **A3 Hebel gedeckelt freigeben.** Heute sperrt

## Was Kevin selbst tun muss

- [ ] Z1 ist keine Phase, sondern Fließtext unter einer anderen Überschrift

# KETTE 3 (ab 2026-09-20) — Kevins Review

## Phasen KETTE 3

- [x] **K1 Dienste dauerhaft** ✅ **abgeschlossen 2026-09-20, 13:18 MESZ**
- [x] **K9 Abnahme** ✅ abgeschlossen

KETTE 3: FERTIG
`
const abschnitte = parseStand(STAND)
check('1 zwei Ketten mit Phasen', abschnitte.length, 2)
check('1b Kette 3 ist fertig', abschnitte[1].fertig, true)
check('1c Kette 4 ist nicht fertig', abschnitte[0].fertig, false)
const k4 = aktiverAbschnitt(abschnitte)
check('1d aktive Kette ist Kette 4', k4.titel.startsWith('KETTE 4'), true)
check('1e Phasen-Ids', k4.phasen.map((p: { id: string }) => p.id), ['A1', 'A2', 'A3'])
check('1f Titel ohne Sternchen und Punkt', k4.phasen[0].titel, 'Der Knopf muss buchen')
check('1g Titel mit Haken', abschnitte[1].phasen[0].titel, 'Dienste dauerhaft')
check('1h Unterpunkte gezählt', k4.phasen[1].unter, { erledigt: 2, gesamt: 4 })
check('1i Fließtext unter anderer Überschrift ist keine Phase', k4.phasen.length, 3)
check('1j Startdatum', startAusTitel(k4.titel), '2026-09-20')

// 2. Unterpunkte bestimmen das Prozent der laufenden Phase — ohne Schätzung.
const ausStand = bewerteAuftrag({
  phasen: k4.phasen.map((p: object) => ({ ...p, status: 'offen', prozent: null })),
  posten: [],
})
check('2 A1 fertig', ausStand.phasen[0].status, 'fertig')
check('2b A2 läuft mit 50 %', [ausStand.phasen[1].status, ausStand.phasen[1].prozent, ausStand.phasen[1].geschaetzt], ['laeuft', 50, false])
check('2c A3 offen', ausStand.phasen[2].status, 'offen')
check('2d gesamt (1 + 0,5) / 3', ausStand.gesamtProzent, 50)
check('2e ohne fertige Phase mit Tokens keine Hochrechnung', ausStand.tokens.geplant, null)

// 3. Kevins Beispiel: fünf Phasen, Phase 3 geschätzt aus Tokens.
const M = 1_000_000
const posten = (phase: string | null, tokens: number) => ({
  projekt: 'laplace',
  art: 'bauen',
  phase,
  tag: '2026-09-23',
  ein: 0,
  aus: tokens,
  cacheSchreiben: 0,
  cacheLesen: 0,
  usd: tokens / M,
  letzte: '2026-09-23T10:00:00.000Z',
})
const fuenf = ['P1', 'P2', 'P3', 'P4', 'P5'].map((id, i) => ({
  id,
  titel: `Phase ${i + 1}`,
  erledigt: i < 2,
  status: i < 2 ? 'fertig' : 'offen',
  prozent: null,
  unter: { erledigt: 0, gesamt: 0 },
}))
const beispiel = bewerteAuftrag({
  phasen: fuenf,
  posten: [posten('P1', 8 * M), posten('P2', 12 * M), posten('P3', 4.6 * M), posten(null, 1 * M)],
})
check('3 Status je Phase', beispiel.phasen.map((p: { status: string }) => p.status), ['fertig', 'fertig', 'laeuft', 'offen', 'offen'])
check('3b Phase 3 bei 46 %, geschätzt', [beispiel.phasen[2].prozent, beispiel.phasen[2].geschaetzt], [46, true])
check('3c aktuelle Phase', beispiel.aktuell, 2)
check('3d verbraucht zählt auch Tokens ohne Phase', beispiel.tokens.verbraucht, 25.6 * M)
// 25,6 verbraucht + (10 − 4,6) Rest von Phase 3 + 2 × 10 für Phase 4 und 5
check('3e Hochrechnung', beispiel.tokens.geplant, 51 * M)
check('3f Art der Planung', beispiel.tokens.geplantArt, 'hochrechnung')
check('3g gesamt (2 + 0,46) / 5', beispiel.gesamtProzent, 49)

// 4. Eine Schätzung geht nie über 95 %, eine Vorgabe schlägt die Hochrechnung.
const ueber = bewerteAuftrag({ phasen: fuenf, posten: [posten('P1', 10 * M), posten('P3', 30 * M)], budgetTokens: 80 * M })
check('4 Deckel 95 %', ueber.phasen[2].prozent, 95)
check('4b Vorgabe', [ueber.tokens.geplant, ueber.tokens.geplantArt], [80 * M, 'vorgabe'])

// 5. FORTSCHRITT.json — ein Auftrag oder mehrere, Prozent aus der Datei.
const f = parseFortschritt({
  titel: 'Lead-Bewertung',
  gestartet: '2026-09-23T10:00:00+02:00',
  budgetTokens: 40_000_000,
  phasen: [
    { id: 'S1', titel: 'Grundprofil', status: 'fertig' },
    { id: 'S2', titel: 'Tiefenprofil', status: 'laeuft', prozent: 46.4, schritt: 'Schritt 3 von 5' },
    { id: 'S3', titel: 'Abnahme' },
  ],
})
check('5 ein Auftrag', f.length, 1)
check('5b Start auf den Tag gekürzt', f[0].gestartet, '2026-09-23')
check('5c Prozent gerundet', f[0].phasen[1].prozent, 46)
check('5d fehlender Status ist offen', f[0].phasen[2].status, 'offen')
const ausDatei = bewerteAuftrag({ phasen: f[0].phasen, posten: [], budgetTokens: f[0].budgetTokens })
check('5e Prozent aus der Datei, nicht geschätzt', [ausDatei.phasen[1].prozent, ausDatei.phasen[1].geschaetzt, ausDatei.phasen[1].schritt], [46, false, 'Schritt 3 von 5'])
check('5f mehrere Aufträge', parseFortschritt({ auftraege: [{ phasen: [{ id: 'X1' }] }, { phasen: [] }] }).length, 1)
check('5g Unsinn ergibt nichts', parseFortschritt({ foo: 1 }).length, 0)

// 6. Zustand
const JETZT = new Date('2026-09-24T12:00:00Z').getTime()
check('6 läuft (vor 5 Min)', zustandVon({ fertig: false, letzteAktivitaet: '2026-09-24T11:55:00Z', jetzt: JETZT }), 'laeuft')
check('6b pausiert (vor 3 Std)', zustandVon({ fertig: false, letzteAktivitaet: '2026-09-24T09:00:00Z', jetzt: JETZT }), 'pausiert')
check('6c brach (vor 2 Tagen)', zustandVon({ fertig: false, letzteAktivitaet: '2026-09-22T09:00:00Z', jetzt: JETZT }), 'brach')
check('6d fertig', zustandVon({ fertig: true, letzteAktivitaet: '2026-09-24T11:55:00Z', jetzt: JETZT }), 'fertig')
check('6e Wächter gestoppt', zustandVon({ fertig: false, letzteAktivitaet: '2026-09-22T09:00:00Z', waechterBeendet: 'Notbremse', jetzt: JETZT }), 'gestoppt')

// 7. Zuordnung der Sitzungsprotokolle
const WURZEL = '/Users/mini/Kevin OS/02 Projekte'
check('7 Projekt aus cwd', projektAusCwd(`${WURZEL}/laplace/web-app`, WURZEL), 'laplace')
check('7b Worktree bleibt beim Projekt', projektAusCwd(`${WURZEL}/uriel/.claude/worktrees/x`, WURZEL), 'uriel')
check('7c Sammelordner hat kein Projekt', projektAusCwd(WURZEL, WURZEL), null)
check('7d Titel aus dem Eingabeblock', titelAusPrompt('# AUFTRAG\n\nEingabedaten (JSON):\n```json\n{\n  "cwd": "projekte",\n  "titel": "laplace A12"\n}'), 'laplace A12')
check('7e Titel zerlegen', titelZerlegen('laplace A12', ['uriel', 'laplace']), { projekt: 'laplace', phase: 'A12' })
check('7f unbekanntes Projekt', titelZerlegen('irgendwas A1', ['laplace']), { projekt: null, phase: 'A1' })
check('7g Titel ohne Phase', titelZerlegen('laplace: Nachtraege nach KETTE 4', ['laplace']), { projekt: 'laplace', phase: null })

const buch = neuesBuch()
const kontext = { projekteWurzel: WURZEL, projekte: ['laplace', 'uriel'] }
const datei = { offset: 0, rest: '', titel: null, titelGeprueft: false, sitzung: null }
const zeile = (o: object) => JSON.stringify(o)
nimmZeile(buch, datei, zeile({ type: 'user', sessionId: 's1', cwd: WURZEL, message: { content: 'Auftrag\n```json\n{ "titel": "laplace A3" }\n```' } }), kontext)
const antwort = {
  type: 'assistant',
  sessionId: 's1',
  cwd: WURZEL,
  timestamp: '2026-09-24T10:00:00.000Z',
  message: { id: 'msg_1', model: 'claude-opus-5', usage: { input_tokens: 10, output_tokens: 1000, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 } },
}
nimmZeile(buch, datei, zeile(antwort), kontext)
nimmZeile(buch, datei, zeile(antwort), kontext) // Streaming wiederholt dieselbe Antwort
const p = [...buch.posten.values()]
check('7h Mini-Auftrag landet bei Projekt und Phase', p.map((x: { projekt: string; phase: string }) => [x.projekt, x.phase]), [['laplace', 'A3']])
check('7i gleiche Antwort zählt einmal', tokensVon(p[0]), 6010)
// Dieselbe Sitzung wechselt ins Projekt uriel: ab da zählt uriel, ohne laplace-Phase.
nimmZeile(buch, datei, zeile({ ...antwort, cwd: `${WURZEL}/uriel`, message: { ...antwort.message, id: 'msg_2' } }), kontext)
check('7j cwd schlägt Titel, Phase nur beim eigenen Projekt', buch.posten.has('uriel||2026-09-24|bauen'), true)
check('7k Kaputte Zeile wird übergangen', (nimmZeile(buch, datei, '{kaputt', kontext), buch.posten.size), 2)

// 7l. Wofür: Bauen, Betrieb, Arbeit
const K = { projekteWurzel: WURZEL, projekte: ['laplace', 'uriel', 'jophiel', 'Herrmann & Co'], programme: new Set(['laplace', 'uriel', 'jophiel']) }
const VAULT = '/Users/mini/Second Brain'
check('7l Kevin baut in einem Programm', zuordnen({ cwd: `${WURZEL}/jophiel`, titel: null, einstieg: 'claude-desktop' }, K), { projekt: 'jophiel', phase: null, art: 'bauen' })
check('7m Mini-Auftrag baut', zuordnen({ cwd: WURZEL, titel: 'laplace A3', einstieg: 'sdk-cli' }, K), { projekt: 'laplace', phase: 'A3', art: 'bauen' })
check('7n Routine im Vault ist Uriels Betrieb', zuordnen({ cwd: VAULT, titel: null, einstieg: 'sdk-cli' }, K), { projekt: 'uriel', phase: null, art: 'betrieb' })
check('7o Routine im Kundenordner ist Uriels Betrieb', zuordnen({ cwd: `${WURZEL}/Herrmann & Co/Intern/04_social`, titel: null, einstieg: 'sdk-cli' }, K), { projekt: 'uriel', phase: null, art: 'betrieb' })
check('7p Jophiels eigene Läufe sind Jophiels Betrieb', zuordnen({ cwd: `${WURZEL}/jophiel/projects/x`, titel: null, einstieg: 'sdk-cli' }, K), { projekt: 'jophiel', phase: null, art: 'betrieb' })
check('7q Kevin im Kundenordner arbeitet', zuordnen({ cwd: `${WURZEL}/Herrmann & Co`, titel: null, einstieg: 'claude-desktop' }, K), { projekt: 'Herrmann & Co', phase: null, art: 'arbeit' })
check('7r Kevin im Vault arbeitet', zuordnen({ cwd: VAULT, titel: null, einstieg: 'claude-desktop' }, K), { projekt: OHNE_PROJEKT, phase: null, art: 'arbeit' })

const nb = neuesBuch()
const nd = { offset: 0, rest: '', titel: null, titelGeprueft: false, sitzung: null, einstieg: null }
const heute = new Date().toISOString()
const alt = new Date(Date.now() - 40 * 86_400_000).toISOString()
const zeileVon = (id: string, cwd: string, einstieg: string, ts: string) =>
  JSON.stringify({ type: 'assistant', sessionId: id, entrypoint: einstieg, cwd, timestamp: ts, message: { id: `m-${id}-${ts}`, model: 'claude-opus-5', usage: { input_tokens: 0, output_tokens: 1000 } } })
nimmZeile(nb, { ...nd }, zeileVon('a', `${WURZEL}/uriel`, 'claude-desktop', heute), K)
nimmZeile(nb, { ...nd }, zeileVon('b', VAULT, 'sdk-cli', heute), K)
nimmZeile(nb, { ...nd }, zeileVon('c', `${WURZEL}/uriel`, 'claude-desktop', alt), K)
const n = nutzung(nb, { tage: 30, rechner: 'Mini', programme: K.programme })
check('7s Nutzung: uriel bauen und betrieb getrennt', [n.projekte[0].projekt, n.projekte[0].bauen.tokens, n.projekte[0].betrieb.tokens], ['uriel', 1000, 1000])
check('7t Älter als 30 Tage zählt nicht', n.projekte.length, 1)
check('7u Rechner steht dabei', n.rechner, 'Mini')

// 8. Preise
check('8 Opus-Preis', Math.round(preisUsd('claude-opus-5', { input_tokens: 1_000_000, output_tokens: 1_000_000 }) * 100) / 100, 30)
check('8b Cache-Lesen kostet ein Zehntel', Math.round(preisUsd('claude-opus-5', { cache_read_input_tokens: 1_000_000 }) * 100) / 100, 0.5)
check('8c unbekanntes Modell', preisUsd('gpt-9', { input_tokens: 1 }), null)

// 9. Auslastung des Max-Plans aus der CLI-Ausgabe (echte Zeile, 25.09.2026)
const RL = '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1790344800,"rateLimitType":"five_hour","unifiedWindows":{"five_hour":{"utilization":0.07,"resetsAt":1790344800},"seven_day":{"utilization":0.03,"resetsAt":1790881200}}}}'
const lim = limitsAusEreignis(JSON.parse(RL), 0)
check('9 Woche', lim.woche, { anteil: 0.03, resetsAt: new Date(1790881200 * 1000).toISOString() })
check('9b Fünf Stunden', lim.fuenfStunden.anteil, 0.07)
check('9c anderes Ereignis', limitsAusEreignis({ type: 'result' }), null)
check('9d aus ganzer Ausgabe', limitsAusAusgabe(`{"type":"system"}\n${RL}\n{"type":"result"}`, 0)?.woche.anteil, 0.03)
check('9e ohne Ereignis', limitsAusAusgabe('{"type":"result"}'), null)

// 10. Ausgabe von `claude -p /usage` (echt, 25.09.2026)
const USAGE = `You are currently using your subscription to power your Claude Code usage

Current session: 9% used · resets Sep 25 at 4pm (Europe/Berlin)
Current week (all models): 4% used · resets Oct 1 at 9pm (Europe/Berlin)
Current week (Fable): 0% used · resets Oct 1 at 9pm (Europe/Berlin)`
const J = new Date(2026, 8, 25, 12, 0).getTime()
const u = limitsAusUsage(USAGE, J)
check('10 Woche 4 %', u.woche.anteil, 0.04)
check('10b Woche neu ab 1.10. 21 Uhr', u.woche.resetsAt, new Date(2026, 9, 1, 21, 0).toISOString())
check('10c Sitzung 9 %, neu 16 Uhr', [u.fuenfStunden.anteil, u.fuenfStunden.resetsAt], [0.09, new Date(2026, 8, 25, 16, 0).toISOString()])
check('10d Fable-Zeile zählt nicht als Woche', limitsAusUsage('Current week (Fable): 50% used', J), null)
check('10e 12am ist Mitternacht', resetAusText('resets Oct 2 at 12am', J), new Date(2026, 9, 2, 0, 0).toISOString())
check('10f Minuten', resetAusText('resets Sep 25 at 4:30pm', J), new Date(2026, 8, 25, 16, 30).toISOString())
check('10g Jahreswechsel', resetAusText('resets Jan 2 at 9am', new Date(2026, 11, 30).getTime()), new Date(2027, 0, 2, 9, 0).toISOString())

console.log(`verify-auftraege: ${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail) process.exit(1)
