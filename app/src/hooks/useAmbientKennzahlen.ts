import { useCallback, useEffect, useState } from 'react'
import { leseSpiegel } from '../cockpit/lib/runnerBridge'

/**
 * Die drei Zahlen unter der Ambient-Fläche (10.09.2026).
 *
 * Gelesen wird aus den Spiegeln, die der Runner ohnehin schreibt — **nicht**
 * aus `useErstnachrichten`/`useLinkedinNetzwerk`. Die laden hunderte Zeilen,
 * um am Ende eine Zahl zu zeigen; das Wallpaper steht tagelang offen, da wäre
 * das jede Minute erneut verschenkte Bandbreite. `runner_snapshots` liefert je
 * eine Zeile.
 */

interface ErstnachrichtenMeta {
  versandfertig?: number
}

interface SeitenMeta {
  gesamt?: number
  /** Gesetzt, solange der letzte Lauf dieser Seite abgebrochen ist. */
  letzterAbbruch?: { gesamt?: number; geerntet?: number }
}

interface NetzwerkMeta {
  kontakte?: SeitenMeta
  einladungen?: SeitenMeta
}

export interface AmbientKennzahl {
  wert: number
  label: string
  /**
   * Der Sync dieser Seite steht — die Zahl ist der letzte **vollständige**
   * Stand, nicht der aktuelle (11.09.2026).
   *
   * Der Grund für dieses Feld ist ein Bild, das Kevin gezeigt hat: Im Bestand
   * standen „1.061 Einladungen", zwei Zentimeter daneben im Befund „brach bei
   * 30 von 1094 ab". Beide Zahlen sind richtig — `gesamt` schreibt nur ein
   * vollständiger Lauf (`netzwerkUpsert.schreibeMeta`), die 1094 sah der
   * abgebrochene Lauf auf der Seite. Nebeneinander sieht das aus wie ein
   * Fehler, und eine Fläche, deren Zahlen sich zu widersprechen scheinen, hat
   * ihren Zweck verfehlt. Also sagt sie jetzt dazu, was los ist.
   */
  veraltet?: boolean
}

/** Wie oft die Zahlen nachgezogen werden. Der Runner spiegelt im Minutentakt. */
const TAKT_MS = 120_000

export function useAmbientKennzahlen(): { kennzahlen: AmbientKennzahl[]; loading: boolean } {
  const [kennzahlen, setKennzahlen] = useState<AmbientKennzahl[]>([])
  const [loading, setLoading] = useState(true)

  const laden = useCallback(async () => {
    const [nachrichten, netzwerk] = await Promise.all([
      leseSpiegel<ErstnachrichtenMeta>('erstnachrichten_meta'),
      leseSpiegel<NetzwerkMeta>('linkedin_netzwerk_meta'),
    ])

    // Eine Zahl, die niemand hat, wird weggelassen statt als 0 gezeigt — eine
    // gezeigte Null liest sich wie ein Befund, dabei fehlt nur der Spiegel.
    const naechste: AmbientKennzahl[] = []
    const versandfertig = nachrichten?.data?.versandfertig
    if (typeof versandfertig === 'number') {
      naechste.push({ wert: versandfertig, label: 'versandfertig' })
    }
    const seite = (m: SeitenMeta | undefined, label: string) => {
      if (typeof m?.gesamt !== 'number') return
      naechste.push({ wert: m.gesamt, label, ...(m.letzterAbbruch ? { veraltet: true } : {}) })
    }
    seite(netzwerk?.data?.kontakte, 'Kontakte')
    seite(netzwerk?.data?.einladungen, 'Einladungen')

    setKennzahlen(naechste)
    setLoading(false)
  }, [])

  /**
   * Auch der erste Lauf hängt an einem Timer, nicht am Effekt-Rumpf. Sonst
   * setzt der Effekt synchron State und `react-hooks/set-state-in-effect`
   * schlägt an — die Regel läuft hier als *error*. Funktional ist es dasselbe:
   * die Zahlen stehen im nächsten Frame.
   */
  useEffect(() => {
    const sofort = window.setTimeout(() => void laden(), 0)
    const id = window.setInterval(() => void laden(), TAKT_MS)
    return () => {
      window.clearTimeout(sofort)
      window.clearInterval(id)
    }
  }, [laden])

  return { kennzahlen, loading }
}
