import { useCallback, useEffect, useState } from 'react'
import type { RunSummary, VaultGraph } from './runnerApi'
import { fetchRuns, fetchVaultGraph } from './runnerApi'
import { useRunnerStatus } from './useRunnerStatus'

/**
 * Runs + Vault-Notizen vom lokalen Runner (Phase 5).
 * Pollt nur, wenn der Runner online ist; bei laufenden Runs schneller (5s),
 * damit "done" zeitnah im Cockpit ankommt.
 */
export function useRunnerData() {
  const runner = useRunnerStatus()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [vaultGraph, setVaultGraph] = useState<VaultGraph>({ nodes: [], edges: [] })

  const refresh = useCallback(async () => {
    if (runner.state !== 'online') return
    try {
      const [r, g] = await Promise.all([fetchRuns(20), fetchVaultGraph()])
      // Referenz nur wechseln, wenn sich Inhalte ändern — sonst baut der
      // ForceGraph bei jedem Poll neu auf (Zoom/Pan/Layout gehen verloren)
      setRuns((prev) => (JSON.stringify(prev) === JSON.stringify(r) ? prev : r))
      setVaultGraph((prev) => (JSON.stringify(prev) === JSON.stringify(g) ? prev : g))
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

  return { runner, runs, vaultGraph, refresh }
}
