import { useEffect, useRef } from 'react'
import { isAfterHour, isFriday, startOfWeekIsoDate } from '../lib/performanceDates'
import { linearMrrPlanProgress } from '../lib/performanceMetrics'
import { useBusinessTargets } from './useBusinessTargets'
import { useDailyScorecard } from './useDailyScorecard'
import { useMrrMetrics } from './useMrrMetrics'
import { useTasks } from './useTasks'
import { useWeeklyReview } from './useWeeklyReview'

const DAILY_TASK_PREFIX = 'performance:daily:'
const WEEKLY_TASK_PREFIX = 'performance:weekly:'
const MILESTONE_TASK_PREFIX = 'performance:milestone:'

export function usePerformanceFocusTasks(brandSlug: string | undefined): void {
  const tasks = useTasks(brandSlug)
  const { counts, targets } = useDailyScorecard(brandSlug)
  const { current: weeklyReview } = useWeeklyReview(brandSlug)
  const { current: businessTargets } = useBusinessTargets(brandSlug)
  const { metrics } = useMrrMetrics(brandSlug)
  const ran = useRef(false)

  useEffect(() => {
    if (!brandSlug || tasks.loading) return
    if (ran.current) return
    ran.current = true

    const weekStart = startOfWeekIsoDate()
    const openTasks = tasks.items.filter(
      (t) => t.status !== 'done' && t.status !== 'cancelled',
    )

    if (isAfterHour(17)) {
      const remaining = Math.max(0, targets.dialAttempts - counts.dialAttempts)
      const key = `${DAILY_TASK_PREFIX}${new Date().toISOString().slice(0, 10)}`
      if (
        remaining > 0 &&
        counts.dialAttempts < targets.dialAttempts * 0.5 &&
        !openTasks.some((t) => t.notes === key)
      ) {
        tasks.create({
          title: `Noch ${remaining} Wählversuche heute`,
          notes: key,
          source: 'system',
          priority: 1,
        })
      }
    }

    if (isFriday()) {
      const key = `${WEEKLY_TASK_PREFIX}${weekStart}`
      if (!weeklyReview?.completed_at && !openTasks.some((t) => t.notes === key)) {
        tasks.create({
          title: 'Wochen-Review (15 Min)',
          notes: key,
          source: 'system',
          priority: 1,
        })
      }
    }

    if (businessTargets && metrics.currentMrr >= businessTargets.hire_trigger_mrr) {
      const key = `${MILESTONE_TASK_PREFIX}hire-mrr`
      if (!openTasks.some((t) => t.notes === key)) {
        tasks.create({
          title: 'Festanstellungs-Trigger erreicht (MRR)',
          notes: key,
          source: 'system',
          priority: 1,
        })
      }
    }

    const plan = businessTargets
      ? linearMrrPlanProgress(
          metrics.currentMrr,
          businessTargets.north_star_mrr,
          '2026-07-01',
          businessTargets.north_star_deadline,
        )
      : null

    if (plan && !plan.onTrack && metrics.currentMrr > 0) {
      const key = `${MILESTONE_TASK_PREFIX}behind-plan`
      if (!openTasks.some((t) => t.notes === key)) {
        tasks.create({
          title: 'Hinter 8k-MRR-Plan — Aktivität hochfahren',
          notes: key,
          source: 'system',
          priority: 2,
        })
      }
    }

    if (metrics.monthlyChurnRate > 5) {
      const key = `${MILESTONE_TASK_PREFIX}churn`
      if (!openTasks.some((t) => t.notes === key)) {
        tasks.create({
          title: 'Retainer-Churn prüfen (>5%)',
          notes: key,
          source: 'system',
          priority: 1,
        })
      }
    }
  }, [
    brandSlug,
    businessTargets,
    counts.dialAttempts,
    metrics.currentMrr,
    metrics.monthlyChurnRate,
    targets.dialAttempts,
    tasks.items,
    tasks.loading,
    weeklyReview?.completed_at,
  ])
}
