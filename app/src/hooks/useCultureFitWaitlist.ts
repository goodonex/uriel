/**
 * Lädt Live-Statistik der CultureFit-Warteliste.
 * Endpoint: https://culturefit.to/api/waitlist/stats
 *
 * Konfiguration:
 *   VITE_CULTUREFIT_STATS_URL (optional, default = https://culturefit.to/api/waitlist/stats)
 *
 * Failsafe: wenn der Endpoint nicht erreichbar ist (CORS, 404, Timeout), zeigt UI "—".
 * Poll-Intervall: 60 Sekunden.
 */
import { useEffect, useRef, useState } from 'react'

export interface WaitlistStats {
  total: number
  this_week?: number
  by_role?: Record<string, number>
  fetched_at: string
}

interface State {
  data: WaitlistStats | null
  loading: boolean
  error: string | null
}

const DEFAULT_URL =
  (import.meta.env.VITE_CULTUREFIT_STATS_URL as string | undefined) ??
  'https://culturefit.to/api/waitlist/stats'

const REFRESH_MS = 60_000

export function useCultureFitWaitlist(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const abortRef = useRef<AbortController | null>(null)

  const fetchOnce = async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(DEFAULT_URL, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        setState({ data: null, loading: false, error: `http_${res.status}` })
        return
      }
      const json = (await res.json()) as Partial<WaitlistStats> & {
        // Tolerant: andere Feldnamen abfangen
        count?: number
        applicants?: number
      }
      const total =
        typeof json.total === 'number'
          ? json.total
          : typeof json.count === 'number'
            ? json.count
            : typeof json.applicants === 'number'
              ? json.applicants
              : 0
      setState({
        data: {
          total,
          this_week: json.this_week,
          by_role: json.by_role,
          fetched_at: new Date().toISOString(),
        },
        loading: false,
        error: null,
      })
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return
      setState({ data: null, loading: false, error: 'fetch_failed' })
    }
  }

  useEffect(() => {
    void fetchOnce()
    const handle = window.setInterval(() => void fetchOnce(), REFRESH_MS)
    return () => {
      window.clearInterval(handle)
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ...state, reload: fetchOnce }
}
