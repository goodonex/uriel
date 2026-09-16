/**
 * Datums-Helfer für die Tages-Metriken — bewusst ein Blatt-Modul ohne React-
 * oder Supabase-Import, damit die Wochen-/Monatslogik in scripts/verify-*.ts
 * ohne Vite-Umgebung geprüft werden kann.
 *
 * `useDailyMetrics` re-exportiert alles davon; bestehende Import-Pfade bleiben
 * gültig.
 */

/**
 * Der Metrik-Tag wechselt um Mitternacht (seit 11.09.2026).
 *
 * **Vorher standen hier 4 Uhr** — mit der Begründung, Kevin arbeite nachweislich
 * nach Mitternacht, ein Loom um 0:30 gehöre zu seinem „gestern". In der Nutzung
 * war der Preis größer als der Gewinn: Am 10.09. stand die Tagesliste nach
 * Mitternacht noch auf „40 von 40" — abgearbeitet, grün, und keine Zeile, die
 * den neuen Tag angekündigt hätte. Wer um 0:30 an den Rechner geht, liest das
 * als „das System hängt", nicht als „das ist noch gestern".
 *
 * Dazu kam eine zweite Wahrheit im Haus: Der Runner (`morgenbriefInput.mjs`)
 * rechnet in Kalendertagen. Mit 4 Uhr wichen App und Runner nachts um einen Tag
 * voneinander ab; jetzt nicht mehr.
 *
 * **Was die Umstellung kostet:** Arbeit zwischen 0 und 4 Uhr zählt auf den neuen
 * Tag. Der eben vergangene Tag ist ab Mitternacht abgeschlossen — nachgereichte
 * Haken retten seine Streak nicht mehr, dafür gibt es das rückwirkende Eintragen
 * im Tracking (`bumpOn`).
 *
 * Die Grenze gilt überall, wo `daily_metrics` gelesen oder geschrieben wird —
 * EINE Tageswahrheit, kein zweiter Kalender daneben. Wer sie verschiebt, ändert
 * auch, wann `useMetrikTag` die Flächen umschaltet; beides hängt an dieser Zahl.
 */
export const METRIK_TAG_WECHSEL_STUNDE = 0

/** Das Datum, auf das JETZT gebucht und gelesen wird — mit der Grenze oben. */
export function heutigesMetrikDatum(jetzt: Date = new Date()): string {
  return toIsoDate(new Date(jetzt.getTime() - METRIK_TAG_WECHSEL_STUNDE * 60 * 60 * 1000))
}

/**
 * Der nächste Zeitpunkt, an dem `heutigesMetrikDatum()` etwas anderes sagt.
 *
 * Gerechnet wird über `setDate`/`setHours` in Ortszeit, nicht über „+24 Stunden":
 * An den zwei Umstellungstagen im Jahr hat der Tag 23 bzw. 25 Stunden, und ein
 * Timer auf 24 Stunden läge dann eine Stunde falsch — genau in der Nacht, in der
 * niemand nachsieht.
 */
export function naechsterTageswechsel(jetzt: Date = new Date()): Date {
  const grenze = new Date(jetzt)
  grenze.setHours(METRIK_TAG_WECHSEL_STUNDE, 0, 0, 0)
  if (grenze.getTime() <= jetzt.getTime()) grenze.setDate(grenze.getDate() + 1)
  return grenze
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Montag der Woche von `d` (de: Woche beginnt Montag). */
export function mondayOf(d: Date): Date {
  const copy = new Date(d)
  const day = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Zeilen der Woche von `now` (Mo–So) aus dem GANZEN Ladefenster.
 *
 * Bewusst NICHT aus `monthRows` gefiltert: eine Woche, die über die
 * Monatsgrenze läuft (z. B. Sa 01.08.2026 — Montag war der 27.07.), verlöre
 * sonst ihre Mo–Fr-Tage und die Vitals fielen auf ~0 zurück.
 */
export function weekRowsOf<T extends { datum: string }>(rows: T[], now: Date = new Date()): T[] {
  const monday = mondayOf(now)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const mondayIso = toIsoDate(monday)
  const sundayIso = toIsoDate(sunday)
  return rows.filter((r) => r.datum >= mondayIso && r.datum <= sundayIso)
}
