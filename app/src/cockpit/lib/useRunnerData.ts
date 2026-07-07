import { useCallback, useEffect, useState } from 'react'
import type { RunSummary, VaultNote } from './runnerApi'
import { fetchRuns, fetchVaultRecent } from './runnerApi'
import { useRunnerStatus } from './useRunnerStatus'

/**
 * Runs + Vault-Notizen vom lokalen Runner (Phase 5).
 * Pollt nur, wenn der Runner online ist; bei laufenden Runs schneller (5s),
 * damit "done" zeitnah im Cockpit ankommt.
 */
export function useRunnerData() {
  const runner = useRunnerStatus()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [notes, setNotes] = useState<VaultNote[]>([])

  const refresh = useCallback(async () => {
    if (runner.state !== 'online') return
    try {
      const [r, n] = await Promise.all([fetchRuns(20), fetchVaultRecent(15)])
      setRuns(r)
      setNotes(n)
    } catch {
      /* Runner kurz weg — nächster Poll versucht es wieder */
    }
  }, [runner.state])

  useEffect(() => {
    void refresh()
    const hasActive = runs.some((r) => r.status === 'running')
    const interval = window.setInterval(() => void refresh(), hasActive ? 5000 : 20000)
    return () => window.clearInterval(interval)
  }, [refresh, runs.some((r) => r.status === 'running')]) // eslint-disable-line react-hooks/exhaustive-deps

  return { runner, runs, notes, refresh }
}
