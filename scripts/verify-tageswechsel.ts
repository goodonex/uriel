/**
 * Verifikation für den Tageswechsel um Mitternacht (11.09.2026).
 *
 * **Der Vorfall.** In der Nacht zum 11.09. stand die Tagesliste nach Mitternacht
 * weiter auf „40 von 40". Zwei Ursachen, beide hier festgenagelt:
 *
 * 1. Die Metrik-Grenze lag auf 4 Uhr — nach Mitternacht war „heute" absichtlich
 *    noch der Vortag. Sie liegt jetzt auf 0 Uhr, gleichgezogen mit dem Runner,
 *    der ohnehin in Kalendertagen rechnet (`morgenbriefInput.mjs`).
 * 2. Niemand hat die Rechnung nach Mitternacht noch einmal angestellt:
 *    `heutigesMetrikDatum()` lief beim Rendern, und ein über Nacht offener Tab
 *    rendert nicht. Dafür gibt es `useMetrikTag` — eine Uhr, die genau auf der
 *    Grenze weckt.
 *
 * Geprüft wird die reine Datumsrechnung plus die Frage, ob die Flächen wirklich
 * an der Uhr hängen (Quelltext-Lesung — der Hook selbst braucht React und ist
 * ohne Vite-Umgebung nicht importierbar).
 *
 * Start: npx tsx scripts/verify-tageswechsel.ts
 */
import { readFileSync } from 'node:fs'
import {
  METRIK_TAG_WECHSEL_STUNDE,
  heutigesMetrikDatum,
  naechsterTageswechsel,
} from '../app/src/cockpit/lib/metricsDates'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(
      `FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`,
    )
  }
}

/** Ortszeit, denn die Tagesrechnung ist bewusst lokal. */
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s)

// 1. Die Grenze selbst — die Zahl, an der alles hängt.
check('1 Tagesgrenze liegt auf Mitternacht', METRIK_TAG_WECHSEL_STUNDE, 0)

// 2. Der Kern des Vorfalls: um 0:01 ist ein neuer Tag, nicht mehr der alte.
check('2a 10.09. 23:59 → 10.09.', heutigesMetrikDatum(at(2026, 9, 10, 23, 59, 59)), '2026-09-10')
check('2b 11.09. 00:00 → 11.09.', heutigesMetrikDatum(at(2026, 9, 11, 0, 0, 0)), '2026-09-11')
check('2c 11.09. 00:30 → 11.09.', heutigesMetrikDatum(at(2026, 9, 11, 0, 30, 0)), '2026-09-11')
check(
  '2d 11.09. 03:59 → 11.09. (mit der alten 4-Uhr-Grenze wäre es der 10.)',
  heutigesMetrikDatum(at(2026, 9, 11, 3, 59, 0)),
  '2026-09-11',
)

// 3. Wann weckt die Uhr? Immer auf der nächsten Grenze, nie in der Vergangenheit.
{
  check(
    '3a mittags → die kommende Mitternacht',
    naechsterTageswechsel(at(2026, 9, 10, 12, 0, 0)).toISOString(),
    at(2026, 9, 11, 0, 0, 0).toISOString(),
  )
  check(
    '3b 23:59 → eine Minute später',
    naechsterTageswechsel(at(2026, 9, 10, 23, 59, 0)).getTime() - at(2026, 9, 10, 23, 59, 0).getTime(),
    60_000,
  )
  // Genau AUF der Grenze muss der nächste Termin der Folgetag sein — sonst
  // plante der Hook auf „jetzt" und liefe in eine Schleife.
  check(
    '3c exakt 0:00 → der Folgetag',
    naechsterTageswechsel(at(2026, 9, 11, 0, 0, 0)).toISOString(),
    at(2026, 9, 12, 0, 0, 0).toISOString(),
  )
  const weck = naechsterTageswechsel(at(2026, 9, 10, 12, 0, 0))
  check('3d der Weckruf liegt in der Zukunft', weck.getTime() > at(2026, 9, 10, 12, 0, 0).getTime(), true)
}

// 4. Sommerzeit: Der Tag der Umstellung hat 23 Stunden. Ein Timer auf „+24h"
//    läge eine Stunde falsch — in einer Nacht, in der niemand nachsieht.
{
  const start = at(2026, 3, 29, 0, 0, 0) // Beginn der Sommerzeit in DE
  const naechster = naechsterTageswechsel(start)
  check('4a nächster Wechsel ist der 30.03.', naechster.toISOString(), at(2026, 3, 30, 0, 0, 0).toISOString())
  const stunden = (naechster.getTime() - start.getTime()) / 3_600_000
  check('4b der Umstellungstag hat 23 Stunden', stunden, 23)
}

// 4c. Die Mechanik des Hooks durchgespielt: Weckruf → neuer Tag → neuer Weckruf.
//     Der Fall, der am teuersten wäre, ist ein Weckruf, der denselben Tag
//     zurückgibt — dann plante sich die Uhr im Kreis, ohne je umzuschalten.
{
  const PUFFER_MS = 1_500 // dieselbe Zahl wie in useMetrikTag
  let uhr = at(2026, 9, 10, 21, 30, 0)
  const gesehen = [heutigesMetrikDatum(uhr)]
  const termine: number[] = []
  for (let i = 0; i < 3; i++) {
    const weck = new Date(naechsterTageswechsel(uhr).getTime() + PUFFER_MS)
    termine.push(weck.getTime())
    uhr = weck
    gesehen.push(heutigesMetrikDatum(uhr))
  }
  check('4c1 jeder Weckruf bringt den nächsten Tag', gesehen, [
    '2026-09-10',
    '2026-09-11',
    '2026-09-12',
    '2026-09-13',
  ])
  check(
    '4c2 die Weckrufe laufen strikt vorwärts (keine Schleife)',
    termine.every((t, i) => i === 0 || t > termine[i - 1]),
    true,
  )
}

// 5. Hängen die Flächen wirklich an der Uhr? Ein direkter `heutigesMetrikDatum()`
//    im Render-Körper ist genau der Fehler vom 10.09.: die Zahl stimmt, aber
//    niemand rechnet sie nach Mitternacht neu.
{
  const flaechen = [
    'app/src/cockpit/lib/useDailyMetrics.ts',
    'app/src/cockpit/lib/useTagesFlow.ts',
    'app/src/cockpit/lib/useIdentityCheckin.ts',
    'app/src/cockpit/pages/SalesDashboard.tsx',
    'app/src/cockpit/pages/TrackingArea.tsx',
  ]
  /** Kommentare fliegen raus — sie DÜRFEN den alten Weg erwähnen, nur der Code nicht. */
  const ohneKommentare = (quelle: string) =>
    quelle
      .split('\n')
      .filter((z) => !/^\s*(\/\/|\/\*|\*)/.test(z))
      .join('\n')
  for (const pfad of flaechen) {
    const quelle = readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8')
    check(`5 ${pfad} nutzt useMetrikTag`, quelle.includes('useMetrikTag()'), true)
    check(
      `5 ${pfad} rechnet den Tag nicht selbst`,
      /heutigesMetrikDatum\(\)|toIsoDate\(new Date\(\)\)/.test(ohneKommentare(quelle)),
      false,
    )
  }
  // Der Hook selbst muss die Grenze LESEN, nicht nachbauen.
  const hook = readFileSync(new URL('../app/src/cockpit/lib/useMetrikTag.ts', import.meta.url), 'utf8')
  check('5 der Hook nutzt naechsterTageswechsel', hook.includes('naechsterTageswechsel()'), true)
  // Aufwachen nach Sleep: ein angehaltener Timer allein genügt nicht.
  check('5 der Hook prüft beim Sichtbarwerden', hook.includes('visibilitychange'), true)
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
