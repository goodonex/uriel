import { formatEuroDe, pipelineValueEuro } from '../../lib/salesPipelineFilters'
import type { Contact, PipelineStage } from '../../types/db'

export const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function startOfWeekMondayMs(): number {
  const x = new Date()
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function isFollowUpDueTodayOrBefore(nextFollowUpAt: string | null): boolean {
  if (!nextFollowUpAt) return false
  return nextFollowUpAt.slice(0, 10) <= ymdToday()
}

export function contactCardTitle(c: Contact): string {
  const n = c.name?.trim()
  if (n) return n
  const em = c.email?.trim()
  if (em) return em
  const ph = c.phone?.trim()
  if (ph) return ph
  return 'Unbenannt'
}

export function buildSalesOverview(items: Contact[]) {
  const active = items.filter((c) => c.pipeline_stage !== 'paused')
  const dueToday = active.filter((c) => isFollowUpDueTodayOrBefore(c.next_follow_up_at))
  const wk0 = startOfWeekMondayMs()
  const weekDeals = items.filter(
    (c) => c.pipeline_stage === 'deal' && new Date(c.updated_at).getTime() >= wk0,
  )
  return {
    totalInPipeline: active.length,
    dueTodayCount: dueToday.length,
    weekClosedCount: weekDeals.length,
    dueTodayList: dueToday,
    pipelineValue: formatEuroDe(pipelineValueEuro(items)),
  }
}
