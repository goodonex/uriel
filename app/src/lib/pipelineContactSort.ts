import type { Contact } from '../types/db'
import type { KanbanColumnSort } from './crmViewStorage'

export const KANBAN_SORT_LABEL: Record<KanbanColumnSort, string> = {
  follow_up: 'Follow-up',
  created_desc: 'Neueste (Erstellt)',
  created_asc: 'Älteste (Erstellt)',
  updated_desc: 'Zuletzt geändert',
  updated_asc: 'Zuerst geändert',
  name_asc: 'A → Z',
  name_desc: 'Z → A',
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

function isFollowUpOverdue(contact: Contact): boolean {
  if (!contact.next_follow_up_at) return false
  if (contact.pipeline_stage === 'deal' || contact.pipeline_stage === 'paused') return false
  const ymd = contact.next_follow_up_at.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return ymd <= today
}

function contactCreatedMs(c: Contact): number {
  const raw = c.created_at ?? c.updated_at
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Sortierung für Pipeline-Listen, Tabelle, Carousel und Kanban-Spalten. */
export function sortPipelineContacts(list: Contact[], sort: KanbanColumnSort): Contact[] {
  return [...list].sort((a, b) => {
    if (sort === 'follow_up') {
      const aOver = isFollowUpOverdue(a) ? 0 : 1
      const bOver = isFollowUpOverdue(b) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      const ax = a.next_follow_up_at?.slice(0, 10) ?? '9999-12-31'
      const bx = b.next_follow_up_at?.slice(0, 10) ?? '9999-12-31'
      if (ax !== bx) return ax.localeCompare(bx)
      return contactCardTitle(a).localeCompare(contactCardTitle(b), 'de')
    }
    if (sort === 'created_desc') return contactCreatedMs(b) - contactCreatedMs(a)
    if (sort === 'created_asc') return contactCreatedMs(a) - contactCreatedMs(b)
    if (sort === 'updated_desc') {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    }
    if (sort === 'updated_asc') {
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    }
    if (sort === 'name_desc') {
      return contactCardTitle(b).localeCompare(contactCardTitle(a), 'de')
    }
    return contactCardTitle(a).localeCompare(contactCardTitle(b), 'de')
  })
}
