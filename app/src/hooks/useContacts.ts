import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
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

export function useContacts(brandSlug: string | undefined): UseContactsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Contact[]>([])
  itemsRef.current = items

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('contacts')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToContact))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
    ): Contact => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const now = new Date().toISOString()
      const row = {
        id: generateId(),
        brand_id: brandId,
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
      const item = rowToContact(row)
      setItems([...itemsRef.current, item])
      void supabase.from('contacts').insert(row).then(({ error: err }) => {
        if (err) {
          setError(err.message)
          void reload()
        }
      })
      return item
    },
    [brandId, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((c) =>
        c.id === id ? { ...c, ...patch, updated_at: now } : c,
      )
      setItems(next)
      void supabase
        .from('contacts')
        .update({ ...patch, updated_at: now })
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void reload()
          }
        })
    },
    [brandId, reload],
  )

  const remove = useCallback(
    (id: string) => {
      if (!supabase || !brandId) return
      const next = itemsRef.current.filter((c) => c.id !== id)
      setItems(next)
      void supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void reload()
          }
        })
    },
    [brandId, reload],
  )

  return { items, loading, error, create, update, remove }
}
