import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOsMapSnapshot, saveOsMapSnapshot } from './osMapSnapshot'
import type { OsMap } from './runnerApi'
import { fetchOsMap } from './runnerApi'
import type { RunnerState } from './useRunnerStatus'

const EMPTY: OsMap = {
  skills: [],
  routines: [],
  apps: [],
  memory: [],
  memoryEdges: [],
  generatedAt: '',
}

/**
 * Lädt die OS-Map (Skills/Routinen/Apps/Memory) vom Runner für den OrbitGraph.
 * Pollt langsam (60s) — der Runner cached /os/map ohnehin 60s. Referenz wechselt
 * nur bei echter Änderung, damit das Radial-Layout nicht grundlos neu rechnet.
 */
export function useOsMap(runnerState: RunnerState): {
  osMap: OsMap
  loading: boolean
  refresh: (fresh?: boolean) => void
} {
  const [osMap, setOsMap] = useState<OsMap>(EMPTY)
  const [loading, setLoading] = useState(true)
  // Signatur der zuletzt nach Supabase gespiegelten Map — verhindert redundante Writes.
  const lastSavedRef = useRef('')

  const refresh = useCallback(
    async (fresh = false) => {
      if (runnerState !== 'online') {
        // Runner nicht erreichbar (z.B. HTTPS-Live-Domain, Safari-Mixed-Content):
        // letzten Snapshot aus Supabase lesen, damit der Graph nicht leer bleibt.
        const snap = await loadOsMapSnapshot()
        if (snap) setOsMap((prev) => (JSON.stringify(prev) === JSON.stringify(snap) ? prev : snap))
        setLoading(false)
        return
      }
      try {
        const next = await fetchOsMap(fresh)
        setOsMap((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
        // Frische Map für die Live-Domain spiegeln — nur bei echter Änderung.
        const sig = JSON.stringify(next)
        if (sig !== lastSavedRef.current) {
          lastSavedRef.current = sig
          void saveOsMapSnapshot(next)
        }
      } catch {
        /* Runner kurz weg — nächster Poll versucht es erneut */
      } finally {
        setLoading(false)
      }
    },
    [runnerState],
  )

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => void refresh(), 60000)
    return () => window.clearInterval(interval)
  }, [refresh])

  return { osMap, loading, refresh }
}
