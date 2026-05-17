import type { AdCampaign } from '../types/db'
import type { Contact, LeadQuality } from '../types/db'
import type { FunnelNodeRow } from '../types/funnel'
import type { PromoPerformanceRow } from '../hooks/usePromoPerformance'

export interface FunnelEconomics {
  totalSpend: number
  totalLeads: number
  goodLeads: number
  cpl: number | null
  cpgl: number | null
  funnelValue: number
  goodLeadRate: number | null
}

export function formatMetricEuro(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`
}

export function formatMetricRatio(good: number, total: number): string {
  if (total <= 0) return '—'
  return `${good} / ${total}`
}

function spendForCampaign(
  campaign: AdCampaign,
  performance: PromoPerformanceRow[],
): number {
  const byLabel = performance
    .filter(
      (p) =>
        p.label === campaign.name ||
        p.label === campaign.id ||
        (campaign.utm_campaign && p.label === campaign.utm_campaign),
    )
    .reduce((s, p) => s + (p.spend || 0), 0)
  if (byLabel > 0) return byLabel
  return campaign.budget_spent ?? 0
}

export function computeFunnelEconomics(
  funnelId: string,
  funnelNodes: FunnelNodeRow[],
  contacts: Contact[],
  campaigns: AdCampaign[],
  performance: PromoPerformanceRow[],
): FunnelEconomics {
  const adNodes = funnelNodes.filter((n) => n.funnel_id === funnelId && n.type === 'ad')
  const campaignIds = new Set<string>()
  for (const n of adNodes) {
    const cid = (n.config as Record<string, unknown>)?.campaign_id
    if (typeof cid === 'string' && cid) campaignIds.add(cid)
  }

  let totalSpend = 0
  for (const cid of campaignIds) {
    const camp = campaigns.find((c) => c.id === cid)
    if (camp) totalSpend += spendForCampaign(camp, performance)
  }

  const funnelContacts = contacts.filter((c) => c.source_funnel_id === funnelId)
  const totalLeads = funnelContacts.length
  const goodLeads = funnelContacts.filter((c) => c.lead_quality === 'good').length
  const funnelValue = funnelContacts
    .filter((c) => c.lead_quality === 'good')
    .reduce((s, c) => s + (c.lead_value ?? 0), 0)

  const cpl = totalLeads > 0 && totalSpend > 0 ? totalSpend / totalLeads : null
  const cpgl = goodLeads > 0 && totalSpend > 0 ? totalSpend / goodLeads : null
  const goodLeadRate = totalLeads > 0 ? goodLeads / totalLeads : null

  return {
    totalSpend,
    totalLeads,
    goodLeads,
    cpl,
    cpgl,
    funnelValue,
    goodLeadRate,
  }
}

export const LEAD_QUALITY_CYCLE: LeadQuality[] = ['unqualified', 'good', 'bad']

export function nextLeadQuality(current: LeadQuality): LeadQuality {
  const i = LEAD_QUALITY_CYCLE.indexOf(current)
  return LEAD_QUALITY_CYCLE[(i + 1) % LEAD_QUALITY_CYCLE.length]
}
