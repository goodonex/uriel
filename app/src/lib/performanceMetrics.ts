import type { ActivityEntry as ActivityLogEntry } from './activityLog'
import type { CallOutcome } from '../types/callOutcomes'
import type {
  AdCampaign,
  Contact,
  ContentPiece,
  Opportunity,
  SalesCallLog,
} from '../types/db'
import type { ActivityEntry as CrmActivityEntry } from '../types/db'
import {
  isInMonth,
  isInWeek,
  isSameLocalDay,
  startOfMonthIsoDate,
  startOfTodayMs,
  startOfWeekMondayMs,
} from './performanceDates'

const CONVERSATION_OUTCOMES: CallOutcome[] = [
  'no_interest',
  'later',
  'follow_up',
  'meeting',
  'direct_yes',
]

const MEETING_OUTCOMES: CallOutcome[] = ['follow_up', 'meeting', 'direct_yes']

export interface DailyScorecardCounts {
  dialAttempts: number
  conversations: number
  linkedin: number
  pitches: number
  meetingsOrDeals: number
  loomVideos: number
}

export interface WeeklyPulseData {
  conversations: number
  pitches: number
  deals: number
  newCustomers: Array<{ name: string; product: string }>
  projectRevenue: number
  newMrr: number
  youtubePublished: boolean
  linkedinPosts: number
  badLeads: number
  churnWarnings: number
}

export interface MrrMetrics {
  currentMrr: number
  activeRetainers: number
  activeCustomers: number
  monthlyChurnRate: number
  newCustomersThisMonth: number
  projectRevenueThisMonth: number
  totalRevenueThisMonth: number
}

function parseCallOutcome(data: Record<string, unknown>): CallOutcome | null {
  const o = data.outcome
  if (typeof o !== 'string') return null
  return o as CallOutcome
}

export function countDialAttemptsToday(
  callLogs: SalesCallLog[],
  crmEntries: CrmActivityEntry[],
  todayMs = startOfTodayMs(),
): number {
  const logs = callLogs.filter((c) => isSameLocalDay(c.called_at, todayMs)).length
  const entries = crmEntries.filter(
    (e) => e.activity_type === 'call' && isSameLocalDay(e.created_at, todayMs),
  ).length
  return logs + entries
}

export function countConversationsToday(
  crmEntries: CrmActivityEntry[],
  todayMs = startOfTodayMs(),
): number {
  return crmEntries.filter((e) => {
    if (e.activity_type !== 'call') return false
    if (!isSameLocalDay(e.created_at, todayMs)) return false
    const outcome = parseCallOutcome(e.data)
    return outcome !== null && CONVERSATION_OUTCOMES.includes(outcome)
  }).length
}

export function countActivityLogToday(
  items: ActivityLogEntry[],
  action: ActivityLogEntry['action'],
  todayMs = startOfTodayMs(),
): number {
  return items.filter(
    (a) => a.action === action && isSameLocalDay(a.created_at, todayMs),
  ).length
}

export function countPitchesToday(
  contacts: Contact[],
  opportunities: Opportunity[],
  activityItems: ActivityLogEntry[],
  todayMs = startOfTodayMs(),
): number {
  const fromLog = countActivityLogToday(activityItems, 'pitch_sent', todayMs)
  const stageChanges = contacts.filter(
    (c) =>
      c.stage_changed_at &&
      isSameLocalDay(c.stage_changed_at, todayMs) &&
      c.pipeline_stage === 'proposal',
  ).length
  const oppPitch = opportunities.filter(
    (o) => o.stage === 'pitch' && isSameLocalDay(o.updated_at, todayMs),
  ).length
  return fromLog + stageChanges + oppPitch
}

export function countMeetingsOrDealsToday(
  crmEntries: CrmActivityEntry[],
  contacts: Contact[],
  todayMs = startOfTodayMs(),
): number {
  const fromCalls = crmEntries.filter((e) => {
    if (e.activity_type !== 'call') return false
    if (!isSameLocalDay(e.created_at, todayMs)) return false
    const outcome = parseCallOutcome(e.data)
    return outcome !== null && MEETING_OUTCOMES.includes(outcome)
  }).length
  const wonToday = contacts.filter(
    (c) => c.won_at && isSameLocalDay(c.won_at, todayMs),
  ).length
  return fromCalls + wonToday
}

export function buildDailyScorecard(
  callLogs: SalesCallLog[],
  crmEntries: CrmActivityEntry[],
  activityItems: ActivityLogEntry[],
  contacts: Contact[],
  opportunities: Opportunity[],
): DailyScorecardCounts {
  const todayMs = startOfTodayMs()
  return {
    dialAttempts: countDialAttemptsToday(callLogs, crmEntries, todayMs),
    conversations: countConversationsToday(crmEntries, todayMs),
    linkedin: countActivityLogToday(activityItems, 'linkedin_sent', todayMs),
    pitches: countPitchesToday(contacts, opportunities, activityItems, todayMs),
    meetingsOrDeals: countMeetingsOrDealsToday(crmEntries, contacts, todayMs),
    loomVideos: countActivityLogToday(activityItems, 'loom_created', todayMs),
  }
}

export function buildWeeklyPulse(
  crmEntries: CrmActivityEntry[],
  activityItems: ActivityLogEntry[],
  contacts: Contact[],
  opportunities: Opportunity[],
  pieces: ContentPiece[],
  weekStartMs = startOfWeekMondayMs(),
): WeeklyPulseData {
  const weekCalls = crmEntries.filter(
    (e) => e.activity_type === 'call' && isInWeek(e.created_at, weekStartMs),
  )
  const conversations = weekCalls.filter((e) => {
    const outcome = parseCallOutcome(e.data)
    return outcome !== null && CONVERSATION_OUTCOMES.includes(outcome)
  }).length

  const pitches =
    activityItems.filter(
      (a) => a.action === 'pitch_sent' && isInWeek(a.created_at, weekStartMs),
    ).length +
    contacts.filter(
      (c) =>
        c.stage_changed_at &&
        isInWeek(c.stage_changed_at, weekStartMs) &&
        c.pipeline_stage === 'proposal',
    ).length +
    opportunities.filter(
      (o) => o.stage === 'pitch' && isInWeek(o.updated_at, weekStartMs),
    ).length

  const wonThisWeek = contacts.filter((c) => c.won_at && isInWeek(c.won_at, weekStartMs))
  const deals = wonThisWeek.length

  const oppByContact = new Map(opportunities.map((o) => [o.contact_id, o]))
  const newCustomers = wonThisWeek.map((c) => ({
    name: c.name || c.company || c.email || 'Kunde',
    product: oppByContact.get(c.id)?.product ?? 'herrmann',
  }))

  let projectRevenue = 0
  let newMrr = 0
  for (const c of wonThisWeek) {
    const amount = c.potenzial_betrag ?? 0
    if (c.potenzial_typ === 'monatlich') newMrr += amount
    else projectRevenue += amount
  }

  const publishedThisWeek = pieces.filter(
    (p) => p.published_at && isInWeek(p.published_at, weekStartMs),
  )
  const youtubePublished = publishedThisWeek.some(
    (p) => p.tags.format === 'article' || p.tags.format === 'reel',
  )
  const linkedinPosts = publishedThisWeek.filter((p) => p.tags.channel === 'linkedin').length

  const badLeads = contacts.filter(
    (c) => c.lead_quality === 'bad' && isInWeek(c.updated_at, weekStartMs),
  ).length

  const churnWarnings = contacts.filter((c) => {
    if (c.potenzial_typ !== 'monatlich') return false
    if (c.lost_at && isInWeek(c.lost_at, weekStartMs)) return true
    return (
      c.pipeline_stage === 'paused' &&
      c.stage_changed_at &&
      isInWeek(c.stage_changed_at, weekStartMs)
    )
  }).length

  return {
    conversations,
    pitches,
    deals,
    newCustomers,
    projectRevenue,
    newMrr,
    youtubePublished,
    linkedinPosts,
    badLeads,
    churnWarnings,
  }
}

export function computeMrrMetrics(contacts: Contact[], ref = new Date()): MrrMetrics {
  const monthStart = startOfMonthIsoDate(ref)
  const activeRetainers = contacts.filter(
    (c) =>
      c.pipeline_stage === 'deal' &&
      c.potenzial_typ === 'monatlich' &&
      !c.lost_at,
  )
  const currentMrr = activeRetainers.reduce((s, c) => s + (c.potenzial_betrag ?? 0), 0)
  const activeCustomers = contacts.filter(
    (c) => c.pipeline_stage === 'deal' && !c.lost_at,
  ).length

  const retainerAtMonthStart = contacts.filter((c) => {
    if (c.potenzial_typ !== 'monatlich') return false
    if (c.pipeline_stage !== 'deal' && !c.won_at) return false
    const wonBefore =
      c.won_at && new Date(c.won_at).getTime() < new Date(monthStart).getTime()
    const stillActive = !c.lost_at || !isInMonth(c.lost_at, monthStart)
    return wonBefore && stillActive
  }).length

  const churnedThisMonth = contacts.filter(
    (c) =>
      c.potenzial_typ === 'monatlich' &&
      c.lost_at &&
      isInMonth(c.lost_at, monthStart),
  ).length

  const monthlyChurnRate =
    retainerAtMonthStart > 0 ? (churnedThisMonth / retainerAtMonthStart) * 100 : 0

  const newCustomersThisMonth = contacts.filter(
    (c) => c.won_at && isInMonth(c.won_at, monthStart),
  ).length

  let projectRevenueThisMonth = 0
  let newMrr = 0
  for (const c of contacts) {
    if (!c.won_at || !isInMonth(c.won_at, monthStart)) continue
    const amount = c.potenzial_betrag ?? 0
    if (c.potenzial_typ === 'monatlich') newMrr += amount
    else projectRevenueThisMonth += amount
  }

  return {
    currentMrr,
    activeRetainers: activeRetainers.length,
    activeCustomers,
    monthlyChurnRate,
    newCustomersThisMonth,
    projectRevenueThisMonth,
    totalRevenueThisMonth: projectRevenueThisMonth + currentMrr,
  }
}

export function computeAdsMetrics(campaigns: AdCampaign[]): {
  cpl: number | null
  cpk: number | null
  totalSpend: number
  totalLeads: number
} {
  const live = campaigns.filter((c) => c.status === 'live')
  if (live.length === 0) {
    return { cpl: null, cpk: null, totalSpend: 0, totalLeads: 0 }
  }
  const totalSpend = live.reduce((s, c) => s + (c.budget_spent ?? 0), 0)
  const totalLeads = live.reduce((s, c) => s + (c.leads_count ?? 0), 0)
  const cpl = totalLeads > 0 ? totalSpend / totalLeads : null
  const withCpl = live.filter((c) => c.cost_per_lead > 0)
  const cpk =
    withCpl.length > 0
      ? withCpl.reduce((s, c) => s + c.cost_per_lead, 0) / withCpl.length
      : cpl
  return { cpl, cpk, totalSpend, totalLeads }
}

export function linearMrrPlanProgress(
  currentMrr: number,
  targetMrr: number,
  periodStart: string,
  deadline: string,
): { pct: number; expectedMrr: number; onTrack: boolean } {
  const start = new Date(periodStart).getTime()
  const end = new Date(deadline).getTime()
  const now = Date.now()
  const total = end - start
  const elapsed = Math.max(0, Math.min(total, now - start))
  const expectedMrr = total > 0 ? (elapsed / total) * targetMrr : targetMrr
  const pct = targetMrr > 0 ? Math.min(100, (currentMrr / targetMrr) * 100) : 0
  const onTrack = currentMrr >= expectedMrr * 0.85
  return { pct, expectedMrr, onTrack }
}
