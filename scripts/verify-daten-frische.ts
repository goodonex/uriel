/**
 * Drift-Wache für den Vorfall vom 06.10.2026 — **„leer" ist nicht „fertig"**.
 *
 * Befund: Kevins seit dem Vortag offener Cockpit-Tab zeigte um 12:34 „Prüfen
 * 0 von 0 ✓, Erstnachrichten 0 von 0 ✓, Antworten 0 von 0 ✓" — alles grün —,
 * während 5 Antworten, 29 Looms, 14 Prüf-Texte und 5 Erstnachrichten warteten.
 * Der Sync lief; ein frischer Tab zeigte die richtigen Zahlen. Der alte Tab
 * hatte nach dem Aufwachen des Laptops leer geladen (Anmeldung abgelaufen bzw.
 * Brand nicht aufgelöst) und danach nie wieder nachgesehen.
 *
 * Geprüft wird:
 * 1. Fehler → nicht erledigt, kein Einfrieren, kein „erledigt"-Vermerk.
 * 2. Brand unaufgelöst → „lädt" bzw. Warnung, nicht erledigt.
 * 3. Wann ein Tab nachlädt (Fokus gedrosselt, Netz/Anmeldung/Sync/Knopf sofort).
 * 4. Die Verdrahtung in den Hooks und auf der Seite (Struktur, wie
 *    `verify-ladezustand.ts` — Hooks lassen sich ohne DOM nicht aufrufen).
 *
 * Start: npx tsx scripts/verify-daten-frische.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BRAND_UNAUFGELOEST,
  ENTPRELLEN_MS,
  FEHLER_ABSTAND_MS,
  FOKUS_ABSTAND_MS,
  TAKT_ABSTAND_MS,
  brandLage,
  quellenFehler,
  sollNeuLaden,
  type LadeStand,
} from '../app/src/lib/datenFrische'
import {
  darfFestschreiben,
  flowQuellen,
  stufenStaende,
  type FlowEingabe,
} from '../app/src/cockpit/lib/tagesFlow'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Kommentare raus — sonst schlägt die Wache an ihrer eigenen Begründung an. */
function ohneKommentare(pfad: string): string {
  return readFileSync(join(wurzel, pfad), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(
      `FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`,
    )
  }
}

const jetzt = new Date('2026-10-06T12:34:00+02:00')

/** Genau das Bild aus dem Vorfall: alle Listen leer, Zähler auf 0. */
function leererTab(extra: Partial<FlowEingabe> = {}): FlowEingabe {
  return {
    today: {},
    ...flowQuellen({ followup: [], erstnachricht: [], loom: [], antwort: [], erstnachrichtWartend: [] }, jetzt),
    ...extra,
  }
}

const erledigtJe = (staende: ReturnType<typeof stufenStaende>) =>
  Object.fromEntries(staende.map((s) => [s.stufe.id, s.erledigt]))

// ---------------------------------------------------------------------------
// 1. Fehler → nicht erledigt.
// ---------------------------------------------------------------------------
{
  // Gegenprobe: OHNE den Schalter wird der leere Tab grün — das war der Vorfall.
  const ohne = erledigtJe(stufenStaende(leererTab()))
  check('Gegenprobe: leere Listen ohne Fehler-Schalter = grün (Antworten)', ohne.antworten, true)
  check('Gegenprobe: leere Listen ohne Fehler-Schalter = grün (Erstnachrichten)', ohne.erstnachrichten, true)

  const mit = stufenStaende(leererTab({ quellenUnsicher: true }))
  const e = erledigtJe(mit)
  for (const id of ['erstnachrichten', 'antworten', 'followups', 'looms']) {
    check(`Lesefehler: ${id} ist NICHT erledigt`, e[id], false)
    check(
      `Lesefehler: ${id} trägt die Markierung „unsicher"`,
      mit.find((s) => s.stufe.id === id)?.unsicher,
      true,
    )
  }
  // Die Anfragen hängen am Zähler aus daily_metrics, nicht an den Listen.
  check('Lesefehler: Anfragen bleiben vom Zähler bestimmt', mit.find((s) => s.stufe.id === 'anfragen')?.unsicher, undefined)

  // Auch mit einer eingefrorenen Portion > 0 und „0 offen" bleibt es offen:
  // `offenJetzt === 0` ist bei Fehler keine Aussage.
  const portion = erledigtJe(
    stufenStaende(leererTab({ quellenUnsicher: true, portionen: { antworten: 5, looms: 29 } })),
  )
  check('Lesefehler + Portion 5, „0 offen": Antworten nicht erledigt', portion.antworten, false)
  check('Lesefehler + Portion 29, „0 offen": Looms nicht erledigt', portion.looms, false)

  // Und nichts wird festgeschrieben.
  const sauber = {
    quelleLaedt: false,
    quelleFehler: null,
    zieleGeladen: true,
    portionenGeladen: true,
    portionenFehler: false,
    tableMissing: false,
  }
  check('alles geladen → Festschreiben erlaubt', darfFestschreiben(sauber), true)
  check('Quellen-Fehler → kein Einfrieren/Vermerk', darfFestschreiben({ ...sauber, quelleFehler: 'Threads: JWT expired' }), false)
  check('Quellen laden noch → kein Einfrieren/Vermerk', darfFestschreiben({ ...sauber, quelleLaedt: true }), false)
  check('Portionen nicht lesbar → kein Einfrieren', darfFestschreiben({ ...sauber, portionenFehler: true }), false)
  check('Portionen noch unterwegs → kein Einfrieren', darfFestschreiben({ ...sauber, portionenGeladen: false }), false)
  check('Ziele noch unterwegs → kein Einfrieren', darfFestschreiben({ ...sauber, zieleGeladen: false }), false)

  check('quellenFehler: alle sauber → null', quellenFehler([{ name: 'Threads', error: null }, { name: 'Netzwerk', error: undefined }]), null)
  check(
    'quellenFehler: nennt die kaputte Quelle',
    quellenFehler([{ name: 'Threads', error: null }, { name: 'Erstnachrichten', error: 'Failed to fetch' }]),
    'Erstnachrichten: Failed to fetch',
  )
}

// ---------------------------------------------------------------------------
// 2. Brand unaufgelöst → lädt bzw. Warnung, nicht erledigt.
// ---------------------------------------------------------------------------
{
  check('Brands laden noch → „laedt"', brandLage({ backend: true, brandId: null, brandPending: true }), 'laedt')
  check('Brands durch, keine ID → „unaufgeloest"', brandLage({ backend: true, brandId: null, brandPending: false }), 'unaufgeloest')
  check('Brand-ID da → „bereit"', brandLage({ backend: true, brandId: 'b1', brandPending: false }), 'bereit')
  check('ohne Supabase → kein Fehler, nur leer', brandLage({ backend: false, brandId: null, brandPending: false }), 'kein-backend')

  // Die Hooks melden `BRAND_UNAUFGELOEST` als Fehler → der Flow sieht einen
  // Quellen-Fehler → nichts ist grün, nichts wird eingefroren.
  const fehler = quellenFehler([{ name: 'Threads', error: BRAND_UNAUFGELOEST }])
  check('unaufgelöste Brand wird zum Quellen-Fehler', fehler !== null, true)
  const e = erledigtJe(stufenStaende(leererTab({ quellenUnsicher: fehler !== null })))
  check('unaufgelöste Brand: Antworten nicht erledigt', e.antworten, false)
  check('unaufgelöste Brand: Erstnachrichten nicht erledigt', e.erstnachrichten, false)
  check('unaufgelöste Brand: Looms nicht erledigt', e.looms, false)
  check(
    'unaufgelöste Brand: kein Einfrieren',
    darfFestschreiben({
      quelleLaedt: false,
      quelleFehler: fehler,
      zieleGeladen: true,
      portionenGeladen: true,
      portionenFehler: false,
      tableMissing: false,
    }),
    false,
  )
}

// ---------------------------------------------------------------------------
// 3. Wann ein offener Tab nachlädt.
// ---------------------------------------------------------------------------
{
  const t = 10_000_000
  const gesund = (vorMs: number): LadeStand => ({
    letzterErfolgMs: t - vorMs,
    letzterVersuchMs: t - vorMs,
    hatFehler: false,
    laeuft: false,
  })
  check('Fokus nach 30 s: kein Nachladen (gedrosselt)', sollNeuLaden('fokus', gesund(30_000), t), false)
  check('Fokus nach 2 min: Nachladen', sollNeuLaden('fokus', gesund(FOKUS_ABSTAND_MS), t), true)
  check('Fokus nach einer Nacht: Nachladen', sollNeuLaden('fokus', gesund(16 * 3_600_000), t), true)
  check('Takt nach 3 min: noch nicht', sollNeuLaden('takt', gesund(3 * 60_000), t), false)
  check('Takt nach 5 min: Nachladen', sollNeuLaden('takt', gesund(TAKT_ABSTAND_MS), t), true)
  check('Netz wieder da: Nachladen', sollNeuLaden('online', gesund(30_000), t), true)
  check('Anmeldung erneuert: Nachladen', sollNeuLaden('anmeldung', gesund(30_000), t), true)
  check('neuer Sync-Stand: Nachladen', sollNeuLaden('sync', gesund(30_000), t), true)
  check('Knopf: immer', sollNeuLaden('knopf', gesund(0), t), true)
  check(
    'Aufwachen: Fokus + Netz + Anmeldung kurz hintereinander → nur ein Lauf',
    sollNeuLaden('online', gesund(ENTPRELLEN_MS - 1), t),
    false,
  )
  check('läuft schon → nichts zusätzlich', sollNeuLaden('online', { ...gesund(60_000), laeuft: true }, t), false)

  const kaputt: LadeStand = { letzterErfolgMs: t - 60_000, letzterVersuchMs: t - FEHLER_ABSTAND_MS, hatFehler: true, laeuft: false }
  check('nach Fehler: Fokus versucht es gleich wieder (nicht erst nach 2 min)', sollNeuLaden('fokus', kaputt, t), true)
  check('nach Fehler: Takt versucht es wieder', sollNeuLaden('takt', kaputt, t), true)
  check(
    'nach Fehler: aber nicht im Sekundentakt',
    sollNeuLaden('fokus', { ...kaputt, letzterVersuchMs: t - 3_000 }, t),
    false,
  )
}

// ---------------------------------------------------------------------------
// 4. Verdrahtung.
// ---------------------------------------------------------------------------
const quellenHooks: Array<[string, string]> = [
  ['app/src/hooks/useLinkedinThreads.ts', 'Threads'],
  ['app/src/hooks/useErstnachrichten.ts', 'Erstnachrichten'],
  ['app/src/hooks/useLinkedinNetzwerk.ts', 'Netzwerk'],
  ['app/src/hooks/useLoomUrteile.ts', 'Loom-Urteile'],
]
for (const [pfad, was] of quellenHooks) {
  const q = ohneKommentare(pfad)
  check(`${was}: hört auf die Nachlade-Wache`, /useNeuLadenWache\(/.test(q), true)
  check(`${was}: unaufgelöste Brand wird Fehler`, /BRAND_UNAUFGELOEST/.test(q), true)
  check(`${was}: wartet auf die Brand (useBrandIdStatus)`, /useBrandIdStatus\(brandSlug\)/.test(q), true)
  check(`${was}: alter Ladelauf überschreibt keinen neuen`, /lauf !== lade\.current\.lauf/.test(q), true)
  check(`${was}: Netzfehler (throw) landet im Fehlerzustand`, /catch \(e\)/.test(q), true)
}

const wache = ohneKommentare('app/src/hooks/useNeuLadenWache.ts')
for (const [muster, was] of [
  [/'visibilitychange'/, 'Sichtbarkeit'],
  [/'focus'/, 'Fokus'],
  [/'online'/, 'Netz zurück'],
  [/TOKEN_REFRESHED/, 'Anmeldung erneuert'],
  [/onAuthStateChange/, 'Supabase-Abo'],
] as const) {
  check(`Wache hört auf ${was}`, muster.test(wache), true)
}

const brands = ohneKommentare('app/src/hooks/useBrands.ts')
check('Brands: Lesefehler wirft bekannte Brands nicht weg', /setError\(err\.message\)\s*setBrands\(\[\]\)/.test(brands), false)
check('Brands: lädt nach Fehler nach', /useNeuLadenWache\(/.test(brands), true)
check('Brands: wartet auf die Anmeldung statt „leer"', /setLoading\(!!supabase && authLaedt\)/.test(brands), true)

const portionen = ohneKommentare('app/src/cockpit/lib/useTagesPortionen.ts')
check('Portionen: Lesefehler wird gemeldet', /setFehler\(true\)/.test(portionen), true)

const flow = ohneKommentare('app/src/cockpit/lib/useTagesFlow.ts')
check('Flow: Einfrieren hängt an darfFestschreiben', /darfFestschreiben\(\{/.test(flow), true)
check('Flow: Fehler macht die Stufen unsicher', /quellenUnsicher/.test(flow), true)
check('Flow: kein zweiter, ungeschützter Schreibweg', /if \(quelleLaedt \|\| !geladen/.test(flow), false)
check('Flow: Zähl-Modus bekommt den Fehler mit', /fehler,\s*\}/.test(flow), true)

const dash = ohneKommentare('app/src/cockpit/pages/SalesDashboard.tsx')
check(
  'Sales: der Flow bekommt den Quellen-Fehler',
  /useTagesFlow\(metrics\.today, flowLive, postenLaedt \|\| metrics\.loading, posten\.quellenFehler\)/.test(dash),
  true,
)
check('Sales: Tagesliste bekommt die Warnung', /fehler=\{datenFehlen \? flow\.fehler : null\}/.test(dash), true)
check('Sales: Warnung hat „Neu laden"', /fordereNeuLaden\('knopf'\)/.test(dash), true)
check('Sales: Prüfen-Zeile wird bei Fehler nicht grün', /flow\.laedt \|\| datenFehlen \? 'offen'/.test(dash), true)
check('Sales: Zahlen bei Fehler als „–"', /datenFehlen \? '–'/.test(dash), true)

const liste = ohneKommentare('app/src/cockpit/components/sales/TagesListe.tsx')
check('Tagesliste: Text „Daten nicht geladen"', /Daten nicht geladen/.test(liste), true)
check('Tagesliste: Knopf „Neu laden"', /Neu laden/.test(liste), true)

const home = ohneKommentare('app/src/cockpit/pages/UrielHome.tsx')
check('Home: Flow bekommt den Quellen-Fehler', /posten\.quellenFehler/.test(home), true)
const zaehl = ohneKommentare('app/src/cockpit/pages/ZaehlModus.tsx')
check('Zähl-Modus: Flow bekommt den Quellen-Fehler', /live\.fehler/.test(zaehl), true)

const runde = ohneKommentare('app/src/cockpit/components/RundeTor.tsx')
check('neuer Sync-Stand oben rechts lädt die Listen nach', /fordereNeuLaden\('sync'\)/.test(runde), true)
check('„⟳"-Knopf lädt auch die Listen nach', /fordereNeuLaden\('knopf'\)/.test(runde), true)

console.log(`\nverify-daten-frische: ${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
