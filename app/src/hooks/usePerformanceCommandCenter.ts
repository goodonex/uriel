import { useCallback, useEffect, useMemo, useRef } from 'react'
import { readCachedMrr, writeCachedMrr } from '../lib/performanceCache'
import { DEFAULT_H2_2026_TARGETS } from '../lib/performanceSeeds'
import { daysUntil } from '../lib/performanceDates'
import {
  buildDailyScorecard,
  buildWeeklyPulse,
  linearMrrPlanProgress,
} from '../lib/performanceMetrics'
import { startOfWeekMondayMs } from '../lib/performanceDates'
import { useActivityLog } from './useActivityLog'
import { useActivityEntries } from './useActivityEntries'
import { useBusinessTargets } from './useBusinessTargets'
import { useCallLogs } from './useSalesPro'
import { useContacts } from './useContacts'
import { useContentPieces } from './useContentPieces'
import { useDailyMetricTargets } from './useDailyMetricTargets'
import { useMrrMetrics } from './useMrrMetrics'
import { useOpportunities } from './useOpportunities'

export function usePerformanceCommandCenter(brandSlug: string | undefined) {
  const calls = useCallLogs(brandSlug, { limit: 500 })
  const activityLog = useActivityLog(brandSlug, 500)
  const crmEntries = useActivityEntries(brandSlug, { limit: 500 })
  const contacts = useContacts(brandSlug)
  const pieces = useContentPieces(brandSlug)
  const opportunities = useOpportunities()
  const dailyTargets = useDailyMetricTargets(brandSlug)
  const businessTargets = useBusinessTargets(brandSlug)
  const { metrics } = useMrrMetrics(brandSlug)
  const oppsLoaded = useRef(false)

  useEffect(() => {
    if (!brandSlug || oppsLoaded.current) return
    const ids = contacts.items.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    oppsLoaded.current = true
    void opportunities.loadForContacts(ids)
  }, [brandSlug, contacts.items, opportunities])

  useEffect(() => {
    if (!brandSlug || contacts.loading) return
    writeCachedMrr(brandSlug, metrics.currentMrr)
  }, [brandSlug, contacts.loading, metrics.currentMrr])

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
      dialAttempts: dailyTargets.current?.dial_attempts_target ?? 50,
      linkedin: dailyTargets.current?.linkedin_target ?? 30,
      pitches: dailyTargets.current?.pitches_target ?? 5,
    }),
    [
      dailyTargets.current?.dial_attempts_target,
      dailyTargets.current?.linkedin_target,
      dailyTargets.current?.pitches_target,
    ],
  )

  const week = useMemo(
    () =>
      buildWeeklyPulse(
        crmEntries.items,
        activityLog.items,
        contacts.items,
        opportunities.items,
        pieces.items,
        startOfWeekMondayMs(),
      ),
    [crmEntries.items, activityLog.items, contacts.items, opportunities.items, pieces.items],
  )

  const nordstern = useMemo(() => {
    const t = businessTargets.current ?? DEFAULT_H2_2026_TARGETS
    const cachedMrr = brandSlug ? readCachedMrr(brandSlug) : undefined
    const mrr =
      contacts.loading && cachedMrr !== undefined ? cachedMrr : metrics.currentMrr
    const target = t.north_star_mrr
    const pct = target > 0 ? Math.min(100, Math.round((mrr / target) * 100)) : 0
    const plan = linearMrrPlanProgress(
      mrr,
      target,
      '2026-07-01',
      t.north_star_deadline,
    )
    const accent = plan.onTrack
      ? 'var(--accent-success, var(--accent-teal))'
      : pct >= 70
        ? 'var(--accent-amber)'
        : 'var(--accent-coral)'
    return {
      mrr,
      target,
      pct,
      days: daysUntil(t.north_star_deadline),
      accent,
      hireReached: mrr >= t.hire_trigger_mrr,
    }
  }, [brandSlug, businessTargets.current, contacts.loading, metrics.currentMrr])

  const reloadActivity = useCallback(async () => {
    await activityLog.reload()
  }, [activityLog])

  return {
    counts,
    targets: targetValues,
    week,
    nordstern,
    weekLoading: pieces.loading && pieces.items.length === 0,
    reloadActivity,
  }
}
