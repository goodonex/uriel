import type { Contact, FollowUpType } from '../types/db'

const TYPE_LABEL: Record<FollowUpType, string> = {
  '': 'Follow-up',
  call: 'Anruf',
  meeting: 'Meeting',
  email: 'E-Mail',
  other: 'Sonstiges',
}

export function fmtFollowUpDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

export function followUpTaskTitle(contact: Contact): string {
  if (!contact.next_follow_up_at) return ''
  const typeLabel = TYPE_LABEL[contact.follow_up_type ?? ''] ?? 'Follow-up'
  return `Nächster FU: ${fmtFollowUpDateTime(contact.next_follow_up_at)} — ${typeLabel}`
}
