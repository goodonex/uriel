import { useEffect, useState } from 'react'

export const RUNNER_BASE_URL = 'http://127.0.0.1:4711'

export type RunnerState = 'online' | 'offline' | 'checking'

interface RunnerStatusPayload {
  alive: boolean
  running: Array<{ id: string; agent: string; startedAt: string }>
  queued: Array<{ id: string; agent: string }>
}

/**
 * Pollt den lokalen Runner (Phase 5). Solange der Runner nicht existiert,
 * meldet der Hook ehrlich "offline" — die Statusleiste zeigt das als grauen Punkt.
 */
export function useRunnerStatus(pollMs = 15000): {
  state: RunnerState
  runningCount: number
} {
  const [state, setState] = useState<RunnerState>('checking')
  const [runningCount, setRunningCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 2500)
      try {
        const res = await fetch(`${RUNNER_BASE_URL}/status`, { signal: controller.signal })
        if (cancelled) return
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as RunnerStatusPayload
        if (cancelled) return
        setState(data.alive ? 'online' : 'offline')
        setRunningCount(data.running?.length ?? 0)
      } catch {
        if (!cancelled) {
          setState('offline')
          setRunningCount(0)
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void check()
    const interval = window.setInterval(() => void check(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [pollMs])

  return { state, runningCount }
}
