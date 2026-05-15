import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

export interface PromoPerformanceRow {
  id: string
  brand_id: string
  piece_id: string | null
  label: string | null
  impressions: number
  clicks: number
  leads: number
  spend: number
  date: string
  created_at: string
}

interface UsePromoPerformanceResult {
  items: PromoPerformanceRow[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  upsert: (row: Partial<PromoPerformanceRow> & { id?: string }) => PromoPerformanceRow
  remove: (id: string) => void
}

const STORAGE_KEY = 'promo-performance' as const

function rowToItem(row: Record<string, unknown>): PromoPerformanceRow {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    piece_id: (row.piece_id as string | null) ?? null,
    label: (row.label as string | null) ?? null,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    leads: Number(row.leads) || 0,
    spend: Number(row.spend) || 0,
    date: String(row.date).slice(0, 10),
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  }
}

function itemToRow(p: PromoPerformanceRow): Record<string, unknown> {
  return {
    id: p.id,
    brand_id: p.brand_id,
    piece_id: p.piece_id,
    label: p.label,
    impressions: p.impressions,
    clicks: p.clicks,
    leads: p.leads,
    spend: p.spend,
    date: p.date,
    created_at: p.created_at,
  }
}

export function usePromoPerformance(brandSlug: string | undefined): UsePromoPerformanceResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<PromoPerformanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const persistLocal = useCallback(
    (next: PromoPerformanceRow[]) => {
      if (!brandSlug) return
      saveList([brandSlug, STORAGE_KEY], next)
    },
    [brandSlug],
  )

  const reload = useCallback(async () => {
    if (!brandSlug || !brandId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (localOnlyRef.current || !supabase || !brandId) {
      localOnlyRef.current = true
      setItems(loadList<PromoPerformanceRow>([brandSlug, STORAGE_KEY]))
      setLoading(false)
      return
    }

    try {
      const { data, error: qErr } = await supabase
        .from('promo_performance')
        .select('*')
        .eq('brand_id', brandId)
        .order('date', { ascending: false })

      if (qErr) {
        if (isMissingSupabaseTableError(qErr.message)) {
          localOnlyRef.current = true
          setItems(loadList<PromoPerformanceRow>([brandSlug, STORAGE_KEY]))
        } else {
          throw qErr
        }
      } else {
        const next = (data ?? []).map((r) => rowToItem(r as Record<string, unknown>))
        setItems(next)
        persistLocal(next)
      }
    } catch (err) {
      localOnlyRef.current = true
      console.warn('[usePromoPerformance] → localStorage', err)
      setItems(loadList<PromoPerformanceRow>([brandSlug, STORAGE_KEY]))
    } finally {
      setLoading(false)
    }
  }, [brandId, brandSlug, persistLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const upsert = useCallback(
    (partial: Partial<PromoPerformanceRow> & { id?: string }) => {
      const now = new Date().toISOString()
      const existing = partial.id
        ? itemsRef.current.find((x) => x.id === partial.id)
        : undefined
      const row: PromoPerformanceRow = {
        id: partial.id ?? generateId(),
        brand_id: brandId ?? existing?.brand_id ?? '',
        piece_id: partial.piece_id ?? existing?.piece_id ?? null,
        label: partial.label ?? existing?.label ?? null,
        impressions: partial.impressions ?? existing?.impressions ?? 0,
        clicks: partial.clicks ?? existing?.clicks ?? 0,
        leads: partial.leads ?? existing?.leads ?? 0,
        spend: partial.spend ?? existing?.spend ?? 0,
        date: partial.date ?? existing?.date ?? now.slice(0, 10),
        created_at: existing?.created_at ?? now,
      }

      const next = existing
        ? itemsRef.current.map((x) => (x.id === row.id ? row : x))
        : [row, ...itemsRef.current]
      setItems(next)
      persistLocal(next)

      if (!localOnlyRef.current && brandId && supabase) {
        void supabase.from('promo_performance').upsert(itemToRow(row))
      }
      return row
    },
    [brandId, persistLocal],
  )

  const remove = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((x) => x.id !== id)
      setItems(next)
      persistLocal(next)
      if (!localOnlyRef.current && supabase) {
        void supabase.from('promo_performance').delete().eq('id', id)
      }
    },
    [persistLocal],
  )

  return { items, loading, error, reload, upsert, remove }
}
