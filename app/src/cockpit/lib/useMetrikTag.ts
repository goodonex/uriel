import { useEffect, useState } from 'react'
import { heutigesMetrikDatum, naechsterTageswechsel } from './metricsDates'

/**
 * Der laufende Metrik-Tag als React-Zustand — die Uhr, die im Cockpit gefehlt hat
 * (11.09.2026).
 *
 * **Der Anlass.** `heutigesMetrikDatum()` rechnet beim Rendern, und gerendert wird
 * nur, wenn sich etwas rührt. Ein Tab, der über Nacht offen bleibt, zeigt deshalb
 * bis zum ersten Klick den Stand von gestern: Am 10.09. stand die Tagesliste nach
 * Mitternacht weiter auf „40 von 40" — nicht weil die Rechnung falsch war, sondern
 * weil niemand sie noch einmal angestellt hat. Die Uhr am Mac war der einzige
 * Hinweis, dass ein neuer Tag begonnen hatte.
 *
 * **Was der Hook tut.** Er legt einen Timer genau auf die nächste Tagesgrenze
 * (`naechsterTageswechsel`, also 0:00 plus knappem Puffer) und setzt dann den
 * neuen Tag — jede Fläche, die diesen Wert benutzt, rechnet und lädt damit von
 * selbst neu. Kein Reload der Seite: ein halb getippter Entwurf im Postfach darf
 * einem Datumswechsel nicht zum Opfer fallen.
 *
 * **Warum zusätzlich zwei Ereignisse.** Ein zugeklappter Mac hält Timer an; beim
 * Aufwachen kann der geplante Moment längst vorbei sein. Deshalb prüft der Hook
 * auch, wenn der Tab wieder sichtbar wird oder das Fenster den Fokus bekommt —
 * dann stimmt der Tag spätestens in dem Augenblick, in dem Kevin hinsieht.
 *
 * Bewusst KEINE zweite Tagesrechnung: Die Grenze steht allein in
 * `METRIK_TAG_WECHSEL_STUNDE`, dieser Hook liest sie nur.
 */

/**
 * Knapp nach der Grenze wecken, nicht exakt darauf: `setTimeout` darf ein paar
 * Millisekunden zu früh feuern, und dann stünde noch der alte Tag im Ergebnis.
 * Der Selbst-Neuplan unten würde das auffangen, aber erst nach einem Umlauf.
 */
const PUFFER_MS = 1_500

export function useMetrikTag(): string {
  const [tag, setTag] = useState(heutigesMetrikDatum)

  useEffect(() => {
    let timer: number | undefined

    function plane() {
      if (timer != null) window.clearTimeout(timer)
      const ms = naechsterTageswechsel().getTime() - Date.now() + PUFFER_MS
      // Untergrenze, damit ein Uhren-Sprung rückwärts (NTP, Zeitzonenwechsel)
      // keine Timeout-Schleife mit 0 ms auslöst.
      timer = window.setTimeout(pruefe, Math.max(1_000, ms))
    }

    function pruefe() {
      const jetzt = heutigesMetrikDatum()
      // Gleicher String → React bricht ohne Re-Render ab; nichts lädt umsonst.
      setTag((alt) => (alt === jetzt ? alt : jetzt))
      plane()
    }

    function beiSichtbarkeit() {
      if (document.visibilityState === 'visible') pruefe()
    }

    plane()
    document.addEventListener('visibilitychange', beiSichtbarkeit)
    window.addEventListener('focus', pruefe)
    return () => {
      if (timer != null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', beiSichtbarkeit)
      window.removeEventListener('focus', pruefe)
    }
  }, [])

  return tag
}
