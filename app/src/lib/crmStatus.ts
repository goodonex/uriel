import { generateId } from './storage'
import type { ContactStatus } from '../types/db'

export type ContactStatusMeta = {
  value: ContactStatus
  label: string
  color: string
  bold?: boolean
  strikethrough?: boolean
}

export const CONTACT_STATUS_OPTIONS: readonly ContactStatusMeta[] = [
  { value: 'not_contacted', label: 'Nicht kontaktiert', color: 'var(--text-tertiary)' },
  { value: 'not_reached', label: 'Nicht erreicht', color: 'var(--accent-amber)' },
  { value: 'in_contact', label: 'In Kontakt', color: 'var(--accent-blue)' },
  { value: 'high_potential', label: 'High Potential', color: '#4ade80' },
  { value: 'followup_planned', label: 'Follow-up geplant', color: 'var(--accent-teal)' },
  { value: 'offer_made', label: 'Angebot gemacht', color: '#a78bfa' },
  { value: 'unqualified', label: 'Unqualifiziert', color: 'var(--accent-coral)' },
  { value: 'deal_won', label: 'Kunde (aktiv)', color: '#4ade80', bold: true },
  { value: 'customer_inactive', label: 'Kunde (nicht aktiv)', color: 'var(--text-tertiary)' },
  { value: 'deal_lost', label: 'Deal verloren', color: 'var(--accent-coral)', strikethrough: true },
] as const

export function contactStatusMeta(status: ContactStatus | undefined): ContactStatusMeta {
  return (
    CONTACT_STATUS_OPTIONS.find((o) => o.value === status) ?? CONTACT_STATUS_OPTIONS[0]
  )
}

export function logStatusChange(
  activityLog: { id: string; text: string; at: string }[],
  prev: ContactStatus | undefined,
  next: ContactStatus,
): { id: string; text: string; at: string }[] {
  if (prev === next) return activityLog
  const prevLabel = contactStatusMeta(prev).label
  const nextLabel = contactStatusMeta(next).label
  return [
    {
      id: generateId(),
      text: `Status: ${prevLabel} → ${nextLabel}`,
      at: new Date().toISOString(),
    },
    ...activityLog,
  ]
}
