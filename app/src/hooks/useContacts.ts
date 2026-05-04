import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Contact, ContactActivityEntry, PipelineStage } from '../types/db'
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

function parseActivityLog(raw: unknown): ContactActivityEntry[] {
  if (!Array.isArray(raw)) return []
  const out: ContactActivityEntry[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const text = typeof o.text === 'string' ? o.text : ''
    const at = typeof o.at === 'string' ? o.at : new Date().toISOString()
    if (id && text) out.push({ id, text, at })
  }
  return out
}

function normalizeContact(
  c: Partial<Contact> & Pick<Contact, 'id' | 'brand_id'>,
): Contact {
  const now = new Date().toISOString()
  return {
    id: c.id,
    brand_id: c.brand_id,
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    instagram: c.instagram ?? '',
    linkedin: c.linkedin ?? '',
    company: c.company ?? '',
    source_content_piece_id: c.source_content_piece_id ?? null,
    source_campaign_id: c.source_campaign_id ?? null,
    pipeline_stage: (c.pipeline_stage ?? 'first_contact') as PipelineStage,
    last_contact_at: c.last_contact_at ?? null,
    next_follow_up_at: c.next_follow_up_at ?? null,
    notes: c.notes ?? '',
    activity_log: Array.isArray(c.activity_log)
      ? parseActivityLog(c.activity_log)
      : [],
    updated_at: c.updated_at ?? now,
  }
}

function rowToContact(row: Record<string, unknown>): Contact {
  return normalizeContact({
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string | undefined) ?? '',
    website: (row.website as string | undefined) ?? '',
    instagram: (row.instagram as string | undefined) ?? '',
    linkedin: (row.linkedin as string | undefined) ?? '',
    company: (row.company as string | undefined) ?? '',
    source_content_piece_id: (row.source_content_piece_id as string | null) ?? null,
    source_campaign_id: (row.source_campaign_id as string | null) ?? null,
    pipeline_stage: row.pipeline_stage as PipelineStage,
    last_contact_at: (row.last_contact_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    notes: row.notes as string,
    activity_log: parseActivityLog(row.activity_log),
    updated_at: row.updated_at as string,
  })
}

function contactToRow(
  c: Contact,
  brandId: string,
): Record<string, unknown> {
  return {
    id: c.id,
    brand_id: brandId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    website: c.website,
    instagram: c.instagram,
    linkedin: c.linkedin,
    company: c.company,
    source_content_piece_id: c.source_content_piece_id,
    source_campaign_id: c.source_campaign_id,
    pipeline_stage: c.pipeline_stage,
    last_contact_at: c.last_contact_at,
    next_follow_up_at: c.next_follow_up_at,
    notes: c.notes,
    activity_log: c.activity_log,
    updated_at: c.updated_at,
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
    const raw = loadList<Partial<Contact> & { id: string; brand_id: string }>([
      brandSlug,
      STORAGE_KEY,
    ])
    setItems(raw.map((r) => normalizeContact(r as Contact)))
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
      const item = normalizeContact({
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        ...partial,
        updated_at: now,
      })
      if (localOnlyRef.current || !supabase || !brandId) {
        const next = [...itemsRef.current, item]
        setItems(next)
        persistLocal(next)
        return item
      }
      const row = contactToRow(item, brandId)
      setItems([...itemsRef.current, item])
      void supabase.from('contacts').insert(row).then(({ error: insErr }) => {
        if (insErr) {
          if (isMissingSupabaseTableError(insErr.message)) {
            localOnlyRef.current = true
            const next = [...itemsRef.current, item]
            persistLocal(next)
            setItems(next)
          } else {
            setError(insErr.message)
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
      const prev = itemsRef.current.find((c) => c.id === id)
      if (!prev) return
      const merged = normalizeContact({ ...prev, ...patch, updated_at: now })
      const next = itemsRef.current.map((c) => (c.id === id ? merged : c))
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
        .then(({ error: updErr }) => {
          if (updErr) {
            if (isMissingSupabaseTableError(updErr.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(updErr.message)
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
        .then(({ error: delErr }) => {
          if (delErr) {
            if (isMissingSupabaseTableError(delErr.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(delErr.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { items, loading, error, create, update, remove }
}
