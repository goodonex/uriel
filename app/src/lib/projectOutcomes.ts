import type { Contact } from '../types/db'

export interface ProjectOutcomes {
  totalLeads: number
  projectedRevenue: number
}

type OutcomeLead = Pick<Contact, 'portal_lead_status' | 'potenzial_betrag'>

/** Hochgerechneter Umsatz: closed × AVG(potenzial_betrag). Ohne potenzial_betrag → 0. */
export function computeProjectOutcomes(leads: OutcomeLead[]): ProjectOutcomes {
  const totalLeads = leads.length
  const closedCount = leads.filter((l) => l.portal_lead_status === 'closed').length
  const withPotenzial = leads.filter((l) => (l.potenzial_betrag ?? 0) > 0)

  if (withPotenzial.length === 0) {
    return { totalLeads, projectedRevenue: 0 }
  }

  const avgDeal =
    withPotenzial.reduce((sum, l) => sum + (l.potenzial_betrag ?? 0), 0) / withPotenzial.length

  return {
    totalLeads,
    projectedRevenue: closedCount * avgDeal,
  }
}

export function formatProjectRevenue(euro: number): string {
  if (euro <= 0) return '0 €'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(euro)
}
