/**
 * Drift-Wache für den Phasen-Ring (20.09.2026).
 *
 * Der Ring darf nur so lange neben dem Funnel stehen, wie er dieselbe Wahrheit
 * zeigt. Drei Invarianten halten das:
 *
 * 1. **Jede Karte liegt in genau einer Phase.** Fehlt eine, verschwinden Leute
 *    lautlos aus dem Ring; liegt eine in zweien, ist die Summe größer als der
 *    Bestand — beides genau der Fehler, den `funnelKarten.ts` eine Ebene tiefer
 *    schon verbietet.
 * 2. **Die Summe der Phasen ist die Summe der Karten.** Der Ring rechnet nicht
 *    nach, er summiert.
 * 3. **Die Phasen laufen in der Reihenfolge des Bauplans.** Wer den Bauplan
 *    umsortiert, soll es hier merken und nicht an einem Kreis, der plötzlich
 *    rückwärts läuft.
 *
 * Start: npx tsx scripts/verify-funnel-phasen.ts
 */
import { FUNNEL_BAUPLAN, type FunnelKarte, type FunnelKartenId } from '../app/src/cockpit/lib/funnelKarten'
import { PHASEN_PLAN, funnelPhasen, phasenSumme } from '../app/src/cockpit/lib/funnelPhasen'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const BAUPLAN_IDS = FUNNEL_BAUPLAN.map((b) => b.id)
const PHASEN_IDS = PHASEN_PLAN.flatMap((p) => p.karten)

/** Karten mit erfundenen, aber plausiblen Beständen — die Zahlen sind egal,
 *  nur ihre Summe zählt. */
function karten(): FunnelKarte[] {
  return FUNNEL_BAUPLAN.map((bau, i) => ({
    id: bau.id,
    titel: bau.titel,
    bestand: (i + 1) * 3,
    heuteFaellig: i % 4 === 0 ? i + 1 : 0,
    soll: null,
    erledigtHeute: null,
    stufenId: bau.stufenId,
    vorlage: bau.vorlage,
    zweig: bau.zweig,
  }))
}

{
  const fehlend = BAUPLAN_IDS.filter((id) => !PHASEN_IDS.includes(id))
  check('jede Karte des Bauplans hat eine Phase', fehlend.length === 0, fehlend.join(', '))

  const unbekannt = PHASEN_IDS.filter((id) => !BAUPLAN_IDS.includes(id as FunnelKartenId))
  check('keine Phase nennt eine Karte, die es nicht gibt', unbekannt.length === 0, unbekannt.join(', '))

  const doppelt = PHASEN_IDS.filter((id, i) => PHASEN_IDS.indexOf(id) !== i)
  check('keine Karte liegt in zwei Phasen', doppelt.length === 0, doppelt.join(', '))
}

{
  const k = karten()
  const phasen = funnelPhasen(k)
  const summeKarten = k.reduce((s, x) => s + x.bestand, 0)
  check(
    'die Summe der Phasen ist die Summe der Karten',
    phasenSumme(phasen) === summeKarten,
    `${phasenSumme(phasen)} vs ${summeKarten}`,
  )
  check(
    'heute-dran wird genauso durchgereicht',
    phasen.reduce((s, p) => s + p.heuteFaellig, 0) === k.reduce((s, x) => s + x.heuteFaellig, 0),
  )
  check('jede Phase aus dem Plan kommt im Ergebnis vor', phasen.length === PHASEN_PLAN.length)
  check(
    'jede Phase traegt ihre Karten mit',
    phasen.every((p) => p.karten.length === (PHASEN_PLAN.find((x) => x.id === p.id)?.karten.length ?? -1)),
  )
}

{
  // Die erste Karte jeder Phase, in Bauplan-Positionen gelesen, muss steigen.
  const positionen = PHASEN_PLAN.map((p) => BAUPLAN_IDS.indexOf(p.karten[0]))
  check(
    'die Phasen laufen in der Reihenfolge des Bauplans',
    positionen.every((pos, i) => i === 0 || positionen[i - 1] < pos),
    JSON.stringify(positionen),
  )
}

{
  const farben = PHASEN_PLAN.map((p) => p.farbe)
  check('jede Phase hat ihre eigene Farbe', new Set(farben).size === farben.length)
  check(
    'genau eine Phase steht ausserhalb des Funnels',
    PHASEN_PLAN.filter((p) => !p.imFunnel).length === 1,
  )
}

{
  const leer = funnelPhasen([])
  check('ohne Karten steht ueberall 0', leer.every((p) => p.bestand === 0 && p.heuteFaellig === 0))
  check('ohne Karten bleiben die Phasen trotzdem vollzaehlig', leer.length === PHASEN_PLAN.length)
}

console.log(`\nverify-funnel-phasen: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
