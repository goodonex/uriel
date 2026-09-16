/**
 * Verifikation für den Mittelweg im Website-CMS ("schau bitte drauf").
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-cms-einreichung.ts
 *
 * Geprüft wird das, woran der Vorgang scheitern würde, ohne dass es auffällt:
 * dass die Einreichungs-Nachricht wieder lesbar herauskommt, und dass aus
 * zwanzig Feldern EIN Posten wird, der so alt ist wie das älteste davon.
 */
import {
  baueCmsEinreichung,
  cmsEinreichungTitel,
  leseCmsEinreichung,
} from '../app/src/lib/cmsEinreichung'
import { buendleWebsite, ordnePosteingang, zaehleJeProjekt } from '../app/src/cockpit/lib/posteingang'
import type { PosteingangEintrag } from '../app/src/cockpit/lib/posteingang'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

function feld(id: string, projektId: string, seit: string, titel = 'Überschrift'): PosteingangEintrag {
  return {
    id,
    art: 'website',
    projektId,
    projektName: 'Testprojekt',
    titel,
    seit,
    text: null,
    alt: 'alt',
    neu: 'neu',
    bereich: 'Ganz oben',
  }
}

// 1. Einreichung ohne Notiz: nur die Zahl, sauber wieder herauslesbar.
{
  const body = baueCmsEinreichung(12)
  check('1a body', body, '[website:12]')
  check('1b gelesen', leseCmsEinreichung(body), { anzahl: 12, notiz: '' })
}

// 2. Mit Notiz — der Satz des Kunden kommt ohne Präfix zurück.
{
  const body = baueCmsEinreichung(3, '  Die Preise sind neu, passt das so?  ')
  check('2a body', body, '[website:3] Die Preise sind neu, passt das so?')
  check('2b notiz', leseCmsEinreichung(body)?.notiz, 'Die Preise sind neu, passt das so?')
}

// 3. Mehrzeilig überlebt die Runde — Kunden diktieren Absätze.
{
  const text = 'Zeile eins\n\nZeile zwei'
  check('3 mehrzeilig', leseCmsEinreichung(baueCmsEinreichung(1, text))?.notiz, text)
}

// 4. Keine Verwechslung mit gewöhnlichen Nachrichten oder mit der Abnahme.
{
  check('4a normale nachricht', leseCmsEinreichung('Hallo, kurze Frage'), null)
  check('4b abnahme-praefix', leseCmsEinreichung('[freigabe:dlv-logo] passt'), null)
  check('4c kaputt', leseCmsEinreichung('[website:] leer'), null)
  check('4d text der so anfaengt', leseCmsEinreichung('[website:abc] etwas'), null)
}

// 5. Aus zwanzig Feldern wird EIN Posten — der Kern des Ganzen.
{
  const felder = [
    feld('f1', 'p1', '2026-09-15T09:00:00Z', 'Überschrift'),
    feld('f2', 'p1', '2026-09-15T10:00:00Z', 'Absatz'),
    feld('f3', 'p1', '2026-09-15T11:00:00Z', 'Knopf'),
  ]
  const gebuendelt = buendleWebsite(felder, new Map([['p1', 'Schau mal drüber']]))
  check('5a ein posten', gebuendelt.length, 1)
  check('5b titel', gebuendelt[0].titel, 'Website — 3 Änderungen')
  // Der Vorgang wartet, seit das ERSTE Feld angefasst wurde. Nähme man das
  // letzte, würde eine Einreichung durch Weitertippen immer jünger — und käme
  // in der Warteschlange nie nach oben.
  check('5c wartet seit dem aeltesten', gebuendelt[0].seit, '2026-09-15T09:00:00Z')
  check('5d notiz haengt dran', gebuendelt[0].text, 'Schau mal drüber')
  check('5e felder bleiben erhalten', gebuendelt[0].felder?.length, 3)
  check('5f id ist projektbezogen', gebuendelt[0].id, 'website:p1')
}

// 6. Ein einzelnes Feld heißt Einzahl.
{
  const gebuendelt = buendleWebsite([feld('f1', 'p1', '2026-09-15T09:00:00Z')])
  check('6a einzahl', gebuendelt[0].titel, 'Website — 1 Änderung')
  check('6b ohne notiz', gebuendelt[0].text, null)
}

// 7. Zwei Projekte bleiben zwei Vorgänge.
{
  const gebuendelt = buendleWebsite([
    feld('f1', 'p1', '2026-09-15T09:00:00Z'),
    feld('f2', 'p2', '2026-09-15T08:00:00Z'),
    feld('f3', 'p1', '2026-09-15T10:00:00Z'),
  ])
  check('7a zwei posten', gebuendelt.length, 2)
  const geordnet = ordnePosteingang(gebuendelt)
  check('7b aeltester zuerst', geordnet[0].projektId, 'p2')
}

// 8. Der Zähler auf der Projektkarte zählt Vorgänge, nicht Felder.
//    Vorher stand dort bei einer Stunde Kundenarbeit eine zweistellige Zahl —
//    die liest sich als To-do-Liste und ist doch nur ein einziger Vorgang.
{
  const gebuendelt = buendleWebsite([
    feld('f1', 'p1', '2026-09-15T09:00:00Z'),
    feld('f2', 'p1', '2026-09-15T10:00:00Z'),
    feld('f3', 'p1', '2026-09-15T11:00:00Z'),
  ])
  check('8 ein vorgang je projekt', zaehleJeProjekt(gebuendelt).get('p1'), 1)
}

// 9. Nachrichten gehen beim Bündeln nicht verloren und werden nicht gebündelt.
{
  const nachricht: PosteingangEintrag = {
    id: 'm1',
    art: 'nachricht',
    projektId: 'p1',
    projektName: 'Testprojekt',
    titel: 'Kunde',
    seit: '2026-09-15T12:00:00Z',
    text: 'Hallo',
    alt: null,
    neu: null,
    bereich: null,
  }
  check('9 nachrichten bleiben draussen', buendleWebsite([nachricht]).length, 0)
}

// 10. Titel-Hilfe für die Anzeige.
{
  check('10a mehrzahl', cmsEinreichungTitel(4), 'Website — 4 Änderungen')
  check('10b einzahl', cmsEinreichungTitel(1), 'Website — 1 Änderung')
  check('10c null', cmsEinreichungTitel(0), 'Website — Änderungen')
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
