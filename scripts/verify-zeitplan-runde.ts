/**
 * Drift-Wache für die Zeitplan-Runde (14.09.2026).
 *
 * Am 31.08. flog der Zeitplan raus, weil Kevins MacBook ihn nicht trug. Heute
 * trägt ihn der Mac mini, und die Runde läuft wieder nach Uhr — Kevin: *„wir
 * haben ja genau den Mini dafür geholt."* Damit kommen vier alte Gefahren
 * zurück, jede davon teuer, und drei davon still:
 *
 * 1. **Doppelte Automatik.** Laufen die acht Einzel-Routinen NEBEN der Runde,
 *    macht der Mini jede Arbeit zweimal — zwei Postfach-Syncs durch dasselbe
 *    Chrome, zwei Sortierer-Läufe, zwei Rechnungen für ein Ergebnis.
 * 2. **Das Tagesziel wird ein Lauf-Ziel.** Fünf Slots am Tag à 50
 *    Erstnachrichten sind 250 Website-Recherchen statt 50. Genau der Fall, den
 *    Kevin ausgeschlossen haben wollte: *„ich möchte nicht, dass jedes Mal mehr
 *    Tokens verbraucht werden als eigentlich nötig ist."*
 * 3. **Der Slot verbrennt ohne Chrome.** Vier von neun Etappen brauchen es. Ein
 *    Lauf ohne Chrome hakt sie als „übersprungen" ab, setzt die Marke — und die
 *    Nacht ist vorbei, ohne dass jemand etwas merkt.
 * 4. **Der teure Slot wandert in den Tag.** Steht `erstnachrichten` in der
 *    Tag-Liste, zahlt Kevin sie fünfmal statt einmal.
 *
 * Start: npx tsx scripts/verify-zeitplan-runde.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ETAPPEN, faelligerSlot, neueRunde } from '../runner/runde.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0

function check(was: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ok   ${was}`)
  } else {
    fail++
    console.log(`  FEHL ${was}${detail ? ' — ' + detail : ''}`)
  }
}

const kern = readFileSync(join(wurzel, 'runner/index.mjs'), 'utf8')
const upsert = readFileSync(join(wurzel, 'runner/linkedin/netzwerkUpsert.mjs'), 'utf8')
const NACHT = 3
const TAG = [8, 11, 14, 17, 20]
const slotUm = (iso: string) => faelligerSlot({ jetzt: new Date(iso), nachtStunde: NACHT, tagStunden: TAG })

console.log('\n1) Welcher Slot ist dran')
{
  check('vor dem ersten Slot ist nichts fällig', slotUm('2026-09-14T02:30:00') === null)
  check('um 03:00 ist der Nachtlauf dran', slotUm('2026-09-14T03:00:00')?.stunde === 3)
  check('der Nachtlauf ist der volle', slotUm('2026-09-14T03:05:00')?.voll === true)
  check('ein Tag-Slot ist nicht voll', slotUm('2026-09-14T11:30:00')?.voll === false)

  // Der Fall, für den es die Funktion gibt: Der Runner startet um 05:00 neu
  // (launchd, neuer Code) — die Nacht darf nicht ausfallen.
  check('um 05:00 wird der 03:00-Lauf nachgeholt', slotUm('2026-09-14T05:00:00')?.stunde === 3)
  // Und der Gegenfall: Um 12:00 ist der 11:00-Slot dran, nicht der von heute Nacht.
  check('später am Tag zählt der jüngste erreichte Slot', slotUm('2026-09-14T12:00:00')?.stunde === 11)
  check('nach dem letzten Slot bleibt es beim letzten', slotUm('2026-09-14T23:59:00')?.stunde === 20)

  // Der Slot-Beginn ist absolut — sonst misst jeder launchd-Neustart neu
  // (der Fehler vom 20.08.: 171 Starts, jeder mit frischem Zähler).
  const s = slotUm('2026-09-14T11:30:00')!
  check('der Slot-Beginn ist die volle Stunde, nicht „jetzt"', new Date(s.start).getHours() === 11 && new Date(s.start).getMinutes() === 0)
  check('zwei Prüfungen im selben Slot liefern denselben Beginn', slotUm('2026-09-14T11:05:00')?.start === slotUm('2026-09-14T11:55:00')?.start)
  check('der nächste Slot hat einen anderen Beginn', slotUm('2026-09-14T14:05:00')?.start !== s.start)

  check('ohne Tag-Slots bleibt der Nachtlauf', faelligerSlot({ jetzt: new Date('2026-09-14T20:00:00'), nachtStunde: 3, tagStunden: [] })?.stunde === 3)
  check('Unsinn in der Stundenliste wird aussortiert', faelligerSlot({ jetzt: new Date('2026-09-14T20:00:00'), nachtStunde: 3, tagStunden: [99, NaN as any] })?.stunde === 3)
  check('ein kaputtes Datum liefert keinen Slot', faelligerSlot({ jetzt: new Date('quatsch'), nachtStunde: 3, tagStunden: TAG }) === null)
}

console.log('\n2) Was der Tag-Slot fährt')
{
  const tagEtappen = kern.match(/const RUNDE_TAG_ETAPPEN = \[([^\]]+)\]/)?.[1] ?? ''
  check('die Tag-Liste steht im Runner', tagEtappen.length > 0)
  // Die einzige Etappe, die pro Lauf zweistellig Geld zieht (je Lead eine
  // Website-Recherche): Sie gehört in den einen Nachtlauf, nicht in fünf Slots.
  check('Erstnachrichten laufen NICHT im Tag-Slot', !tagEtappen.includes('erstnachrichten'))
  check('das Postfach läuft im Tag-Slot', tagEtappen.includes('postfach'))
  // Kostet nichts, wenn niemand wartet — und beantwortet den Lead, der heute
  // Vormittag geschrieben hat, noch heute Vormittag.
  check('Antwort-Entwürfe laufen im Tag-Slot', tagEtappen.includes('entwuerfe'))

  // Die Namen müssen echte Etappen sein, sonst filtert `neueRunde` sie still weg
  // und der Tag-Slot fährt eine leere Runde.
  const namen = tagEtappen.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
  const bekannt = new Set(ETAPPEN.map((e) => e.schluessel))
  check('jeder Name in der Tag-Liste ist eine echte Etappe', namen.every((n) => bekannt.has(n)), namen.filter((n) => !bekannt.has(n)).join(', '))
  check('der Tag-Slot fährt weniger als die volle Runde', neueRunde({ jetzt: Date.now(), nur: namen }).etappen.length < ETAPPEN.length)
  check('der Nacht-Slot fährt alles', neueRunde({ jetzt: Date.now(), nur: null }).etappen.length === ETAPPEN.length)
}

console.log('\n3) Keine doppelte Automatik')
{
  check('der Schalter ist opt-in, nicht opt-out', /const RUNDE_AUTOMATIK = process\.env\.RUNDE_AUTOMATIK === '1'/.test(kern))
  check('die Zeitplan-Runde hängt am Schalter', /if \(RUNDE_AUTOMATIK\) \{[\s\S]{0,600}maybeRunde/.test(kern))
  check('maybeRunde steigt ohne Schalter sofort aus', /async function maybeRunde\(\) \{\s*\n\s*if \(!RUNDE_AUTOMATIK\) return/.test(kern))
  // Der teuerste Fehler dieses Umbaus: beide Automatiken gleichzeitig.
  check('die alten Einzel-Routinen weichen der Runde', /if \(!RUNDE_AUTOMATIK\) \{[\s\S]{0,2000}maybePostfachSync/.test(kern))
  check('der Morgenbrief bleibt davon unberührt', /if \(!RUNDE_AUTOMATIK\) \{[\s\S]*?\n    \}/.test(kern) && !/if \(!RUNDE_AUTOMATIK\) \{[\s\S]{0,900}maybeMorgenbrief/.test(kern))
}

console.log('\n4) Der Slot darf nicht still verbrennen')
{
  check('ohne Chrome wartet der Slot, statt zu starten', /if \(!\(await warteAufRechner\('runde', \{ brauchtChrome: true \}\)\)\) return\s*\n\s*markeSchreib\(RUNDE_SLOT_MARKE/.test(kern))
  // Die Marke fällt VOR dem Lauf: Eine Runde dauert zwanzig Minuten, der Tick
  // kommt alle fünf — sonst stünden vier Läufe übereinander.
  check('die Marke fällt vor dem Lauf, nicht danach', kern.indexOf('markeSchreib(RUNDE_SLOT_MARKE') < kern.indexOf("void starteRunde({ ausloeser: 'zeitplan'"))
  check('die Marke überlebt den Neustart (Platte, nicht Variable)', /const RUNDE_SLOT_MARKE = 'letzte-zeitplan-runde'/.test(kern))
  check('ein laufender Lauf blockiert den nächsten', /if \(laufendeRunde\?\.status === 'laeuft'\) return/.test(kern))
  check('der Auslöser heißt „zeitplan" (im Verlauf unterscheidbar)', /ausloeser: 'zeitplan'/.test(kern))
}

console.log('\n5) Das Tagesbudget der Erstnachrichten')
{
  check('das Budget rechnet gegen den heutigen Tag', /const schonHeute = markeLies\('erstnachrichten-tag'\) === heuteZahl \? markeLies\('erstnachrichten-heute'\) : 0/.test(kern))
  check('das Tagesziel ist das Ziel MINUS was heute schon lief', /ERSTNACHRICHTEN_TAGESZIEL \?\? 50\) - schonHeute/.test(kern))
  check('ist das Budget weg, kostet die Etappe nichts mehr', /if \(TAGESZIEL === 0\) return \{ text: `Tagesbudget erreicht/.test(kern))
  // Nach jedem Batch, nicht erst am Ende: Ein Abbruch in Batch 3 darf die
  // bezahlten Batches 1 und 2 nicht vergessen.
  check('gezählt wird nach jedem Batch', /vorbereitet \+= gebaut\.leads\.length\s*\n[\s\S]{0,400}markeSchreib\('erstnachrichten-heute', schonHeute \+ vorbereitet\)/.test(kern))
}

console.log('\n6) Der kurze Lauf ist kein Abbruch')
{
  // Kevin am 14.09.: „Du sagst mir seit Wochen, dass der bei vierzig von
  // siebenhundert abbricht. Aber ist das nicht genau das, was wir wollten?"
  check('saubere Enden sind benannt', /const SAUBERE_ENDEN = new Set\(\['nichts-neues', 'liste-zuende'\]\)/.test(upsert))
  check('ein sauberes Ende schreibt keinen Abbruch-Vermerk', /else if \(SAUBERE_ENDEN\.has\(liste\.abbruchGrund\)\) await merkeKurzLauf/.test(upsert))
  check('ein echter Abbruch schreibt ihn weiterhin', /else await merkeAbbruch\(liste\.seite, stempel, liste\.gesamt, zeilen\.length\)/.test(upsert))
  check('„kein-nachladen" bleibt ein Abbruch (eingefrorenes Chrome, 18.08.)', !/SAUBERE_ENDEN[\s\S]{0,200}kein-nachladen/.test(upsert))
  // Der Vorfall vom 12.08.: Ein Teil-Lauf kippte die InMail-Kachel von 876 auf 50.
  check('der kurze Lauf fasst vollAt/gesamt/geerntet nicht an', /const \{ letzterAbbruch: _erledigt, \.\.\.bestand \} = data\[seite\] \?\? \{\}/.test(upsert))
  check('er räumt den alten Abbruch ab', /data\[seite\] = \{ \.\.\.bestand, kurzAt: stempel/.test(upsert))
}

console.log(`\nverify-zeitplan-runde: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
