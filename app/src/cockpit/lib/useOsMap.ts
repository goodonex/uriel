import { useCallback, useEffect, useState } from 'react'
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

  const refresh = useCallback(
    async (fresh = false) => {
      if (runnerState !== 'online') {
        setLoading(false)
        return
      }
      try {
        const next = await fetchOsMap(fresh)
        setOsMap((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
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
