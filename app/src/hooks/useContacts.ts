import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type { Contact } from '../types/db'

interface UseContactsResult {
  items: Contact[]
  loading: boolean
  error: string | null
  create: (
    partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
  ) => Contact
  update: (
    id: string,
    patch: Partial<Omit<Contact, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => void
}

export function useContacts(brandSlug: string | undefined): UseContactsResult {
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Contact[]>([])
  itemsRef.current = items

  useEffect(() => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      try {
        setItems(loadList<Contact>([brandSlug, 'contacts']))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      } finally {
        setLoading(false)
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [brandSlug])

  const persist = useCallback(
    (next: Contact[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'contacts'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (
      partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
    ): Contact => {
      const now = new Date().toISOString()
      const item: Contact = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
        name: partial?.name ?? 'Neuer Kontakt',
        email: partial?.email ?? '',
        source_content_piece_id: partial?.source_content_piece_id ?? null,
        source_campaign_id: partial?.source_campaign_id ?? null,
        pipeline_stage: partial?.pipeline_stage ?? 'first_contact',
        last_contact_at: partial?.last_contact_at ?? null,
        next_follow_up_at: partial?.next_follow_up_at ?? null,
        notes: partial?.notes ?? '',
        updated_at: now,
      }
      const next = [...itemsRef.current, item]
      setItems(next)
      persist(next)
      return item
    },
    [brandSlug, persist],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      const next = itemsRef.current.map((c) =>
        c.id === id
          ? { ...c, ...patch, updated_at: new Date().toISOString() }
          : c,
      )
      setItems(next)
      persist(next)
    },
    [persist],
  )

  const remove = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((c) => c.id !== id)
      setItems(next)
      persist(next)
    },
    [persist],
  )

  return { items, loading, error, create, update, remove }
}
