import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAmbientKennzahlen, type AmbientKennzahl } from '../../hooks/useAmbientKennzahlen'
import { useAmbientOffen } from '../../hooks/useAmbientOffen'
import { useTaskBuckets, useTasks } from '../../hooks/useTasks'
import { useWidersprueche } from '../../hooks/useWidersprueche'
import { BestandZeile } from '../components/ambient/BestandZeile'
import { KalenderSpalte } from '../components/ambient/KalenderSpalte'
import { LageSpalte } from '../components/ambient/LageSpalte'
import { MonatsZiel } from '../components/ambient/MonatsZiel'
import { MenueLeiste } from '../components/ambient/MenueLeiste'
import { VerlaufSpalte } from '../components/ambient/VerlaufSpalte'
import { ZaehlerSpalte, type AmbientZaehler } from '../components/ambient/ZaehlerSpalte'
import { ActiveBrandProvider, useActiveBrand } from '../lib/activeBrand'
import {
  ambientZeilen,
  datumsZeile,
  grussFuer,
  type AmbientTermin,
  type AmbientZeile,
} from '../lib/ambient'
import { AUFWACH_KEY, AUFWACH_STANDARD } from '../lib/energie'
import { currentSoll, monthKeyOf, monthTargetFor } from '../lib/goals'
import { sumField } from '../lib/metricsAggregate'
import { useMonthGoal } from '../lib/useMonthGoal'
import { DETAIL_KEY } from '../lib/tagesachse'
import { CALENDAR_ICAL_KEY, useCalendarFeed } from '../lib/useCalendarFeed'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useSpaltenBreiten } from '../lib/useSpaltenBreiten'
import { stufeFuerFeld, TAGES_FLOW_ZIELE, type StufenId, type ZielUeberschreibung } from '../lib/tagesFlow'
import { useUiSetting } from '../lib/uiSettings'
import { ZAEHL_FELDER } from '../lib/zaehlFelder'
import type { MetricField } from '../lib/metrikFelder'
import '../../styles/ambient.css'

/**
 * Die Ambient-Fläche — Uriels Schreibtisch (10.09.2026).
 *
 * Vier Spalten über der Quiraing-Szene, angezeigt von Plash als
 * Desktop-Hintergrund (`file://` kann Plash nicht — der Vite-Server ist
 * Voraussetzung, nicht Umweg):
 *
 * 1. **Offen** — Widersprüche des Wächters und fällige Aufgaben
 * 2. **Bestand + Tageszähler** — der Vorrat aus den Runner-Spiegeln, darunter
 *    was heute davon rausgegangen ist
 * 3. **Monat** — Tageszahl und Monatsblatt
 * 4. **Verlauf** — der Tag als maßstäbliche 24-Stunden-Achse mit Energiekurve
 *
 * Links davor die **Menüleiste** (10.09.): der Weg *in* Uriel hinein und zu den
 * Orten draußen (LinkedIn, Sales Navigator, Notion- und Google-Kalender). Sie
 * ist zugeklappt 52 px breit und öffnet beim Darüberfahren.
 *
 * **Was die Fläche seit dem 10.09. nicht mehr tut:** Termine zweimal zeigen
 * (die Liste in Spalte 2 ist entfallen, der Verlauf zeigt sie maßstäblich) und
 * ein `+` an Zeilen hängen, die man nicht zählt, sondern abarbeitet —
 * Erstnachrichten, Antworten und Follow-ups öffnen ihre Liste in einem eigenen
 * Fenster, weil Kevin den Text herauskopieren muss, bevor irgendetwas
 * hochzuzählen wäre.
 *
 * **Die Klick-Regel, an der alles hängt.** Ein normaler Link würde die
 * Plash-Fläche selbst navigieren — dann steht das Cockpit auf dem Schreibtisch
 * und das Dashboard ist weg. Was *hier* passiert (abhaken, zählen, Spalten
 * ziehen), bleibt in der Fläche; was *woanders* passiert, öffnet mit
 * `target="_blank"` im Browser. Klickbar wird das Ganze erst in Plashs
 * Browsing Mode — der ist ein Zustand, kein Moment.
 *
 * **Was drei Fassungen davor schieflief, damit es niemand wiederholt:**
 *
 * 1. Nur `foundation_tasks` gelesen → „Nichts offen", während vier Befunde
 *    offen standen. Kevins offene Punkte entstehen als Widerspruch zwischen
 *    zwei Datenständen, selten als Aufgabe.
 * 2. Eine Textspalte auf einem Foto: nichts zu tun, nur zu lesen. Ein
 *    Wallpaper, das nur anzeigt, ist ein Poster.
 * 3. Das Tagesziel aus `ZAEHL_FELDER` gezeigt — das ist der **Standardwert**.
 *    Kevins eigene Ziele liegen in `ui_settings` unter `TAGES_FLOW_ZIELE`
 *    (Migration 0068) und werden hier jetzt darübergelegt. Ohne das stand bei
 *    40 Anfragen „40/30" statt „40/40".
 *
 * Werte aus `docs/phase2/DESIGN-TOKENS.md` (eingefroren): Salbei als einziger
 * Akzent, gedämpftes Gold für Dringendes, **nie Rot**.
 */

/** Was die Zähler-Spalte trägt, ohne zur Tabelle zu werden. */
const ZAEHLER_AUF_FLAECHE = 5

/**
 * Startaufteilung der vier Spalten; Kevin zieht sie sich zurecht.
 *
 * Seit dem 10.09. bekommt der Tagesverlauf am meisten: er trägt jetzt eine
 * maßstäbliche 24-Stunden-Achse mit Terminblöcken und der Energiekurve. Die
 * zweite Spalte gibt entsprechend ab — ihre Terminliste ist entfallen.
 */
const SPALTEN_STANDARD = [1.3, 0.95, 0.8, 1.3]

/**
 * Welche Stufen einen Arbeitsort statt eines Plus bekommen (10.09.2026).
 *
 * Kevins Satz: *„in der Oberfläche werde ich nie bei den Erstnachrichten Plus
 * machen oder die abhaken, weil ich sie mir ja erst mal rauskopieren muss."*
 * Genau diese drei Stufen haben in `tagesFlow.ts` auch kein festes Tagesziel —
 * ihr Soll steht in einer Liste, nicht in einer Zahl. Wer hier eine Stufe
 * einträgt, tauscht ihr `+` gegen den Weg in die Liste.
 *
 * `?kachel=` öffnet im Sales-Dashboard direkt das zuständige Fenster.
 */
const ARBEITSORT: Partial<Record<StufenId, string>> = {
  erstnachrichten: '/sales?kachel=erstnachrichten',
  antworten: '/sales?kachel=antworten',
  followups: '/sales?kachel=followups',
}

/** `2026-09-10` für einen Tagesversatz ab heute. */
function tagesSchluessel(jetzt: Date, plusTage: number): string {
  const d = new Date(jetzt)
  d.setDate(d.getDate() + plusTage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AmbientAnsicht({
  gruss,
  datum,
  zeilen,
  rest,
  gesamt,
  monat,
  termine,
  tagVersatz,
  tagDatum,
  aufwachStunde,
  detail,
  termineLaden,
  termineFehler,
  tageMitTerminen,
  zaehler,
  kennzahlen,
  jetzt,
  jetztHhmm,
  laedt,
  alsWallpaper,
  basis,
  onErledigt,
  onZaehl,
  onTag,
  onAufwach,
  onDetail,
}: {
  gruss: string
  datum: string
  zeilen: AmbientZeile[]
  rest: number
  gesamt: number
  /** Ist, Ziel und Soll-bis-heute des laufenden Monats. */
  monat: { ist: number; ziel: number; sollHeute: number }
  termine: AmbientTermin[]
  /** 0 = heute, -1 = gestern, 1 = morgen. */
  tagVersatz: number
  tagDatum: Date
  aufwachStunde: number
  detail: boolean
  termineLaden: boolean
  termineFehler: string | null
  tageMitTerminen: Set<number>
  zaehler: AmbientZaehler[]
  kennzahlen: AmbientKennzahl[]
  jetzt: Date
  jetztHhmm: string
  laedt: boolean
  alsWallpaper: boolean
  basis: string
  onErledigt: (id: string) => void
  onZaehl: (field: string) => void
  onTag: (versatz: number) => void
  onAufwach: (stunde: number) => void
  onDetail: (an: boolean) => void
}) {
  const { breiten, greife, zurueck, gleich, zieht } = useSpaltenBreiten(SPALTEN_STANDARD)

  /**
   * Die Griffe auf den Trennlinien — als eigene Ebene über dem Raster.
   *
   * **Warum nicht in der Spalte** (Fehler vom 10.09., behoben am 11.09.): Dort
   * saßen sie mit negativem `right` außerhalb ihrer Spalte, und die Spalte
   * trägt `overflow: hidden`. Der Griff wurde damit vollständig weggeschnitten
   * — unsichtbar und, was schwerer wiegt, nicht anklickbar. Die Trenner ließen
   * sich seit dem ersten Tag nicht ziehen.
   *
   * Als Kind des Rasters liegen sie auf der gerechneten Grenze zweier Spalten
   * und werden von nichts beschnitten. Die Position ist der aufsummierte Anteil
   * der Spalten links davon — dieselbe Zahl, aus der auch das Grid entsteht,
   * also können Linie und Griff nicht auseinanderlaufen.
   */
  const summe = breiten.reduce((a, b) => a + b, 0)
  const griffe = breiten.slice(0, -1).map((_, index) => {
    const bis = breiten.slice(0, index + 1).reduce((a, b) => a + b, 0)
    return (
      <span
        key={index}
        className="amb-griff"
        style={{ left: `${(bis / summe) * 100}%` }}
        onPointerDown={(e: ReactPointerEvent<HTMLElement>) => greife(index, e)}
        onDoubleClick={zurueck}
        role="separator"
        aria-orientation="vertical"
        aria-label="Spaltenbreite ziehen — Doppelklick setzt zurück"
      />
    )
  })

  return (
    <div className={`amb-flaeche${alsWallpaper ? ' amb-wallpaper' : ''}${zieht ? ' amb-zieht' : ''}`}>
      <div className="amb-szene" aria-hidden />
      <div className="amb-scrim" aria-hidden />

      <MenueLeiste basis={basis} alsWallpaper={alsWallpaper} onSpaltenGleich={gleich} />

      <header className="amb-kopf">
        <h1 className="amb-gruss">{gruss}</h1>
        <p className="amb-datum">{datum}</p>
      </header>

      <div
        className="amb-raster"
        style={{ gridTemplateColumns: breiten.map((b) => `${b}fr`).join(' ') }}
      >
        {/* Die Befunde oben, das Monatsziel am Fuß — dazwischen darf Luft
            stehen. Genau die trägt die Spalte: eine Liste, die bis unten
            reicht, hätte an einem ruhigen Tag nichts zu zeigen. */}
        <section className="amb-spalte">
          <p className="amb-label">{gesamt > 0 ? `Offen · ${gesamt}` : 'Offen'}</p>
          <LageSpalte zeilen={zeilen} rest={rest} laedt={laedt} basis={basis} onErledigt={onErledigt} />
          <MonatsZiel ist={monat.ist} ziel={monat.ziel} sollHeute={monat.sollHeute} basis={basis} />
        </section>

        {/* Bestand oben, Tagesleistung darunter: „140 versandfertig" ist der
            Vorrat, aus dem die Erstnachrichten des Tages kommen. Die Termine
            standen hier bis zum 10.09. — sie sind entfallen, weil der
            Tagesverlauf rechts sie maßstäblich zeigt und zweimal dasselbe
            keine zweite Spalte verdient. */}
        <section className="amb-spalte">
          <p className="amb-label">Bestand</p>
          <BestandZeile kennzahlen={kennzahlen} basis={basis} />
          <p className="amb-label amb-label-zweit">Tageszähler</p>
          <ZaehlerSpalte zaehler={zaehler} basis={basis} alsWallpaper={alsWallpaper} onZaehl={onZaehl} />
        </section>

        {/* Die Monatsspalte clippt nicht: die Tageszahl an ihrem Fuß ist eine
            Riesenziffer und ragt in Originalgröße über die Spaltenkante — so
            lag sie vorher frei im Bild, und genau so soll sie wirken. */}
        <section className="amb-spalte amb-spalte-monat">
          <p className="amb-label">{jetzt.toLocaleDateString('de-DE', { month: 'long' })}</p>
          <KalenderSpalte jetzt={jetzt} tageMitTerminen={tageMitTerminen} basis={basis} />
        </section>

        <section className="amb-spalte">
          <p className="amb-label">Tagesverlauf</p>
          <VerlaufSpalte
            termine={termine}
            jetztHhmm={jetztHhmm}
            tagVersatz={tagVersatz}
            tagDatum={tagDatum}
            aufwachStunde={aufwachStunde}
            detail={detail}
            laedt={termineLaden}
            fehler={termineFehler}
            basis={basis}
            onTag={onTag}
            onAufwach={onAufwach}
            onDetail={onDetail}
          />
        </section>

        {griffe}
      </div>
    </div>
  )
}

function AmbientFlaeche() {
  const [params] = useSearchParams()
  const { activeBrand } = useActiveBrand()
  const { items, toggle, loading: aufgabenLaden } = useTasks(activeBrand?.slug)
  const buckets = useTaskBuckets(items)
  const { stand, loading: widersprLaden } = useWidersprueche()
  const { kennzahlen } = useAmbientKennzahlen()
  /** Dieselbe Zahl wie im Bestand — hier als „so viele warten" an der Zeile. */
  const versandfertig = kennzahlen.find((k) => k.label === 'versandfertig')?.wert
  /** Antworten und Follow-ups aus denselben Funktionen wie der Sales-Flow. */
  const offen = useAmbientOffen()
  const { today, monthRows, bump } = useDailyMetrics()
  const ical = useUiSetting<string>(CALENDAR_ICAL_KEY, '')
  /**
   * Die Aufwachzeit liegt in `ui_settings`, nicht im `localStorage` wie die
   * Spaltenbreiten: Breiten hängen am Bildschirm, das Aufstehen am Menschen.
   * Am MacBook und am großen Schirm ist es dieselbe Kurve.
   */
  const aufwach = useUiSetting<number>(AUFWACH_KEY, AUFWACH_STANDARD)
  /**
   * Ganzer Tag oder Ausschnitt. In `ui_settings`, nicht im `localStorage`: das
   * ist eine Vorliebe, wie man den Tag liest, keine Eigenschaft des Bildschirms
   * — und anders als der Tagesversatz soll sie den nächsten Morgen überleben.
   */
  const detail = useUiSetting<boolean>(DETAIL_KEY, false)

  const eigeneZiele = useUiSetting<ZielUeberschreibung>(TAGES_FLOW_ZIELE, {})
  const { events, loading: termineLaden, error: termineFehler } = useCalendarFeed(ical.wert || null)

  /**
   * Die Uhr läuft, damit Gruß, Datum, Monatsblatt und die Jetzt-Marke im
   * Verlauf den Tag mitbekommen — das Wallpaper steht wochenlang offen.
   */
  /**
   * Welcher Tag im Verlauf steht: 0 heute, -1 gestern, 1 morgen. Bewusst nur
   * für diese Sitzung und nicht gespeichert — ein Wallpaper, das nach dem
   * Aufwachen noch auf „gestern" steht, wäre eine Falle.
   */
  const [tagVersatz, setTagVersatz] = useState(0)

  const [jetzt, setJetzt] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setJetzt(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  /**
   * Der Menüleisten-Versatz — der Grund für den Bruch am oberen Rand.
   *
   * Plash legt seine Fläche **unterhalb** der Menüleiste an. In der Leiste
   * scheint der oberste Streifen des echten Wallpapers durch; direkt darunter
   * beginnt unser Bild noch einmal bei seiner Oberkante. Dieselbe Bildzeile
   * steht dann zweimal da, und die Naht liest sich als Kante.
   *
   * Die Höhe wird gemessen, nicht geraten: Bildschirmhöhe minus Fensterhöhe
   * ist genau der verdeckte Streifen — mit oder ohne Notch, auf jedem Gerät.
   * Die Szene wird um diesen Betrag nach oben gezogen, dann setzt sie exakt
   * das fort, was in der Leiste zu sehen ist.
   *
   * Nur im Wallpaper-Betrieb: In einem normalen Browserfenster wäre die
   * Differenz die Fensterdekoration und würde das Bild grundlos verschieben.
   */
  const alsWallpaper = params.get('plash') === '1'
  useEffect(() => {
    if (!alsWallpaper) return
    const messen = () => {
      const versatz = Math.max(0, Math.round(window.screen.height - window.innerHeight))
      document.documentElement.style.setProperty('--amb-versatz', `${versatz}px`)
    }
    messen()
    window.addEventListener('resize', messen)
    return () => {
      window.removeEventListener('resize', messen)
      document.documentElement.style.removeProperty('--amb-versatz')
    }
  }, [alsWallpaper])

  /**
   * Der Monatsstand — dieselben Bausteine wie im Cockpit und im Assistenten
   * (`UrielDock.get_month_revenue`): Ist aus `monthRows`, Ziel aus
   * `month_goals` über `monthTargetFor`, Soll aus der hinterlegten Monatskurve.
   * Kein eigener Rechenweg, damit die Fläche nicht irgendwann eine andere Zahl
   * nennt als die Seite, auf der Kevin sie korrigiert.
   */
  const monatsSchluessel = monthKeyOf(jetzt)
  const monatsziel = useMonthGoal(activeBrand?.id, monatsSchluessel)
  const monat = useMemo(() => {
    const ziel = monthTargetFor(monatsSchluessel, monatsziel.total)
    return {
      ist: sumField(monthRows, 'umsatz'),
      ziel: ziel?.total ?? 0,
      sollHeute: ziel ? currentSoll(ziel.curve, jetzt) : 0,
    }
  }, [monthRows, monatsziel.total, monatsSchluessel, jetzt])

  const { sichtbar, rest, gesamt } = useMemo(
    () => ambientZeilen(stand?.befunde ?? [], buckets.overdue, buckets.today),
    [stand?.befunde, buckets.overdue, buckets.today],
  )

  const tagKey = tagesSchluessel(jetzt, tagVersatz)
  const tagDatum = useMemo(() => {
    const d = new Date(jetzt)
    d.setDate(d.getDate() + tagVersatz)
    return d
  }, [jetzt, tagVersatz])
  const jetztHhmm = `${String(jetzt.getHours()).padStart(2, '0')}:${String(jetzt.getMinutes()).padStart(2, '0')}`

  const { termine, tageMitTerminen } = useMemo(() => {
    const sortiert = [...events].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    const heutige = sortiert.filter((e) => e.date === tagKey)
    // „Der nächste" gibt es nur heute — an einem anderen Tag wäre das eine
    // Aussage über eine Uhrzeit, die dort nicht gilt.
    const naechsterId =
      tagVersatz === 0 ? heutige.find((e) => e.time && e.time >= jetztHhmm)?.id : undefined
    const zuTermin = (e: (typeof sortiert)[number]): AmbientTermin => ({
      id: e.id,
      zeit: e.time,
      titel: e.title,
      naechster: e.id === naechsterId,
      // Die Länge kommt aus DTEND/DURATION der iCal. Fehlt sie, zeichnet die
      // Achse ihre Standardhöhe — hier wird nichts geschätzt.
      ...(typeof e.dauerMin === 'number' ? { dauerMin: e.dauerMin } : {}),
    })

    const monatsPraefix = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-`
    const tage = new Set<number>()
    for (const e of events) {
      if (e.date.startsWith(monatsPraefix)) tage.add(Number(e.date.slice(8, 10)))
    }

    return { termine: heutige.map(zuTermin), tageMitTerminen: tage }
  }, [events, tagKey, tagVersatz, jetztHhmm, jetzt])

  /**
   * Die Zählfelder mit Kevins **eigenem** Tagesziel, nicht dem Standardwert.
   * Die Überschreibung in `ui_settings` hängt an der Stufen-Id (`anfragen`),
   * das Zählfeld an der Metrik (`li_anfragen`) — `stufeFuerFeld` ist die
   * Brücke. Der lange Name steht hier statt des kurzen, weil auf der Fläche
   * Platz ist und „LI Nachricht" nicht erkennen lässt, dass es die
   * Erstnachrichten sind.
   */
  const zaehler: AmbientZaehler[] = useMemo(
    () =>
      ZAEHL_FELDER.slice(0, ZAEHLER_AUF_FLAECHE).map((z) => {
        const stufe = stufeFuerFeld(z.field)
        const eigen = stufe ? eigeneZiele.wert?.[stufe.id] : undefined
        const ort = stufe ? ARBEITSORT[stufe.id] : undefined
        /**
         * Was hinter der Zeile wartet. Drei Quellen, eine Bedeutung:
         * Erstnachrichten kommen aus dem Runner-Spiegel (`versandfertig`),
         * Antworten und Follow-ups aus denselben Posten-Funktionen wie der
         * Sales-Flow (`useAmbientOffen`). Alles andere zeigt keine Zahl — eine
         * erfundene wäre schlimmer als keine.
         */
        const wartend =
          stufe?.id === 'erstnachrichten'
            ? versandfertig
            : stufe?.id === 'antworten'
              ? offen.antworten
              : stufe?.id === 'followups'
                ? offen.followups
                : undefined
        return {
          field: z.field,
          // Auf dieser Fläche ist alles LinkedIn — der Zusatz hinter jedem
          // Namen sagt nichts und kostet die Breite, die die Zahl daneben
          // braucht. Im Cockpit steht Instagram daneben, dort bleibt er.
          label: z.langLabel.replace(/\s*·\s*LinkedIn$/, ''),
          stand: Number(today[z.field] ?? 0),
          tagesziel: typeof eigen === 'number' ? eigen : z.tagesziel,
          // Zählen oder öffnen entscheidet der Arbeitsort, nicht das Datenmodell:
          // was eine Liste hat, aus der kopiert wird, bekommt kein Plus.
          art: ort ? ('oeffnen' as const) : ('zaehlen' as const),
          ...(ort ? { ziel: ort } : {}),
          ...(typeof wartend === 'number' ? { offen: wartend } : {}),
        }
      }),
    [today, eigeneZiele.wert, versandfertig, offen.antworten, offen.followups],
  )

  return (
    <AmbientAnsicht
      gruss={grussFuer(jetzt.getHours())}
      datum={datumsZeile(jetzt)}
      zeilen={sichtbar}
      rest={rest}
      gesamt={gesamt}
      monat={monat}
      termine={termine}
      tagVersatz={tagVersatz}
      tagDatum={tagDatum}
      aufwachStunde={aufwach.wert}
      detail={detail.wert}
      termineLaden={termineLaden}
      termineFehler={termineFehler}
      tageMitTerminen={tageMitTerminen}
      zaehler={zaehler}
      kennzahlen={kennzahlen}
      jetzt={jetzt}
      jetztHhmm={jetztHhmm}
      laedt={aufgabenLaden || widersprLaden}
      alsWallpaper={alsWallpaper}
      basis={window.location.origin}
      onErledigt={toggle}
      onZaehl={(field) => bump(field as MetricField, 1)}
      onTag={setTagVersatz}
      onAufwach={aufwach.setzen}
      onDetail={detail.setzen}
    />
  )
}

/**
 * Die Fläche läuft außerhalb der Cockpit-Shell — dort sitzt sonst der
 * `ActiveBrandProvider`, den `useDailyMetrics` braucht. Deshalb bringt die
 * Seite ihn selbst mit, wie es die Dev-Vorschauen tun.
 */
export function AmbientPage() {
  return (
    <ActiveBrandProvider>
      <AmbientFlaeche />
    </ActiveBrandProvider>
  )
}
