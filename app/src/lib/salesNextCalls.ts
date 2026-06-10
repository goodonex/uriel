import type { Contact, ContactStatus } from '../types/db'

/** Keine Erstkontakt-Wahl wenn disqualifiziert, Deal verloren oder Follow-up/Termin geplant. */
const EXCLUDED_STATUSES: ContactStatus[] = [
  'unqualified',
  'deal_lost',
  'followup_planned',
  'offer_made',
  'deal_won',
  'customer_inactive',
]

export function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** Erstkontakt mit Telefon, der jetzt angerufen werden soll. */
export function isNextCallCandidate(contact: Contact, today = ymdToday()): boolean {
  if (contact.pipeline_stage !== 'first_contact') return false
  if (!contact.phone?.trim()) return false
  if (EXCLUDED_STATUSES.includes(contact.contact_status)) return false

  if (contact.next_follow_up_at?.trim()) {
    const fuYmd = contact.next_follow_up_at.slice(0, 10)
    if (fuYmd >= today) return false
  }

  if (contact.follow_up_type === 'meeting' && contact.next_follow_up_at?.trim()) {
    return false
  }

  if (contact.last_contact_at?.slice(0, 10) === today) return false

  return true
}

export function selectNextCalls(contacts: Contact[], limit = 10): Contact[] {
  const today = ymdToday()
  return contacts
    .filter((c) => isNextCallCandidate(c, today))
    .sort((a, b) => {
      const aFu = a.next_follow_up_at?.slice(0, 10) ?? ''
      const bFu = b.next_follow_up_at?.slice(0, 10) ?? ''
      if (aFu !== bFu) {
        if (!aFu) return -1
        if (!bFu) return 1
        return aFu.localeCompare(bFu)
      }
      const aLast = a.last_contact_at ?? ''
      const bLast = b.last_contact_at ?? ''
      return aLast.localeCompare(bLast)
    })
    .slice(0, limit)
}
