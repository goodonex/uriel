import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
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

export function useCampaigns(brandSlug: string | undefined): UseCampaignsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Campaign[]>([])
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
      .from('campaigns')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToCampaign))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<Campaign, 'id' | 'brand_id' | 'updated_at'>>,
    ): Campaign => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const row = {
        id: generateId(),
        brand_id: brandId,
        name: partial?.name ?? 'Neue Kampagne',
        goal: partial?.goal ?? '',
        start_at: partial?.start_at ?? today,
        end_at: partial?.end_at ?? null,
        content_piece_ids: partial?.content_piece_ids ?? [],
        updated_at: now,
      }
      const item = rowToCampaign(row)
      setItems([...itemsRef.current, item])
      void supabase.from('campaigns').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<Campaign, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((c) =>
        c.id === id ? { ...c, ...patch, updated_at: now } : c,
      )
      setItems(next)
      const dbPatch: Record<string, unknown> = { ...patch, updated_at: now }
      void supabase
        .from('campaigns')
        .update(dbPatch)
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
        .from('campaigns')
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
