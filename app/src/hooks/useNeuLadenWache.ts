import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  DATEN_NEU_LADEN_EVENT,
  sollNeuLaden,
  type LadeStand,
  type NeuLadenGrund,
} from '../lib/datenFrische'

/**
 * Die Verdrahtung von `lib/datenFrische.ts` an Browser und Supabase (06.10.2026).
 *
 * EIN Satz Listener pro Tab, egal wie viele Hooks mithören — sonst hinge an
 * jedem `focus` ein Dutzend `onAuthStateChange`-Abos. Die Hooks hören nur den
 * Event `DATEN_NEU_LADEN_EVENT` und entscheiden selbst per `sollNeuLaden`, ob
 * es für sie Zeit ist.
 */

/** Wie oft der Takt nachsieht — die eigentliche Schwelle steht in `TAKT_ABSTAND_MS`. */
const TAKT_PRUEFEN_MS = 60_000

let zuhoerer = 0
let abbauen: (() => void) | null = null

/** Stößt alle Daten-Hooks im Tab an (z. B. vom „Neu laden"-Knopf). */
export function fordereNeuLaden(grund: NeuLadenGrund): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<NeuLadenGrund>(DATEN_NEU_LADEN_EVENT, { detail: grund }))
}

function sichtbar(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

function starteWache(): () => void {
  const beiSichtbarkeit = () => {
    if (sichtbar()) fordereNeuLaden('fokus')
  }
  const beiFokus = () => fordereNeuLaden('fokus')
  const beiOnline = () => fordereNeuLaden('online')
  document.addEventListener('visibilitychange', beiSichtbarkeit)
  window.addEventListener('focus', beiFokus)
  window.addEventListener('online', beiOnline)
  // Browser drosseln Timer in Hintergrund-Tabs; ein zugeklappter Laptop hält
  // sie an. Der Takt ist deshalb nur das Netz unter Fokus und Sichtbarkeit.
  const takt = window.setInterval(() => {
    if (sichtbar()) fordereNeuLaden('takt')
  }, TAKT_PRUEFEN_MS)

  // Nach dem Aufwachen erneuert Supabase die Anmeldung — erst DANACH gehen die
  // Abfragen wieder durch. Lief der Fokus-Ladelauf vorher ins Leere, holt
  // dieser Anstoß ihn nach.
  const abo = supabase?.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') fordereNeuLaden('anmeldung')
  })

  return () => {
    document.removeEventListener('visibilitychange', beiSichtbarkeit)
    window.removeEventListener('focus', beiFokus)
    window.removeEventListener('online', beiOnline)
    window.clearInterval(takt)
    abo?.data.subscription.unsubscribe()
  }
}

/**
 * Lässt einen Daten-Hook auf die Anstöße hören.
 *
 * `stand` wird bei jedem Anstoß frisch gelesen (Refs im Hook), `neuLaden`
 * startet den leisen Ladelauf — ohne `loading` umzuschalten, damit ein
 * Tab-Wechsel nicht jedes Mal alle Zahlen auf „…" springen lässt.
 */
export function useNeuLadenWache(neuLaden: () => void, stand: () => LadeStand): void {
  const neuRef = useRef(neuLaden)
  const standRef = useRef(stand)
  useEffect(() => {
    neuRef.current = neuLaden
    standRef.current = stand
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (zuhoerer++ === 0) abbauen = starteWache()
    const beiAnstoss = (e: Event) => {
      const grund = (e as CustomEvent<NeuLadenGrund>).detail
      if (sollNeuLaden(grund, standRef.current(), Date.now())) neuRef.current()
    }
    window.addEventListener(DATEN_NEU_LADEN_EVENT, beiAnstoss)
    return () => {
      window.removeEventListener(DATEN_NEU_LADEN_EVENT, beiAnstoss)
      if (--zuhoerer === 0) {
        abbauen?.()
        abbauen = null
      }
    }
  }, [])
}
