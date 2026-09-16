/**
 * Die Energiekurve der Ambient-Fläche (10.09.2026, zweite Fassung).
 *
 * Sie beantwortet die Frage, die auf einer reinen Terminachse nicht steht:
 * *wann bin ich heute oben?* Links neben dem Tagesverlauf läuft sie über die
 * vollen 24 Stunden mit; ein Termin, der im Tief liegt, ist damit sichtbar,
 * bevor er stattfindet.
 *
 * **Woher die Form kommt.** Sie ist der klassischen Arbeits- bzw.
 * Leistungskurve nachgebildet, wie sie in der Arbeitsphysiologie gezeichnet
 * wird (Kevins Vorlage): steiler Anstieg nach dem Aufstehen, **Hoch I** am
 * späten Vormittag als höchster Punkt des Tages, ein Tal am frühen Nachmittag,
 * **Hoch II** am frühen Abend — spürbar, aber niedriger als Hoch I —, danach
 * ein langer Abfall bis zum Minimum in den frühen Morgenstunden.
 *
 * **Das Nachmittagstal fällt bis auf die Hälfte, aber nicht in die Nacht.** In
 * der Vorlage sinkt es spürbar unter beide Hochs und bleibt doch deutlich über
 * dem Nachtwert: der Nachmittag ist ein schwächerer Teil des Tages, keine
 * zweite Nacht. Eine erste Fassung hatte es auf 0,62 gesetzt — zwischen 10 und
 * 20 Uhr lief die Kurve dann fast gerade und die ganze Form war weg.
 *
 * **Mitternacht liegt schon fast unten.** Das ist die zweite Korrektur vom
 * 11.09.: Die Achse endet bei 24:00, und wenn die Kurve dort noch ein Viertel
 * ausschlägt, sieht der Tag am unteren Rand aus, als ginge er weiter. Wer um
 * sieben aufsteht, ist um Mitternacht müde — die Kurve sagt das jetzt.
 *
 * **Warum die Stützpunkte am Aufwachen hängen und nicht an der Uhrzeit.** Der
 * ganze Verlauf ist an den Schlaf gekoppelt, nicht an die Wanduhr — wer um 7
 * aufsteht, hat sein Hoch früher als wer um 9 aufsteht. Deshalb steht hier ein
 * Versatz in Stunden *nach dem Aufwachen*, und die Aufwachstunde ist ein
 * Parameter. Kevin stellt sie auf der Fläche selbst ein; liefert eines Tages
 * ein Tracker die echte Aufwachzeit, wird sie an derselben Stelle eingesetzt
 * und die ganze Kurve wandert mit.
 */

/** Zur Auswahl auf der Fläche. Kevin steht zwischen sieben und neun auf. */
export const AUFWACH_STUNDEN = [7, 8, 9] as const

/** Womit die Fläche startet, solange nichts eingestellt ist. */
export const AUFWACH_STANDARD = 7

/** Schlüssel in `ui_settings` — die Aufwachzeit hängt am Menschen, nicht am Schirm. */
export const AUFWACH_KEY = 'ambientAufwachStunde'

/**
 * Der Verlauf als Stützpunkte: Stunden nach dem Aufwachen → Energie (0…1).
 *
 * Die Uhrzeiten in den Kommentaren gelten für ein Aufstehen um 7 Uhr; bei 8
 * oder 9 verschiebt sich alles entsprechend mit.
 */
const STUETZPUNKTE: readonly [versatzH: number, wert: number][] = [
  [-4, 0.04], // 03:00 — Minimum, tiefster Punkt des Tages
  [-2, 0.08], // 05:00
  [0, 0.3], // 07:00 — Aufwachen, der Anstieg läuft schon
  [1.5, 0.6], // 08:30
  [3, 0.88], // 10:00
  [4.5, 1.0], // 11:30 — Hoch I, höchster Punkt
  [6, 0.78], // 13:00
  [7.5, 0.5], // 14:30 — das Tal
  [8.5, 0.54], // 15:30
  [10, 0.76], // 17:00
  [11.5, 0.84], // 18:30 — Hoch II, unter Hoch I
  [13, 0.66], // 20:00
  [14.5, 0.4], // 21:30
  [16, 0.19], // 23:00
  [17, 0.12], // 00:00 — Mitternacht liegt schon fast unten
  [19, 0.05], // 02:00
  [20, 0.04], // 03:00 — schließt den Kreis bei -4
]

/** Minuten eines Tages. Die Achse zeigt genau einen. */
export const TAG_MINUTEN = 1440

/**
 * Energie zu einer Minute des Tages (0…1439) → 0…1.
 *
 * Zyklisch: die Stützpunkte werden um ±24 h gespiegelt, damit die Kurve über
 * Mitternacht ohne Sprung durchläuft. Interpoliert wird mit einer weichen
 * Hermite-Blende statt linear — eine Energiekurve mit Knicken sieht aus wie
 * ein Aktienchart, und die Fläche soll ruhig sein.
 */
export function energieBei(minute: number, aufwachStunde: number): number {
  const ziel = minute / 60 - aufwachStunde

  // Die drei Kopien decken jeden Zielwert ab, ohne Sonderfall an den Rändern.
  const punkte: [number, number][] = []
  for (const versatz of [-24, 0, 24]) {
    for (const [h, w] of STUETZPUNKTE) punkte.push([h + versatz, w])
  }

  for (let i = 0; i < punkte.length - 1; i++) {
    const [h0, w0] = punkte[i]
    const [h1, w1] = punkte[i + 1]
    if (ziel < h0 || ziel > h1) continue
    const t = h1 === h0 ? 0 : (ziel - h0) / (h1 - h0)
    const weich = t * t * (3 - 2 * t) // smoothstep
    return w0 + (w1 - w0) * weich
  }
  return STUETZPUNKTE[0][1]
}

/**
 * Der Pfad für das SVG der Verlaufsspalte.
 *
 * Koordinaten sind bewusst „x = Energie, y = Minute": die Spalte läuft von
 * oben nach unten durch den Tag, die Kurve schlägt nach rechts aus. Das SVG
 * wird mit `preserveAspectRatio="none"` auf die Spaltenhöhe gezogen — deshalb
 * ist die viewBox `0 0 100 1440` und nichts muss in Pixeln gerechnet werden.
 *
 * @param schritt Auflösung in Minuten. 10 ist bei jeder Spaltenhöhe glatt und
 *   kostet 145 Punkte statt 1440.
 */
export function energiePfad(
  aufwachStunde: number,
  /**
   * Minute → Anteil der Achsenhöhe (0…1). Die Achse ist seit dem 11.09. nicht
   * mehr gleichmäßig — die Nacht ist gestaucht —, und die Kurve muss durch
   * **dieselbe** Abbildung wie Raster und Termine. Rechnete sie weiter linear,
   * stünde ihr Hoch neben der falschen Stunde.
   */
  yAnteil: (minute: number) => number,
  schritt = 10,
  /** Nur diesen Ausschnitt zeichnen — in der Detailansicht ist alles davor
   *  und danach nicht Teil der Achse. Ohne die Grenzen klemmte die Abbildung
   *  hunderte Minuten auf dieselbe Höhe und die Kurve bekäme an beiden Enden
   *  einen senkrechten Zacken. */
  vonMin = 0,
  bisMin = TAG_MINUTEN,
): string {
  const teile: string[] = []
  for (let m = vonMin; m <= bisMin; m += schritt) {
    const x = (energieBei(m % TAG_MINUTEN, aufwachStunde) * 100).toFixed(2)
    const y = (yAnteil(m) * TAG_MINUTEN).toFixed(1)
    teile.push(`${teile.length === 0 ? 'M' : 'L'}${x} ${y}`)
  }
  // Der letzte Schritt trifft `bisMin` nur, wenn die Spanne glatt aufgeht.
  const rest = (bisMin - vonMin) % schritt
  if (rest !== 0) {
    const x = (energieBei(bisMin % TAG_MINUTEN, aufwachStunde) * 100).toFixed(2)
    teile.push(`L${x} ${(yAnteil(bisMin) * TAG_MINUTEN).toFixed(1)}`)
  }
  return teile.join(' ')
}

/** Dieselbe Kurve als geschlossene Fläche — der Schleier unter der Linie. */
export function energieFlaeche(
  aufwachStunde: number,
  yAnteil: (minute: number) => number,
  schritt = 10,
  vonMin = 0,
  bisMin = TAG_MINUTEN,
): string {
  const yEnde = (yAnteil(bisMin) * TAG_MINUTEN).toFixed(1)
  const yStart = (yAnteil(vonMin) * TAG_MINUTEN).toFixed(1)
  return `${energiePfad(aufwachStunde, yAnteil, schritt, vonMin, bisMin)} L0 ${yEnde} L0 ${yStart} Z`
}

/**
 * Die beiden Hochs, beschriftet mit ihrem Rang.
 *
 * Gesucht werden echte lokale Maxima — ein Stützpunkt, der höher liegt als
 * seine beiden Nachbarn. Eine Schwelle („alles über 0,88") träfe auch die
 * Punkte auf dem Weg nach oben und setzte drei Beschriftungen an zwei Spitzen.
 *
 * Beschriftet wird mit „Hoch I" und „Hoch II" wie in der Vorlage: mehr Text
 * auf einer Kurve, die als Stimmung gelesen wird, macht sie zur Tabelle.
 */
export function energieHochs(aufwachStunde: number): { minute: number; label: string }[] {
  const spitzen: number[] = []
  for (let i = 1; i < STUETZPUNKTE.length - 1; i++) {
    const [h, w] = STUETZPUNKTE[i]
    if (w > STUETZPUNKTE[i - 1][1] && w > STUETZPUNKTE[i + 1][1]) spitzen.push(h)
  }
  return spitzen.map((h, i) => ({
    minute: ((aufwachStunde + h) * 60 + TAG_MINUTEN) % TAG_MINUTEN,
    label: i === 0 ? 'Hoch I' : 'Hoch II',
  }))
}

/** `09:30` → 570. Ungültiges gibt `null`, damit nichts auf 00:00 rutscht. */
export function minutenAus(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const m = hhmm.match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const minute = +m[1] * 60 + +m[2]
  return minute >= 0 && minute < TAG_MINUTEN ? minute : null
}
