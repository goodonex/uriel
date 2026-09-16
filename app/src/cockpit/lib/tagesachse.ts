import { minutenAus, TAG_MINUTEN } from './energie'
import type { AmbientTermin } from './ambient'

/**
 * Die Zeitachse des Tagesverlaufs (11.09.2026).
 *
 * **Zwei Ansichten, klar getrennt.**
 *
 * - **Ganzer Tag** — 00 bis 24 Uhr, vollkommen gleichmäßig. Jede Stunde ist
 *   gleich hoch, auch die leeren der Nacht. Das ist die ehrliche Darstellung
 *   eines Tages und die, von der man nichts wissen muss, um sie zu lesen.
 * - **Detail** — 06 bis 22 Uhr auf der ganzen Höhe. Sechzehn Stunden statt
 *   vierundzwanzig ergeben rund die Hälfte mehr Platz je Stunde; die Blöcke
 *   hören auf, sich zu berühren.
 *
 * **Eine verworfene Zwischenstufe, damit sie niemand wieder einbaut.** Der
 * ganze Tag hatte zwischendurch eine *gestauchte Nacht*: 00–06 Uhr auf 7 % der
 * Höhe, der Rest gedehnt. Das löste dasselbe Platzproblem, sah aber falsch aus
 * — sechs Stunden auf einem Daumenbreit, direkt daneben zwei Stunden auf dem
 * Dreifachen. Kevins Urteil: *„verändert diese vierundzwanzig Stunden nicht,
 * du sollst nur die Detailansicht dazupacken."* Er hat recht: Eine Ansicht, die
 * heimlich zwei Maßstäbe mischt, ist schlechter als zwei Ansichten, die je
 * einen ehrlich zeigen. Die Stauchung ist deshalb weg, und der Umschalter
 * macht die Wahl sichtbar.
 *
 * **Warum kein Scrollen und kein Aufklappen beim Darüberfahren.** Beides war
 * erwogen. Scrollen setzt voraus, dass jemand scrollt — auf einem Wallpaper ist
 * der Blick die einzige Bedienung, und was man erst holen muss, ist nicht da.
 * Aufklappen beim Darüberfahren macht die Fläche unruhig (Kevins eigener
 * Einwand) und funktioniert in Plash ohnehin erst im Browsing Mode.
 *
 * **Das Detail-Fenster wächst mit den Terminen.** Wer einen Sechs-Uhr-Flug im
 * Kalender hat, soll ihn nicht verlieren, wenn er auf Detail schaltet: liegt
 * ein Termin außerhalb von 06–22, dehnt sich der Ausschnitt bis zu ihm.
 */

/**
 * Ohne Endzeit im Kalender: so lang gilt ein Termin.
 *
 * Steht hier und nicht in der Komponente, weil Fenster und Spurverteilung
 * dieselbe Annahme brauchen wie die gezeichnete Höhe — zwei Stellen mit je
 * einer eigenen Standarddauer ergäben Blöcke, die woanders enden, als die
 * Verteilung glaubt.
 */
export const DAUER_STANDARD_MIN = 60

/** Schlüssel in `ui_settings`: ganzer Tag oder Ausschnitt. */
export const DETAIL_KEY = 'ambientTagDetail'

/**
 * Der Ausschnitt der **Detailansicht**: 06 bis 22 Uhr, ohne Nachtstreifen.
 *
 * Kevins Idee (11.09.): *„dann hätte man einfach noch mal viel mehr Platz, das
 * würde das Ganze alles so schön auseinanderziehen."* Stimmt — sechzehn
 * Stunden auf der vollen Höhe statt vierundzwanzig auf 86 % sind rund ein
 * Drittel mehr Platz je Stunde, und die Blöcke hören auf, sich zu berühren.
 *
 * Der Ausschnitt ist ein **Mindest**maß, kein Schnitt: liegt ein Termin um 5
 * oder um 23 Uhr, dehnt sich das Fenster wie im ganzen Tag auch bis zu ihm.
 * Eine Ansicht, in der Termine verschwinden, wäre keine Detailansicht.
 */
const DETAIL_VON_MIN = 6 * 60
const DETAIL_BIS_MIN = 22 * 60

/** Luft um den frühesten/spätesten Termin, wenn er das Fenster aufdehnt. */
const PUFFER_MIN = 30

/**
 * Der gezeigte Zeitraum. Seit die Stauchung weg ist, ist die Abbildung
 * innerhalb dieses Bereichs schlicht linear — `obenAnteil`/`tagAnteil` sind
 * nicht mehr nötig und deshalb auch nicht mehr da.
 */
export interface TagFenster {
  /** Erste gezeigte Minute. */
  von: number
  /** Letzte gezeigte Minute. */
  bis: number
}

/**
 * Welcher Zeitraum gezeigt wird.
 *
 * Ganzer Tag: immer 00 bis 24 Uhr, ohne Wenn und Aber. Detail: 06 bis 22 Uhr,
 * ausgedehnt auf jeden Termin, der davor beginnt oder danach endet.
 */
export function tagFenster(
  termine: AmbientTermin[],
  /** Detailansicht: nur der Ausschnitt, dafür auf der ganzen Höhe. */
  detail = false,
): TagFenster {
  if (!detail) return { von: 0, bis: TAG_MINUTEN }

  let von = DETAIL_VON_MIN
  let bis = DETAIL_BIS_MIN
  for (const t of termine) {
    const start = minutenAus(t.zeit)
    if (start === null) continue
    von = Math.min(von, Math.max(0, start - PUFFER_MIN))
    bis = Math.max(bis, Math.min(TAG_MINUTEN, start + (t.dauerMin ?? DAUER_STANDARD_MIN) + PUFFER_MIN))
  }
  return { von, bis }
}

/**
 * Minute des Tages → Anteil der Achsenhöhe (0…1).
 *
 * Linear innerhalb des gezeigten Zeitraums. **Jedes** Element der Spalte muss
 * durch diese Funktion — Raster, Termine, Jetzt-Marke und die Energiekurve.
 * Rechnet eines davon mit einer eigenen Formel, sitzt es gegenüber allen
 * anderen verschoben, und das fällt erst auf, wenn ein Termin neben der
 * falschen Stunde steht.
 */
export function achsenAnteil(minute: number, f: TagFenster): number {
  const spanne = f.bis - f.von
  if (spanne <= 0) return 0
  return Math.min(1, Math.max(0, (minute - f.von) / spanne))
}

/** Dasselbe als Prozentwert für `style.top`. */
export function achsenProzent(minute: number, f: TagFenster): number {
  return achsenAnteil(minute, f) * 100
}

/** Ein Termin mit seinem Platz auf der Achse. */
export interface TerminLage {
  termin: AmbientTermin
  start: number
  ende: number
  /** Anteil der Spaltenbreite, den dieser Block bekommt (0…1). */
  breite: number
  /** Linker Rand als Anteil der Spaltenbreite (0…1). */
  versatz: number
}

/**
 * Termine so anordnen, dass sich überlappende Blöcke **nebeneinander** legen
 * statt übereinander.
 *
 * Das ist Kevins eigentliche Beanstandung: zwei Termine, die sich zeitlich
 * schneiden, lagen als zwei Kästen übereinander, der spätere verdeckte den
 * Titel des früheren. Ein Kalender löst das seit jeher so — die sich
 * überschneidenden Termine teilen sich die Breite.
 *
 * Verfahren: Termine, die sich (auch über Zwischenglieder) überschneiden,
 * bilden eine Gruppe. Innerhalb der Gruppe bekommt jeder Termin die erste
 * Spur, die zu seiner Startzeit frei ist; die Gruppe teilt die Breite durch
 * ihre Spurenzahl. Termine, die sich mit niemandem schneiden, behalten die
 * volle Breite — der Normalfall soll nicht dafür bezahlen, dass es Ausnahmen
 * gibt.
 */
export function verteileTermine(termine: AmbientTermin[]): TerminLage[] {
  const sortiert = termine
    .map((termin) => {
      const start = minutenAus(termin.zeit)
      return start === null ? null : { termin, start, ende: start + (termin.dauerMin ?? DAUER_STANDARD_MIN) }
    })
    .filter((e): e is { termin: AmbientTermin; start: number; ende: number } => e !== null)
    .sort((a, b) => a.start - b.start || b.ende - a.ende)

  const lagen: TerminLage[] = []
  let gruppe: typeof sortiert = []
  /** Wann die jeweilige Spur wieder frei wird. */
  let spurEnde: number[] = []
  let spurJeIndex: number[] = []

  const gruppeAbschliessen = () => {
    const spuren = spurEnde.length || 1
    gruppe.forEach((e, i) => {
      lagen.push({ ...e, breite: 1 / spuren, versatz: spurJeIndex[i] / spuren })
    })
    gruppe = []
    spurEnde = []
    spurJeIndex = []
  }

  for (const e of sortiert) {
    // Nichts läuft mehr: die bisherige Gruppe ist abgeschlossen.
    if (gruppe.length > 0 && e.start >= Math.max(...spurEnde)) gruppeAbschliessen()

    let spur = spurEnde.findIndex((ende) => ende <= e.start)
    if (spur === -1) {
      spur = spurEnde.length
      spurEnde.push(e.ende)
    } else {
      spurEnde[spur] = e.ende
    }
    gruppe.push(e)
    spurJeIndex.push(spur)
  }
  if (gruppe.length > 0) gruppeAbschliessen()

  return lagen
}
