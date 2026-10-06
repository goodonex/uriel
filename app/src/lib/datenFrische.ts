/**
 * Wann ein offener Tab seine Listen neu holt (06.10.2026).
 *
 * **Der Fall, der das erzwang.** Am 06.10. um 12:34 stand in Kevins seit dem
 * Vortag offenem Cockpit-Tab „Prüfen 0 von 0 ✓, Erstnachrichten 0 von 0 ✓,
 * Antworten 0 von 0 ✓" — alles grün. In der Datenbank lagen 5 wartende
 * Antworten, 29 offene Looms, 14 Texte zum Prüfen und 5 fertige
 * Erstnachrichten. Der Sync lief einwandfrei; ein frisch geöffneter Tab zeigte
 * die richtigen Zahlen. Der alte Tab hatte nach dem Zuklappen des Laptops
 * (abgelaufene Anmeldung, kein Netz beim Aufwachen) einmal leer geladen — und
 * danach nie wieder nachgesehen. Kevin hat dadurch einen Tag lang heiße
 * Antworten übersehen.
 *
 * Zwei Regeln folgen daraus:
 * 1. Ein Tab holt nach, sobald Kevin zurückkommt (Fokus, Sichtbarkeit), sobald
 *    das Netz wieder da ist, sobald die Anmeldung erneuert wurde und sobald der
 *    Sync einen neuen Stand meldet — gedrosselt, damit ein Tab-Wechsel nicht
 *    jedes Mal 2.000 Zeilen zieht.
 * 2. Eine Quelle, die nicht geladen werden konnte, ist **unbekannt**, nicht
 *    leer. Das regelt `tagesFlow.ts` (`quellenUnsicher`).
 *
 * **Reine Funktionen, keine Imports** — prüfbar per
 * `npx tsx scripts/verify-daten-frische.ts`. Die Verdrahtung an Browser und
 * Supabase steht in `hooks/useNeuLadenWache.ts`.
 */

/** Woher der Anstoß zum Nachladen kommt. */
export type NeuLadenGrund =
  /** Tab wieder sichtbar oder Fenster wieder im Fokus. */
  | 'fokus'
  /** Netz zurück (`online`) — typisch nach dem Aufklappen des Laptops. */
  | 'online'
  /** Supabase hat die Anmeldung erneuert (`TOKEN_REFRESHED` / `SIGNED_IN`). */
  | 'anmeldung'
  /** Der Sync-Stand oben rechts hat sich geändert. */
  | 'sync'
  /** Kevin hat ausdrücklich „neu laden" gedrückt. */
  | 'knopf'
  /** Der ruhige Takt, solange der Tab sichtbar offen steht. */
  | 'takt'

/** Der Browser-Event, über den alle Daten-Hooks einer Seite angestoßen werden. */
export const DATEN_NEU_LADEN_EVENT = 'uriel:daten-neu-laden'

/** Nach Fokus/Sichtbarkeit frühestens so lange nach dem letzten geglückten Laden. */
export const FOKUS_ABSTAND_MS = 2 * 60_000
/** Der ruhige Takt bei sichtbarem Tab. */
export const TAKT_ABSTAND_MS = 5 * 60_000
/** Nach einem Fehler: frühestens so oft ein neuer Versuch (Fokus, Takt). */
export const FEHLER_ABSTAND_MS = 20_000
/**
 * Zwei Anstöße kurz hintereinander (Fokus + `SIGNED_IN` + `online` feuern beim
 * Aufwachen fast gleichzeitig) sollen einen Ladelauf auslösen, nicht drei.
 */
export const ENTPRELLEN_MS = 5_000

export interface LadeStand {
  /** Wann zuletzt erfolgreich geladen wurde (ms) — 0, wenn noch nie. */
  letzterErfolgMs: number
  /** Wann zuletzt ein Ladeversuch begann (ms) — 0, wenn noch nie. */
  letzterVersuchMs: number
  /** Steht die Quelle gerade auf Fehler (oder ist sie unaufgelöst)? */
  hatFehler: boolean
  /** Läuft gerade ein Ladevorgang? Dann wird nichts zusätzlich angestoßen. */
  laeuft: boolean
}

/** Soll diese Quelle auf diesen Anstoß hin neu laden? */
export function sollNeuLaden(grund: NeuLadenGrund, stand: LadeStand, jetztMs: number): boolean {
  if (stand.laeuft) return false
  const seitVersuch = jetztMs - stand.letzterVersuchMs
  const seitErfolg = jetztMs - stand.letzterErfolgMs
  switch (grund) {
    case 'knopf':
      return true
    case 'online':
    case 'anmeldung':
    case 'sync':
      return seitVersuch >= ENTPRELLEN_MS
    case 'fokus':
      return stand.hatFehler ? seitVersuch >= FEHLER_ABSTAND_MS : seitErfolg >= FOKUS_ABSTAND_MS
    case 'takt':
      return stand.hatFehler ? seitVersuch >= FEHLER_ABSTAND_MS : seitErfolg >= TAKT_ABSTAND_MS
    default:
      return false
  }
}

/**
 * Was ein Daten-Hook ohne Brand tun soll.
 *
 * - `kein-backend`: Supabase nicht konfiguriert (lokal ohne .env) — leer, kein Fehler.
 * - `laedt`: Die Brands sind noch unterwegs — unbekannt, also „lädt".
 * - `unaufgeloest`: Die Brands sind durch, aber es gibt keine Brand-ID. Das ist
 *   im Cockpit nie ein echter Leerzustand, sondern ein Lesefehler (abgelaufene
 *   Anmeldung, kein Netz). Genau dieser Zustand stand am 06.10. als „0 von 0 ✓".
 * - `bereit`: Abfragen dürfen laufen.
 */
export type BrandLage = 'kein-backend' | 'laedt' | 'unaufgeloest' | 'bereit'

export function brandLage(eingabe: {
  backend: boolean
  brandId: string | null
  brandPending: boolean
}): BrandLage {
  if (!eingabe.backend) return 'kein-backend'
  if (eingabe.brandId) return 'bereit'
  return eingabe.brandPending ? 'laedt' : 'unaufgeloest'
}

/** Der Fehlertext für `unaufgeloest` — bewusst in Kevins Sprache. */
export const BRAND_UNAUFGELOEST = 'Anmeldung oder Marke nicht geladen'

/** Eine Quelle, wie der Tages-Flow sie sieht. */
export interface QuellenStatus {
  name: string
  error: string | null | undefined
}

/**
 * Der erste Fehler unter den Quellen — `null`, wenn alle sauber geladen haben.
 * Mit Namen, damit in der Konsole steht, WELCHE Liste fehlt.
 */
export function quellenFehler(quellen: readonly QuellenStatus[]): string | null {
  const kaputt = quellen.filter((q) => q.error)
  if (kaputt.length === 0) return null
  return kaputt.map((q) => `${q.name}: ${q.error}`).join(' · ')
}
