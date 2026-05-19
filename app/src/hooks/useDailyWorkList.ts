import { useCallback, useMemo, useState } from 'react'
import type { Contact } from '../types/db'
import { useContacts } from './useContacts'

export type WorkItemType = 'overdue' | 'today' | 'cold' | 'new'
export type WorkItemFilter = 'all' | 'overdue' | 'today' | 'cold'

export interface WorkItem {
  priority: 1 | 2 | 3
  type: WorkItemType
  contact: Contact
  action: string
  dueAt?: string
}

function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function ymdFromIso(iso: string | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

function tomorrowNoonIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

function daysSince(iso: string | null): number {
  if (!iso) return 9999
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 9999
  return Math.floor((Date.now() - t) / 86_400_000)
}

function classifyContact(contact: Contact, today: string): WorkItem | null {
  const fuYmd = ymdFromIso(contact.next_follow_up_at)

  if (fuYmd && fuYmd < today) {
    return {
      priority: 1,
      type: 'overdue',
      contact,
      action: 'Anruf fällig',
      dueAt: contact.next_follow_up_at ?? undefined,
    }
  }

  if (fuYmd === today) {
    return {
      priority: 2,
      type: 'today',
      contact,
      action: 'Follow-up heute',
      dueAt: contact.next_follow_up_at ?? undefined,
    }
  }

  if (!contact.next_follow_up_at && daysSince(contact.last_contact_at) >= 30) {
    return {
      priority: 3,
      type: 'cold',
      contact,
      action: '30 Tage keine Aktivität',
    }
  }

  return null
}

export function useDailyWorkList(brandSlug: string | undefined) {
  const contacts = useContacts(brandSlug)
  const [filter, setFilter] = useState<WorkItemFilter>('all')

  const allItems = useMemo(() => {
    const today = ymdToday()
    const items: WorkItem[] = []
    for (const c of contacts.items) {
      if (c.pipeline_stage === 'paused') continue
      const item = classifyContact(c, today)
      if (item) items.push(item)
    }
    items.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const aDue = a.dueAt ? new Date(a.dueAt).getTime() : 0
      const bDue = b.dueAt ? new Date(b.dueAt).getTime() : 0
      if (aDue && bDue) return aDue - bDue
      const aLast = a.contact.last_contact_at
        ? new Date(a.contact.last_contact_at).getTime()
        : 0
      const bLast = b.contact.last_contact_at
        ? new Date(b.contact.last_contact_at).getTime()
        : 0
      return aLast - bLast
    })
    return items
  }, [contacts.items])

  const overdueCount = useMemo(
    () => allItems.filter((i) => i.type === 'overdue').length,
    [allItems],
  )
  const todayCount = useMemo(
    () => allItems.filter((i) => i.type === 'today').length,
    [allItems],
  )
  const coldCount = useMemo(
    () => allItems.filter((i) => i.type === 'cold').length,
    [allItems],
  )

  const items = useMemo(() => {
    if (filter === 'all') return allItems
    return allItems.filter((i) => i.type === filter)
  }, [allItems, filter])

  const skipItem = useCallback(
    (contactId: string) => {
      contacts.update(contactId, { next_follow_up_at: tomorrowNoonIso() })
    },
    [contacts],
  )

  return {
    items,
    allItems,
    filter,
    setFilter,
    overdueCount,
    todayCount,
    coldCount,
    loading: contacts.loading,
    error: contacts.error,
    skipItem,
    contacts,
  }
}
