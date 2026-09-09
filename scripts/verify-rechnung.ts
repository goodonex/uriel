/**
 * Drift-Wache fuer die Rechnung am Lead (09.09.2026).
 *
 * Dieses Feature hat eine Eigenschaft, die kein anderes im Cockpit hat:
 * **jeder Lauf verbraucht eine fortlaufende Rechnungsnummer, und die ist nicht
 * zurueckzunehmen.** Ein Testlauf gegen die echte Maschine hinterlaesst eine
 * Luecke in der Buchhaltung. Deshalb prueft dieses Skript ausschliesslich
 * `baueRechnungsDaten` — die reine Vorstufe ohne Seiteneffekte — plus den
 * Quelltext der Stellen, an denen ein Rueckfall teuer waere.
 *
 * Die drei Fehler, gegen die hier gesichert wird:
 *
 * 1. **Der falsche Feldname.** Der Generator liest `leistungsdatum`; die
 *    Bruecke hiess bis zum 09.09. `leistungszeitraum`. Das Feld fiel still
 *    unter den Tisch — die Rechnung trug dann das Rechnungsdatum als
 *    Leistungsdatum, ohne Fehlermeldung. Bei einem Retainer ist das der
 *    falsche Monat auf einem Buchhaltungsbeleg.
 * 2. **Eine Rechnung ohne Anschrift.** Nach §14 UStG keine gueltige Rechnung —
 *    und die Nummer waere fuer nichts verbraucht.
 * 3. **Ein automatischer zweiter Versuch.** Wuerde nach einem Timeout still
 *    eine zweite Rechnung erzeugen.
 *
 * Start: npx tsx scripts/verify-rechnung.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baueRechnungsDaten } from '../runner/rechnung.mjs'

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

/** Wirft die Funktion mit einer Meldung, die das Wort enthaelt? */
function wirft(bau: () => unknown, teil: string): boolean {
  try {
    bau()
    return false
  } catch (e) {
    return String((e as Error)?.message ?? '').toLowerCase().includes(teil.toLowerCase())
  }
}

const PAKET = {
  schluessel: 'retainer-1000',
  titel: 'Retainer Kampagne',
  beschreibung: 'Laufende Kampagnenbetreuung.',
  einzelpreis: 1000,
  wiederkehrend: 'monat',
}
const KUNDE = { firma: 'Testmakler GmbH', strasse: 'Teststraße 1', plz: '20095', ort: 'Hamburg' }

console.log('\n1 — Der Feldname, der den Zeitraum verschluckt hat')
{
  const { daten } = baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, leistungszeitraum: 'September 2026' }, PAKET)
  check('der Zeitraum kommt als `leistungsdatum` an', daten.leistungsdatum === 'September 2026')
  check(
    'der alte Name steht nicht mehr im Auftrag',
    !Object.prototype.hasOwnProperty.call(daten, 'leistungszeitraum'),
    'der Generator liest ihn nicht — er waere wieder still wirkungslos',
  )
  const ohne = baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel }, PAKET)
  check(
    'ohne Angabe bleibt das Feld weg (Generator setzt das Rechnungsdatum)',
    !Object.prototype.hasOwnProperty.call(ohne.daten, 'leistungsdatum'),
  )
  const leer = baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, leistungszeitraum: '   ' }, PAKET)
  check('Leerzeichen zaehlen als keine Angabe', !Object.prototype.hasOwnProperty.call(leer.daten, 'leistungsdatum'))
}

console.log('\n2 — Der Betreff sagt, wofuer gezahlt wird')
{
  const { daten } = baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel }, PAKET)
  check('der Betreff traegt den Pakettitel', daten.betreff === 'Rechnung — Retainer Kampagne')
  check('nicht der blosse Generator-Default "Rechnung"', daten.betreff !== 'Rechnung')
}

console.log('\n3 — Ohne Anschrift keine Rechnung (§14 UStG)')
{
  check('fehlender Empfaenger wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: { ...KUNDE, firma: '' }, paket: PAKET.schluessel }, PAKET), 'empfänger'))
  check('fehlende Strasse wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: { ...KUNDE, strasse: '' }, paket: PAKET.schluessel }, PAKET), 'unvollständig'))
  check('fehlende PLZ wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: { ...KUNDE, plz: '' }, paket: PAKET.schluessel }, PAKET), 'unvollständig'))
  check('fehlender Ort wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: { ...KUNDE, ort: '' }, paket: PAKET.schluessel }, PAKET), 'unvollständig'))
  check('unbekanntes Paket wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: KUNDE, paket: 'gibtsnicht' }, undefined), 'unbekanntes paket'))
}

console.log('\n4 — Der Betrag')
{
  check('ohne Angabe gilt der Paketpreis', baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel }, PAKET).betrag === 1000)
  check('eine Angabe ueberschreibt ihn', baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, betrag: 750 }, PAKET).betrag === 750)
  check('null wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, betrag: 0 }, PAKET), 'betrag'))
  check('negativ wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, betrag: -5 }, PAKET), 'betrag'))
  check('Text wird abgelehnt', wirft(() => baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, betrag: 'viel' }, PAKET), 'betrag'))
  const { daten } = baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel, betrag: 750 }, PAKET)
  check('der Betrag steht auch in der Position', daten.positionen[0].einzelpreis === 750)
}

console.log('\n5 — Die Rechnungsmail (0082, optional)')
{
  const mit = baueRechnungsDaten({ kunde: { ...KUNDE, email: 'buchhaltung@test.de' }, paket: PAKET.schluessel }, PAKET)
  check('gesetzte Mail wird durchgereicht', mit.daten.kunde.email === 'buchhaltung@test.de')
  const ohne = baueRechnungsDaten({ kunde: KUNDE, paket: PAKET.schluessel }, PAKET)
  check(
    'ohne Mail bleibt das Feld weg statt leer',
    !Object.prototype.hasOwnProperty.call(ohne.daten.kunde, 'email'),
  )
  check(
    'die Mail ist keine Pflicht — der Knopf darf im Call nicht sperren',
    ohne.daten.kunde.firma === 'Testmakler GmbH',
  )
}

console.log('\n6 — Die Stellen, an denen ein Rueckfall teuer waere')
{
  const runner = readFileSync(join(wurzel, 'runner/rechnung.mjs'), 'utf8')
  check('die Dublettensperre greift auf Kunde + Betrag + Tag', /findeDublette\(kundeName, brutto\)/.test(runner))
  check('die Dublette traegt einen eigenen Code', /fehler\.code = 'dublette'/.test(runner))
  check('`erzwingen` laesst die bewusste Zweitrechnung durch', /if \(!auftrag\.erzwingen\)/.test(runner))
  check('der Python-Lauf hat eine Frist', /Rechnungslauf hat nicht geantwortet/.test(runner))
  check('kein automatischer zweiter Versuch', !/retry|erneutVersuchen|versuche\s*<|for \(let versuch/i.test(runner))

  const api = readFileSync(join(wurzel, 'app/src/cockpit/lib/rechnungApi.ts'), 'utf8')
  check('die Oberflaeche behandelt 409 als Nachfrage, nicht als Fehler', /res\.status === 409/.test(api))
  check('auch der Auftragsweg kennt die Dublette', /DublettenFehler\(text, null\)/.test(api))

  const panel = readFileSync(join(wurzel, 'app/src/cockpit/components/sales/RechnungPanel.tsx'), 'utf8')
  check('der Knopf bleibt ohne vollstaendige Anschrift gesperrt', /disabled=\{!vollstaendig \|\| laeuft \|\| !paket\}/.test(panel))
  check('die Mail zaehlt nicht zur Vollstaendigkeit', !/rechnung_email\.trim\(\) !== ''/.test(panel))
  check('das Panel schickt die Mail mit', /email: entwurf\.rechnung_email\.trim\(\) \|\| undefined/.test(panel))
  check('der Zeitraum steht nur beim Retainer', /paket\?\.wiederkehrend \? \(/.test(panel))
  check('ohne Runner verschwindet das Panel, statt tot dazustehen', /if \(bereit === false\) return null/.test(panel))
}

console.log(`\nverify-rechnung: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
