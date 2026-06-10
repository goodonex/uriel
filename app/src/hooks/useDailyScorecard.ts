import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useCallLogs } from './useSalesPro'
import { useActivityLog } from './useActivityLog'
import { useActivityEntries } from './useActivityEntries'
import { useContacts } from './useContacts'
import { useContentPieces } from './useContentPieces'
import { useOpportunities } from './useOpportunities'
import { useDailyMetricTargets } from './useDailyMetricTargets'
import {
  buildDailyScorecard,
  buildWeeklyPulse,
  type DailyScorecardCounts,
  type WeeklyPulseData,
} from '../lib/performanceMetrics'
import { startOfWeekMondayMs } from '../lib/performanceDates'

export interface DailyScorecardResult {
  counts: DailyScorecardCounts
  targets: {
    dialAttempts: number
    linkedin: number
    pitches: number
  }
  loading: boolean
  reload: () => Promise<void>
}

export function useDailyScorecard(brandSlug: string | undefined): DailyScorecardResult {
  const calls = useCallLogs(brandSlug, { limit: 500 })
  const activityLog = useActivityLog(brandSlug, 500)
  const crmEntries = useActivityEntries(brandSlug, { limit: 500 })
  const contacts = useContacts(brandSlug)
  const opportunities = useOpportunities()
  const targets = useDailyMetricTargets(brandSlug)
  const loadedOpps = useRef(false)

  useEffect(() => {
    if (!brandSlug || loadedOpps.current) return
    const ids = contacts.items.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    loadedOpps.current = true
    void opportunities.loadForContacts(ids)
  }, [brandSlug, contacts.items, opportunities])

  const reload = useCallback(async () => {
    await Promise.all([
      calls.reload(),
      activityLog.reload(),
      crmEntries.reload(),
      contacts.reload(),
    ])
  }, [calls, activityLog, crmEntries, contacts])

  const counts = useMemo(
    () =>
      buildDailyScorecard(
        calls.items,
        crmEntries.items,
        activityLog.items,
        contacts.items,
        opportunities.items,
      ),
    [calls.items, crmEntries.items, activityLog.items, contacts.items, opportunities.items],
  )

  const targetValues = useMemo(
    () => ({
      dialAttempts: targets.current?.dial_attempts_target ?? 50,
      linkedin: targets.current?.linkedin_target ?? 30,
      pitches: targets.current?.pitches_target ?? 5,
    }),
    [targets.current],
  )

  const loading =
    calls.loading ||
    activityLog.loading ||
    crmEntries.loading ||
    contacts.loading ||
    targets.loading

  return { counts, targets: targetValues, loading, reload }
}

export function useWeeklyPulse(brandSlug: string | undefined): {
  data: WeeklyPulseData
  loading: boolean
} {
  const activityLog = useActivityLog(brandSlug, 500)
  const crmEntries = useActivityEntries(brandSlug, { limit: 500 })
  const contacts = useContacts(brandSlug)
  const pieces = useContentPieces(brandSlug)
  const opportunities = useOpportunities()
  const loadedOpps = useRef(false)

  useEffect(() => {
    if (!brandSlug || loadedOpps.current) return
    const ids = contacts.items.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    loadedOpps.current = true
    void opportunities.loadForContacts(ids)
  }, [brandSlug, contacts.items, opportunities])

  const data = useMemo(
    () =>
      buildWeeklyPulse(
        crmEntries.items,
        activityLog.items,
        contacts.items,
        opportunities.items,
        pieces.items,
        startOfWeekMondayMs(),
      ),
    [
      crmEntries.items,
      activityLog.items,
      contacts.items,
      opportunities.items,
      pieces.items,
    ],
  )

  const loading =
    activityLog.loading ||
    crmEntries.loading ||
    contacts.loading ||
    pieces.loading

  return { data, loading }
}
