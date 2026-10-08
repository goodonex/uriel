import { angenommenOhneErstnachricht, nachStichtag } from './funnelStufen'
import { icpUrteil, istArbeitsVorrat } from './icp'
import { useEffect, useMemo } from 'react'
import { quellenFehler } from '../../lib/datenFrische'
import { useErstnachrichten } from '../../hooks/useErstnachrichten'
import { useContacts } from '../../hooks/useContacts'
import { useLinkedinNetzwerk } from '../../hooks/useLinkedinNetzwerk'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import { useLoomUrteile } from '../../hooks/useLoomUrteile'
import { useActiveBrand } from './activeBrand'
import { antwortPosten, erstnachrichtPosten, followupPosten, FOLLOWUP_NUR_SENDEFERTIG, loomPosten } from './arbeitsmodusQuellen'
import { useMetrikTag } from './useMetrikTag'
import { ohneBeiClaude, pruefBeiClaude, useNachrichtenFeedback } from './nachrichtenFeedback'
import { useTagesPortionen, type TagesPortionen } from './useTagesPortionen'
import { useUiSetting } from './uiSettings'
import {
  PORTION_STUFEN,
  ANFRAGEN_PAUSE,
  TAGES_FLOW_ZIELE,
  anfragenPauseAktiv,
  darfFestschreiben,
  einzufrierendePortionen,
  flowQuellen,
  stufenStaende,
  type AnfragenPause,
  type FlowEingabe,
  type StufenStand,
  type TagesZeile,
  type ZielUeberschreibung,
} from './tagesFlow'

/**
 * Die Verdrahtung des Tages-Flows an die Hooks (11.08.2026, erweitert 18.08.).
 *
 * Die Rechnung selbst steht in `tagesFlow.ts` und ist dort ohne React prüfbar.
 * Hier kommt nur zusammen, was sie braucht: die heutige Zeile aus
 * `daily_metrics`, die Live-Zahlen der Quellen (Fällige, offene
 * Erstnachrichten, wartende Antworten, offene Looms) und Kevins eigene Ziele
 * aus `ui_settings`.
 *
 * **Dieser Hook lädt die Tageszeile bewusst NICHT selbst.** Alle Aufrufer
 * halten sie ohnehin in der Hand (der Zähl-Modus zum Schreiben, der Homescreen
 * für den Hero) — ein eigener Ladelauf hier hiesse, `daily_metrics` auf
 * derselben Seite zweimal zu abonnieren.
 */

/** Ohne Eintrag in `ui_settings` gelten die Standard-Ziele. Modul-Konstante, damit die Referenz steht. */
const KEINE_ZIELE: ZielUeberschreibung = {}

/** Die Live-Zahlen, die der Flow neben der Tageszeile braucht. */
export type FlowLiveQuellen = Pick<
  FlowEingabe,
  'faelligHeute' | 'erstnachrichtenOffen' | 'loomsOffen' | 'antworten' | 'portionen' | 'beiClaude'
>

export interface TagesFlowStand {
  staende: StufenStand[]
  /**
   * Solange `true`, ist jede Aussage über „erledigt" vorläufig — beim ersten
   * Render sind alle Zähler 0 und jede Stufe sähe offen aus. Wer daraus
   * springt (Auto-Advance), muss diesen Zustand abwarten.
   */
  laedt: boolean
  /**
   * Eine Live-Quelle hat nicht geladen oder die Brand ist nicht aufgelöst
   * (06.10.2026). Solange gesetzt: keine Stufe mit Live-Quelle ist erledigt,
   * nichts wird eingefroren, und die Tagesliste zeigt eine Warnung statt Zahlen.
   */
  fehler: string | null
  /** Die eingefrorenen Portionen mitsamt Historie — für Streak und Sales-Zeilen. */
  portionen: TagesPortionen
}

/**
 * Die Live-Quellen für Seiten, die `usePosten` NICHT ohnehin rufen (der
 * Zähl-Modus). Lädt Threads und Erstnachrichten genau einmal und leitet alle
 * Zahlen aus denselben Posten-Funktionen ab wie die Sales-Zeilen — kein
 * zweiter Rechenweg.
 */
export function useFlowLiveQuellen(): { quellen: FlowLiveQuellen; laedt: boolean; fehler: string | null } {
  const { activeBrand } = useActiveBrand()
  const threads = useLinkedinThreads(activeBrand?.slug)
  const loomUrteile = useLoomUrteile(activeBrand?.slug)
  const erstnachrichten = useErstnachrichten(activeBrand?.slug)
  // Nur für den Profil-Link an den Erstnachrichten (18.08.2026).
  const netzwerk = useLinkedinNetzwerk(activeBrand?.slug)
  // Kunden gehören in keine Akquise-Spur (18.08.2026, Fall Reichentrog).
  const contacts = useContacts(activeBrand?.slug)
  // Der Mount-Zeitpunkt genügt: die Follow-up-Schwellen sind Tage (3/7/14),
  // eine Zähl-Sitzung dauert Minuten. Ein Minutentakt wie in `usePosten` würde
  // hier nur Neuberechnungen erzeugen, die nichts ändern.
  const jetzt = useMemo(() => new Date(), [])
  // Was bei Claude liegt, zählt hier genauso vorerst als erledigt wie in `usePosten` (08.10.2026).
  const feedback = useNachrichtenFeedback()
  const quellen = useMemo(() => {
    const id = (p: { id: string }) => p.id
    const followup = ohneBeiClaude(
      followupPosten(threads.items, jetzt, contacts.items, undefined, undefined, undefined, FOLLOWUP_NUR_SENDEFERTIG),
      feedback,
      id,
    )
    const erstnachricht = ohneBeiClaude(erstnachrichtPosten(erstnachrichten.items, threads.items, netzwerk.items), feedback, id)
    const loom = ohneBeiClaude(loomPosten(threads.items, loomUrteile.urteile), feedback, id)
    const antwort = ohneBeiClaude(antwortPosten(threads.items, jetzt, contacts.items, loomUrteile.urteile), feedback, id)
    return flowQuellen(
        {
          followup: followup.offen,
          erstnachricht: erstnachricht.offen,
          beiClaude: {
            followups: followup.beiClaude,
            erstnachrichten: erstnachricht.beiClaude + pruefBeiClaude(erstnachrichten.items, threads.items, feedback),
            looms: loom.beiClaude,
            antworten: antwort.beiClaude,
          },
          erstnachrichtWartend: angenommenOhneErstnachricht(
            netzwerk.items,
            threads.items,
            erstnachrichten.items,
            jetzt,
          )
            .filter((p) => nachStichtag(p.seit))
            .filter((p) => istArbeitsVorrat(icpUrteil(p.info ?? '', p.name).urteil)),
          loom: loom.offen,
          antwort: antwort.offen,
        },
        jetzt,
      )
  }, [threads.items, erstnachrichten.items, netzwerk.items, contacts.items, loomUrteile.urteile, jetzt, feedback])
  const fehler = quellenFehler([
    { name: 'Threads', error: threads.error },
    { name: 'Erstnachrichten', error: erstnachrichten.error },
    { name: 'Netzwerk', error: netzwerk.error },
    { name: 'Loom-Urteile', error: loomUrteile.error },
  ])
  return {
    quellen,
    laedt: threads.loading || erstnachrichten.loading || netzwerk.loading || loomUrteile.loading,
    fehler,
  }
}

/** Der Stand aller Stufen — die eine Berechnung, die Hero, Zähl-Modus und Sales teilen. */
export function useTagesFlow(
  today: TagesZeile,
  quellen: FlowLiveQuellen,
  quelleLaedt = false,
  /** Erster Lesefehler der Live-Quellen (`quellenFehler`) — `null`, wenn alle geladen haben. */
  quelleFehler: string | null = null,
): TagesFlowStand {
  const { wert: ziele, geladen } = useUiSetting<ZielUeberschreibung>(TAGES_FLOW_ZIELE, KEINE_ZIELE)
  const heute = useMetrikTag()
  const portionen = useTagesPortionen(heute)
  const { wert: pause } = useUiSetting<AnfragenPause | null>(ANFRAGEN_PAUSE, null)
  const anfragenPausiert = anfragenPauseAktiv(pause, heute)

  /**
   * Das Einfrieren (Migration 0074) wohnt HIER, nicht in den Flächen: jede
   * Fläche, die den Flow rechnet, friert damit automatisch ein — wer morgens
   * zuerst öffnet (Home, Zähl-Modus oder /sales), schreibt die Portion fest.
   *
   * Erst wenn ALLES steht (Quellen, Ziele, Portionen geladen), sonst würde
   * eine 0 aus dem Ladezustand als Tages-Soll festgeschrieben. `friereEin`
   * schreibt nur fehlende Stufen; vorhandene Zeilen gewinnen (on conflict).
   */
  const darfSchreiben = darfFestschreiben({
    quelleLaedt,
    quelleFehler,
    zieleGeladen: geladen,
    portionenGeladen: portionen.geladen,
    portionenFehler: portionen.fehler,
    tableMissing: portionen.tableMissing,
  })

  useEffect(() => {
    // Auch nicht bei einem Lesefehler (06.10.2026): Eine 0 aus einer leeren,
    // weil fehlgeschlagenen Liste wäre sonst das Tages-Soll.
    if (!darfSchreiben) return
    const fehlen = PORTION_STUFEN.filter((id) => portionen.heutige[id] == null)
    if (fehlen.length === 0) return
    const alle = einzufrierendePortionen({ today, ...quellen, ziele, anfragenPausiert })
    const nurFehlende = Object.fromEntries(fehlen.map((id) => [id, alle[id] ?? 0]))
    portionen.friereEin(nurFehlende)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- eingefroren wird der Stand des Moments, nicht jeder neue
  }, [darfSchreiben, portionen.heutige])

  const quellenUnsicher = quelleFehler !== null
  const staende = useMemo(
    () => stufenStaende({ today, ...quellen, portionen: portionen.heutige, ziele, anfragenPausiert, quellenUnsicher }),
    [today, quellen, portionen.heutige, ziele, anfragenPausiert, quellenUnsicher],
  )

  const laedt = quelleLaedt || !geladen || !portionen.geladen

  /**
   * Der Gegen-Vermerk zum Einfrieren (0075, 19.08.2026): Steht eine Stufe,
   * wird das FESTGEHALTEN — nicht nur angezeigt.
   *
   * Grund: Die Zeile wird auch grün, wenn die Liste leerläuft, ohne dass der
   * Zähler das Soll erreicht (Kevin verwirft eine Erstnachricht, statt sie zu
   * senden). Die Streak sah davon nichts und riss am 18.08. bei 37 von 39.
   * Rückwirkend ist „die Liste war leer" nicht rekonstruierbar, also muss der
   * Moment mitgeschrieben werden, in dem er wahr ist.
   */
  useEffect(() => {
    if (!darfSchreiben) return
    const fertig = staende
      .filter((s) => s.erledigt && (PORTION_STUFEN as readonly string[]).includes(s.stufe.id))
      .map((s) => s.stufe.id)
    if (fertig.length) portionen.merkeErledigt(fertig)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- festgehalten wird der Moment, nicht jede Neuberechnung
  }, [darfSchreiben, staende])

  return { staende, laedt, fehler: quelleFehler, portionen }
}
