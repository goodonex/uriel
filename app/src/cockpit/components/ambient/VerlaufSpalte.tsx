import {
  AUFWACH_STUNDEN,
  energieFlaeche,
  energieHochs,
  energiePfad,
  minutenAus,
  TAG_MINUTEN,
} from '../../lib/energie'
import { achsenAnteil, achsenProzent, tagFenster, verteileTermine } from '../../lib/tagesachse'
import type { AmbientTermin } from '../../lib/ambient'

/**
 * Spalte 4 der Ambient-Fläche: der Tag als Achse (Neufassung 10.09.2026).
 *
 * **Was sich geändert hat und warum.** Bis heute war das hier eine Liste mit
 * Trennlinien und einer Jetzt-Marke dazwischen — die Abstände sagten nichts,
 * ein Halbstünder sah aus wie ein Halbtagestermin. Jetzt ist es eine echte
 * Zeitachse: 00:00 bis 24:00, jeder Termin sitzt an seiner Uhrzeit und ist so
 * hoch, wie er dauert. Ein Zwei-Stunden-Block ist doppelt so hoch wie ein
 * Ein-Stunden-Block, ohne dass man eine Zahl lesen muss.
 *
 * **Der Einwand der alten Fassung war richtig — und wird hier anders gelöst.**
 * Eine maßstäbliche Achse ist zwischen den Terminen leer, und ein Termin um 9
 * und einer um 18 Uhr ließen die Spalte fast leer aussehen. Die Leere trägt
 * jetzt die Energiekurve: sie läuft links durch alle 24 Stunden, auch durch
 * die Nacht. Damit ist der leere Teil des Tages nicht mehr ungenutzter Platz,
 * sondern die Aussage „hier ist nichts, und du bist hier oben/unten".
 *
 * **Die ganzen 24 Stunden — aber nicht gleichmäßig** (11.09.). Der ganze Tag
 * bleibt sichtbar, von 00 bis 24; die Nacht ist jedoch zusammengeschoben und
 * die wache Zeit bekommt fast die ganze Höhe. Vorher nahm die leere Nacht ein
 * Viertel der Spalte ein, während sich tagsüber Termine überlagerten. Die
 * Rechenregel steht in `tagesachse.ts` und gilt für **alles** in dieser Spalte:
 * Raster, Blöcke, Jetzt-Marke und Kurve.
 *
 * **Überlappende Termine liegen nebeneinander, nicht übereinander.** Zwei
 * Termine, die sich zeitlich schneiden, teilen sich die Breite — sonst verdeckt
 * der spätere den Titel des früheren, und genau das war im Bild zu sehen.
 *
 * **Gestern und morgen sind einen Klick weit weg** (zweite Fassung). Die
 * Fläche steht wochenlang offen; „was war gestern" und „was kommt morgen" sind
 * beim Blick auf den Schreibtisch genauso normale Fragen wie „was ist heute".
 * Die Jetzt-Marke erscheint dabei nur am heutigen Tag — an einem anderen Tag
 * gäbe es keinen Ort, an dem sie wahr wäre.
 */

/** Kürzer gezeichnet wird nichts — sonst ist der Titel nicht mehr lesbar. */
const DAUER_MIN_SICHTBAR = 30

/**
 * Wie eng zwei Stundenmarken stehen dürfen, in Prozent der Achsenhöhe.
 *
 * In der gestauchten Nacht liegen die Zwei-Stunden-Schritte dicht beieinander;
 * ohne diese Grenze klebten dort sechs Zahlen aufeinander. Statt die Nacht per
 * Sonderfall auszunehmen, fällt jede Marke weg, die zu nah an der vorigen
 * sitzt — das gilt dann automatisch auch für jedes andere Fenster.
 */
const MARKE_MIN_ABSTAND = 2.4

/**
 * Takt des Rasters. Zwei Stunden, nicht eine: 24 Linien untereinander sind
 * über einem Foto Unruhe, keine Ordnung — und die Termine sitzen ohnehin an
 * ihrer echten Höhe, nicht an einer Rasterlinie.
 */
const RASTER_TAKT_H = 2

/** Wie weit die Fläche blättert. Ein Tag zurück, ein Tag vor — mehr wäre ein
 *  Kalender, und den gibt es im Cockpit. */
const VERSATZ_MIN = -1
const VERSATZ_MAX = 1

function tagesName(versatz: number, datum: Date): string {
  if (versatz === 0) return 'Heute'
  if (versatz === -1) return 'Gestern'
  if (versatz === 1) return 'Morgen'
  return datum.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })
}

export function VerlaufSpalte({
  termine,
  jetztHhmm,
  tagVersatz,
  tagDatum,
  aufwachStunde,
  detail,
  laedt,
  fehler,
  basis,
  onTag,
  onAufwach,
  onDetail,
}: {
  /** Der gezeigte Tag, aufsteigend nach Uhrzeit. */
  termine: AmbientTermin[]
  /** `16:13` — für die Marke und um Vergangenes zurückzunehmen. */
  jetztHhmm: string
  /** 0 = heute, -1 = gestern, 1 = morgen. */
  tagVersatz: number
  /** Das Datum des gezeigten Tages — für die Beschriftung. */
  tagDatum: Date
  aufwachStunde: number
  /** Detailansicht: nur der Ausschnitt 06–22 Uhr, dafür auf voller Höhe. */
  detail: boolean
  laedt: boolean
  fehler: string | null
  basis: string
  onTag: (versatz: number) => void
  onAufwach: (stunde: number) => void
  onDetail: (an: boolean) => void
}) {
  const heute = tagVersatz === 0
  const jetztMin = minutenAus(jetztHhmm) ?? 0
  const hochs = energieHochs(aufwachStunde)

  /**
   * Ganztägige Termine haben keine Uhrzeit und damit keinen Platz auf einer
   * Zeitachse. Sie stehen als Zeile über der Achse — weglassen wäre der
   * schlechtere Fehler: „Urlaub" gehört in den Tag, nur nicht an 00:00.
   */
  const ganztags = termine.filter((t) => minutenAus(t.zeit) === null)

  /** Das gedehnte Fenster und die Spurverteilung — beides hängt am Tag. */
  const fenster = tagFenster(termine, detail)
  const lagen = verteileTermine(termine)
  const prozent = (minute: number) => achsenProzent(minute, fenster)

  /**
   * Achse und Fenster sind seit dem Wegfall der Stauchung dasselbe: Was gezeigt
   * wird, wird auch gedehnt. Die beiden Namen bleiben getrennt, weil Kurve,
   * Hochs und Jetzt-Marke sich am *Gezeigten* ausrichten müssen — ein Hoch
   * außerhalb der Achse klebte sonst am Rand und behauptete eine Uhrzeit, die
   * dort nicht steht.
   */
  const achseVon = fenster.von
  const achseBis = fenster.bis

  /**
   * Die Stundenmarken, ausgedünnt, wo die Achse gestaucht ist.
   *
   * Drei Marken stehen immer, auch wenn es eng wird: Anfang und Ende der Achse
   * und die Stunde, an der die Stauchung endet. Die letzte ist die wichtigste —
   * dort wechselt der Maßstab, und ohne Zahl daneben sähe es aus, als wären
   * die Stunden davor einfach verschwunden. Weicht eine gewöhnliche Marke zu
   * dicht daneben, fällt sie, nicht die Pflichtmarke.
   */
  /**
   * Welche Stunden beschriftet werden: die geraden innerhalb der Achse. Im
   * ganzen Tag sind das 00 bis 24, im Detail endet das Raster am Rand des
   * Ausschnitts — dort gäbe es 00 und 24 nicht, sie fielen auf den Rand und
   * behaupteten eine Uhrzeit, die dort nicht steht.
   */
  const ersteStunde = Math.ceil(achseVon / 60 / RASTER_TAKT_H) * RASTER_TAKT_H
  const letzteStunde = Math.floor(achseBis / 60 / RASTER_TAKT_H) * RASTER_TAKT_H
  const pflicht = new Set([ersteStunde, letzteStunde])
  const marken: { stunde: number; oben: number }[] = []
  for (let stunde = ersteStunde; stunde <= letzteStunde; stunde += RASTER_TAKT_H) {
    const oben = prozent(stunde * 60)
    const vorige = marken[marken.length - 1]
    const zuDicht = vorige !== undefined && oben - vorige.oben < MARKE_MIN_ABSTAND
    if (zuDicht) {
      if (!pflicht.has(stunde)) continue
      if (!pflicht.has(vorige.stunde)) marken.pop()
    }
    marken.push({ stunde, oben })
  }

  return (
    <div className="amb-achse-block">
      <div className="amb-achse-kopf">
        <div className="amb-tagwahl">
          <button
            type="button"
            className="amb-tagpfeil"
            onClick={() => onTag(tagVersatz - 1)}
            disabled={tagVersatz <= VERSATZ_MIN}
            aria-label="Einen Tag zurück"
          >
            ‹
          </button>
          <span className="amb-tagname">{tagesName(tagVersatz, tagDatum)}</span>
          <button
            type="button"
            className="amb-tagpfeil"
            onClick={() => onTag(tagVersatz + 1)}
            disabled={tagVersatz >= VERSATZ_MAX}
            aria-label="Einen Tag vor"
          >
            ›
          </button>
        </div>

        {/*
         * Ganzer Tag oder Ausschnitt. Der Umschalter steht neben der Tageswahl,
         * weil beides dasselbe beantwortet: *welchen* Tag und *wie viel davon*.
         */}
        <div className="amb-ansichtwahl" role="group" aria-label="Zeitausschnitt">
          <button
            type="button"
            className={`amb-wachknopf${detail ? '' : ' amb-wachknopf-an'}`}
            onClick={() => onDetail(false)}
            aria-pressed={!detail}
            title="Der ganze Tag, 00 bis 24 Uhr"
          >
            24 h
          </button>
          <button
            type="button"
            className={`amb-wachknopf${detail ? ' amb-wachknopf-an' : ''}`}
            onClick={() => onDetail(true)}
            aria-pressed={detail}
            title="Nur 06 bis 22 Uhr — dafür auf der ganzen Höhe"
          >
            Detail
          </button>
        </div>

        {/* Die Aufwachzeit verschiebt die ganze Kurve. Sie steht hier und nicht
            in einer Einstellungsseite, weil sie sich mit dem Tag ändert — und
            weil man das Ergebnis direkt daneben sieht. */}
        <div className="amb-wachwahl" role="group" aria-label="Aufgewacht um">
          <span className="amb-wachlabel">wach ab</span>
          {AUFWACH_STUNDEN.map((h) => (
            <button
              key={h}
              type="button"
              className={`amb-wachknopf${h === aufwachStunde ? ' amb-wachknopf-an' : ''}`}
              onClick={() => onAufwach(h)}
              aria-pressed={h === aufwachStunde}
              aria-label={`Aufgewacht um ${h} Uhr`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      {laedt ? <p className="amb-still">…</p> : null}
      {fehler ? <p className="amb-still">Kalender nicht erreichbar</p> : null}

      {ganztags.length > 0 ? (
        <div className="amb-ganztags">
          {ganztags.map((t) => (
            <a
              key={t.id}
              className="amb-ganztag"
              href={`${basis}/termine`}
              target="_blank"
              rel="noreferrer"
            >
              {t.titel}
            </a>
          ))}
        </div>
      ) : null}

      <div className="amb-achse">
        {/*
         * Die Energiekurve. `preserveAspectRatio="none"` zieht die viewBox auf
         * die volle Spaltenhöhe — dadurch stimmt jede y-Koordinate in Minuten
         * mit den Terminen daneben überein, ohne dass hier Pixel gerechnet
         * werden. x ist die Energie (0…100), y die Minute des Tages.
         */}
        <svg
          className="amb-energie"
          viewBox={`0 0 100 ${TAG_MINUTEN}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            className="amb-energie-flaeche"
            d={energieFlaeche(aufwachStunde, (m) => achsenAnteil(m, fenster), 10, achseVon, achseBis)}
          />
          <path
            className="amb-energie-linie"
            d={energiePfad(aufwachStunde, (m) => achsenAnteil(m, fenster), 10, achseVon, achseBis)}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Das Stundenraster — einschließlich der 24 am Fuß. Ohne sie hörte die
            Achse bei 22 auf und der Rest darunter sah aus wie Rand statt wie
            die letzten zwei Stunden des Tages. */}
        {marken.map(({ stunde, oben }) => (
          <div key={stunde} className="amb-stunde" style={{ top: `${oben}%` }}>
            <span className="amb-stunde-zahl">{String(stunde).padStart(2, '0')}</span>
            <span className="amb-stunde-linie" aria-hidden />
          </div>
        ))}

        {/* Die Hoch-Beschriftung weicht der Jetzt-Marke: beide sitzen links an
            der Kurve, und zweimal im Jahr trifft „Hoch I" genau die aktuelle
            Uhrzeit — dann standen zwei Schriften ineinander. Die Marke ist die
            wichtigere der beiden. */}
        {hochs
          // Ein Hoch außerhalb der Achse hätte keinen Ort — es klebte am Rand
          // und behauptete eine Uhrzeit, die dort nicht steht. Im ganzen Tag
          // liegt jedes Hoch auf der Achse, dort greift das nie.
          .filter((h) => h.minute >= achseVon && h.minute <= achseBis)
          .filter((h) => !heute || Math.abs(prozent(h.minute) - prozent(jetztMin)) > MARKE_MIN_ABSTAND)
          .map((h) => (
            <span key={h.minute} className="amb-hoch" style={{ top: `${prozent(h.minute)}%` }} aria-hidden>
              {h.label}
            </span>
          ))}

        {/* Die Termine. Höhe = Dauer, Breite = geteilt mit dem, was sich
            überschneidet. */}
        {lagen.map(({ termin, start, ende, breite, versatz }) => {
          // Sehr kurze Termine bekommen eine Mindesthöhe, sonst ist der Titel
          // nicht lesbar — die Dauer bleibt an der Uhrzeit ablesbar.
          const bisGezeichnet = Math.max(ende, start + DAUER_MIN_SICHTBAR)
          const oben = prozent(start)
          const hoehe = Math.max(0, prozent(Math.min(bisGezeichnet, TAG_MINUTEN)) - oben)
          // „Vorbei" und „läuft" gibt es nur heute. An einem anderen Tag ist
          // jede Uhrzeit entweder ganz vorbei oder ganz zukünftig — beides als
          // Zustand am Block zu zeigen, hieße die Jetzt-Zeit zu verlegen.
          const vorbei = (heute && ende < jetztMin) || tagVersatz < 0
          const laeuft = heute && start <= jetztMin && jetztMin < ende
          const geteilt = breite < 1
          return (
            <a
              key={termin.id}
              className={`amb-block${vorbei ? ' amb-block-vorbei' : ''}${laeuft ? ' amb-block-laeuft' : ''}${geteilt ? ' amb-block-geteilt' : ''}`}
              style={{
                top: `${oben}%`,
                height: `${hoehe}%`,
                left: `calc(var(--amb-achse-links) + (100% - var(--amb-achse-links)) * ${versatz})`,
                width: `calc((100% - var(--amb-achse-links)) * ${breite})`,
              }}
              href={`${basis}/termine`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="amb-block-titel">{termin.titel}</span>
              <span className="amb-block-zeit">{termin.zeit}</span>
            </a>
          )
        })}

        {/* Die Jetzt-Marke sitzt an ihrer echten Höhe, nicht zwischen zwei
            Einträgen — auf einer maßstäblichen Achse geht das endlich. Nur
            heute: an einem anderen Tag gäbe es kein „jetzt" auf dieser Achse. */}
        {heute && jetztMin >= achseVon && jetztMin <= achseBis ? (
          <div className="amb-jetzt-marke" style={{ top: `${prozent(jetztMin)}%` }}>
            <span className="amb-jetzt-zeit">{jetztHhmm}</span>
            <span className="amb-jetzt-linie" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  )
}
