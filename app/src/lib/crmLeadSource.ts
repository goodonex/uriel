import type { LeadSource } from '../types/db'

export const LEAD_SOURCE_OPTIONS: ReadonlyArray<{ value: LeadSource; label: string }> = [
  { value: '', label: '—' },
  { value: 'cold', label: 'Kalt' },
  { value: 'referral', label: 'Empfehlung' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'website', label: 'Website' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Sonstiges' },
]

export function leadSourceLabel(v: LeadSource | undefined): string {
  return LEAD_SOURCE_OPTIONS.find((o) => o.value === v)?.label ?? '—'
}
