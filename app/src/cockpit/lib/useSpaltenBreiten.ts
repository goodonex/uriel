import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Verschiebbare Spaltentrenner der Ambient-Fläche (10.09.2026).
 *
 * Die vier Spalten liegen in einem Grid mit `fr`-Anteilen. Ein Zug an einer
 * Haarlinie verschiebt Anteil zwischen den beiden Spalten links und rechts
 * davon — die Gesamtbreite bleibt, es entsteht kein Rest und kein Sprung.
 *
 * **Warum `localStorage` und nicht `ui_settings`:** Die Aufteilung hängt am
 * Bildschirm, nicht am Menschen. Kevins 65-Zöller will andere Breiten als das
 * MacBook, und beide würden sich über eine geteilte Einstellung gegenseitig
 * überschreiben. Geht der Wert verloren, stehen die Standardanteile — kein
 * Schaden, den man reparieren müsste.
 */

// v2: Die Spaltenaufgaben haben sich am 10.09. geändert (Termine raus,
// 24-Stunden-Achse rein). Eine gespeicherte Aufteilung von vorher passt zwar
// nach Länge, aber nicht mehr zum Inhalt — deshalb ein neuer Schlüssel statt
// einer stillen Übernahme.
const SPEICHER = 'uriel.ambient.spalten.v2'

/** Keine Spalte darf unter diesen Anteil fallen, sonst ist sie nicht mehr lesbar. */
const MIN_ANTEIL = 0.45

export function useSpaltenBreiten(standard: number[]): {
  breiten: number[]
  /** Auf die Trennlinie *rechts* von Spalte `index` legen. */
  greife: (index: number, e: React.PointerEvent<HTMLElement>) => void
  /** Zurück auf die Startaufteilung (Doppelklick auf einen Trenner). */
  zurueck: () => void
  /**
   * Alle Spalten gleich breit.
   *
   * Etwas anderes als `zurueck`: die Startaufteilung ist gewichtet (der
   * Tagesverlauf bekommt mehr als das Monatsblatt). „Gleichmäßig" ist der
   * Zustand, aus dem heraus Kevin sich neu zurechtzieht, wenn er sich verzogen
   * hat — deshalb zwei Wege statt eines.
   */
  gleich: () => void
  /** Läuft gerade ein Zug? Für den Cursor der ganzen Fläche. */
  zieht: boolean
} {
  const [breiten, setBreiten] = useState<number[]>(() => {
    try {
      const roh = window.localStorage.getItem(SPEICHER)
      if (!roh) return standard
      const gelesen = JSON.parse(roh) as unknown
      // Eine Fassung mit anderer Spaltenzahl ist keine gültige Aufteilung mehr.
      if (!Array.isArray(gelesen) || gelesen.length !== standard.length) return standard
      if (!gelesen.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= MIN_ANTEIL)) {
        return standard
      }
      return gelesen as number[]
    } catch {
      return standard
    }
  })
  const [zieht, setZieht] = useState(false)
  const lauf = useRef<{ index: number; startX: number; start: number[]; proPixel: number } | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(SPEICHER, JSON.stringify(breiten))
    } catch {
      /* Privatmodus o.ä. — die Aufteilung gilt dann nur für diese Sitzung. */
    }
  }, [breiten])

  const greife = useCallback((index: number, e: React.PointerEvent<HTMLElement>) => {
    // Der Griff sitzt am Rand einer Spalte, gerechnet wird gegen das Raster.
    const raster = e.currentTarget.closest('.amb-raster')
    if (!raster) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)

    setBreiten((aktuell) => {
      const summe = aktuell.reduce((a, b) => a + b, 0)
      lauf.current = {
        index,
        startX: e.clientX,
        start: [...aktuell],
        // Wie viel `fr` ein Pixel wert ist — sonst zieht die Linie schneller
        // oder langsamer als der Zeiger.
        proPixel: summe / raster.getBoundingClientRect().width,
      }
      return aktuell
    })
    setZieht(true)
  }, [])

  useEffect(() => {
    if (!zieht) return

    const bewege = (e: PointerEvent) => {
      const l = lauf.current
      if (!l) return
      const delta = (e.clientX - l.startX) * l.proPixel
      const links = l.start[l.index] + delta
      const rechts = l.start[l.index + 1] - delta
      if (links < MIN_ANTEIL || rechts < MIN_ANTEIL) return
      setBreiten(() => {
        const naechste = [...l.start]
        naechste[l.index] = links
        naechste[l.index + 1] = rechts
        return naechste
      })
    }

    const los = () => {
      lauf.current = null
      setZieht(false)
    }

    window.addEventListener('pointermove', bewege)
    window.addEventListener('pointerup', los)
    window.addEventListener('pointercancel', los)
    return () => {
      window.removeEventListener('pointermove', bewege)
      window.removeEventListener('pointerup', los)
      window.removeEventListener('pointercancel', los)
    }
  }, [zieht])

  const zurueck = useCallback(() => setBreiten(standard), [standard])
  const gleich = useCallback(() => setBreiten(standard.map(() => 1)), [standard])

  return { breiten, greife, zurueck, gleich, zieht }
}
