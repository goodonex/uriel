import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Campaign } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseCampaignsResult {
  items: Campaign[]
  loading: boolean
  error: string | null
  create: (
    partial?: Partial<Omit<Campaign, 'id' | 'brand_id' | 'updated_at'>>,
  ) => Campaign
  update: (
    id: string,
    patch: Partial<Omit<Campaign, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => void
}

function rowToCampaign(row: Record<string, unknown>): Campaign {
  const start = row.start_at as string
  const end = row.end_at as string | null
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    goal: row.goal as string,
    start_at: typeof start === 'string' ? start.slice(0, 10) : start,
    end_at: end ? end.slice(0, 10) : null,
    content_piece_ids: (row.content_piece_ids as string[]) ?? [],
    updated_at: row.updated_at as string,
  }
}

const STORAGE_KEY = 'campaigns' as const

export function useCampaigns(brandSlug: string | undefined): UseCampaignsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Campaign[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<Campaign>([brandSlug, STORAGE_KEY]))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: Campaign[]) => {
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
      .from('campaigns')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useCampaigns] → localStorage', err.message)
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
    setItems((data ?? []).map(rowToCampaign))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<Campaign, 'id' | 'brand_id' | 'updated_at'>>,
    ): Campaign => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const item: Campaign = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        name: partial?.name ?? 'Neue Kampagne',
        goal: partial?.goal ?? '',
        start_at: partial?.start_at ?? today,
        end_at: partial?.end_at ?? null,
        content_piece_ids: partial?.content_piece_ids ?? [],
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
        goal: item.goal,
        start_at: item.start_at,
        end_at: item.end_at,
        content_piece_ids: item.content_piece_ids,
        updated_at: now,
      }
      setItems([...itemsRef.current, item])
      void supabase.from('campaigns').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<Campaign, 'id' | 'brand_id'>>) => {
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
      const dbPatch: Record<string, unknown> = { ...patch, updated_at: now }
      void supabase
        .from('campaigns')
        .update(dbPatch)
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
        .from('campaigns')
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
