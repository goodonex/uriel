import { useCallback, useMemo } from 'react'
import { computeMrrMetrics } from '../lib/performanceMetrics'
import { startOfMonthIsoDate } from '../lib/performanceDates'
import type { MrrMetrics } from '../lib/performanceMetrics'
import { useContacts } from './useContacts'

export function useMrrMetrics(brandSlug: string | undefined): {
  metrics: MrrMetrics
  loading: boolean
  reload: () => Promise<void>
} {
  const contacts = useContacts(brandSlug)

  const metrics = useMemo(
    () => computeMrrMetrics(contacts.items),
    [contacts.items],
  )

  const reload = useCallback(async () => {
    await contacts.reload()
  }, [contacts])

  return { metrics, loading: contacts.loading, reload }
}

export function useMrrDelta(
  brandSlug: string | undefined,
  previousMrr: number | null,
): number {
  const { metrics } = useMrrMetrics(brandSlug)
  if (previousMrr === null) return 0
  return metrics.currentMrr - previousMrr
}

export function currentMonthIso(): string {
  return startOfMonthIsoDate()
}
