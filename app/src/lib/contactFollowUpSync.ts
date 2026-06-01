import { loadList, saveList } from './storage'
import { supabase } from './supabase'
import type { Contact, Task } from '../types/db'

export const CONTACT_FOLLOW_UP_CLEARED_EVENT = 'brand-os:contact-follow-up-cleared'

export function shouldClearContactFollowUp(
  contact: Pick<Contact, 'next_follow_up_at'>,
  task: Pick<Task, 'source' | 'due_at' | 'status'>,
  otherOpenTasks: Task[],
): boolean {
  if (task.status === 'done' || task.status === 'cancelled') return false
  if (!contact.next_follow_up_at) return false

  if (task.source === 'follow_up') return true

  const sameDay =
    task.due_at && contact.next_follow_up_at.slice(0, 10) === task.due_at.slice(0, 10)
  if (sameDay) return true

  if (otherOpenTasks.length === 0) return true

  return false
}

export function emitContactFollowUpCleared(contactId: string): void {
  window.dispatchEvent(
    new CustomEvent(CONTACT_FOLLOW_UP_CLEARED_EVENT, { detail: { contactId } }),
  )
}

export async function clearContactFollowUpRemote(
  brandId: string,
  brandSlug: string,
  contactId: string,
): Promise<void> {
  emitContactFollowUpCleared(contactId)

  const raw = loadList<Contact>([brandSlug, 'contacts'])
  const next = raw.map((c) =>
    c.id === contactId
      ? {
          ...c,
          next_follow_up_at: null,
          follow_up_type: '' as Contact['follow_up_type'],
        }
      : c,
  )
  saveList([brandSlug, 'contacts'], next)

  if (!supabase) return
  await supabase
    .from('contacts')
    .update({ next_follow_up_at: null, follow_up_type: '' })
    .eq('id', contactId)
    .eq('brand_id', brandId)
}
