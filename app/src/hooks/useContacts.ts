import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Contact, PipelineStage } from '../types/db'
import { useBrandId } from './useBrandId'

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

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    email: row.email as string,
    source_content_piece_id: (row.source_content_piece_id as string | null) ?? null,
    source_campaign_id: (row.source_campaign_id as string | null) ?? null,
    pipeline_stage: row.pipeline_stage as PipelineStage,
    last_contact_at: (row.last_contact_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    notes: row.notes as string,
    updated_at: row.updated_at as string,
  }
}

const STORAGE_KEY = 'contacts' as const

export function useContacts(brandSlug: string | undefined): UseContactsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Contact[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<Contact>([brandSlug, STORAGE_KEY]))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: Contact[]) => {
      if (!brandSlug) return
      saveList([brandSlug, STORAGE_KEY], next)
    },
    [brandSlug],
  )

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    if (!supabase || !brandId) {
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('contacts')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useContacts] → localStorage', err.message)
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    if (err) {
      setError(err.message)
      setItems([])
      setLoading(false)
      return
    }
    localOnlyRef.current = false
    setError(null)
    setItems((data ?? []).map(rowToContact))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
    ): Contact => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const item: Contact = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
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
      if (localOnlyRef.current || !supabase || !brandId) {
        const next = [...itemsRef.current, item]
        setItems(next)
        persistLocal(next)
        return item
      }
      const row = {
        id: item.id,
        brand_id: brandId,
        name: item.name,
        email: item.email,
        source_content_piece_id: item.source_content_piece_id,
        source_campaign_id: item.source_campaign_id,
        pipeline_stage: item.pipeline_stage,
        last_contact_at: item.last_contact_at,
        next_follow_up_at: item.next_follow_up_at,
        notes: item.notes,
        updated_at: now,
      }
      setItems([...itemsRef.current, item])
      void supabase.from('contacts').insert(row).then(({ error: err }) => {
        if (err) {
          if (isMissingSupabaseTableError(err.message)) {
            localOnlyRef.current = true
            const next = [...itemsRef.current, item]
            persistLocal(next)
            setItems(next)
          } else {
            setError(err.message)
            void reload()
          }
        }
      })
      return item
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((c) =>
        c.id === id ? { ...c, ...patch, updated_at: now } : c,
      )
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('contacts')
        .update({ ...patch, updated_at: now })
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            if (isMissingSupabaseTableError(err.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(err.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const remove = useCallback(
    (id: string) => {
      if (!brandSlug) return
      const next = itemsRef.current.filter((c) => c.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            if (isMissingSupabaseTableError(err.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(err.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { items, loading, error, create, update, remove }
}
