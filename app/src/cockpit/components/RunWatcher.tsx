import { useEffect, useRef } from 'react'
import { useToast } from '../../components/Toast'
import { useRunnerData } from '../lib/useRunnerData'

/**
 * Shell-weiter Wächter: meldet per Toast, wenn ein Agent-Run fertig wird —
 * egal in welchem Cockpit-Bereich Kevin gerade arbeitet.
 */
export function RunWatcher() {
  const { runs } = useRunnerData()
  const { show } = useToast()
  const knownRunning = useRef<Set<string>>(new Set())

  useEffect(() => {
    const nowRunning = new Set(runs.filter((r) => r.status === 'running').map((r) => r.id))

    // Runs, die vorher liefen und jetzt nicht mehr → fertig oder Fehler
    for (const id of knownRunning.current) {
      if (!nowRunning.has(id)) {
        const done = runs.find((r) => r.id === id)
        if (done?.status === 'error') {
          show(`⚠ ${done.agent} fehlgeschlagen`, 'error')
        } else {
          show(`✓ ${done?.agent ?? 'Agent'} fertig — im Cockpit ansehen`)
        }
      }
    }
    knownRunning.current = nowRunning
  }, [runs, show])

  return null
}
