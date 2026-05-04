import { useCallback, useEffect, useRef, useState } from 'react'
import { loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { DiscoveryFeedItem } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseDiscoveryFeedResult {
  items: DiscoveryFeedItem[]
  loading: boolean
  error: string | null
  prepend: (batch: DiscoveryFeedItem[]) => void
}

function rowToItem(row: Record<string, unknown>): DiscoveryFeedItem {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    category: row.category as DiscoveryFeedItem['category'],
    title: row.title as string,
    summary: row.summary as string,
    signal_strength: row.signal_strength as DiscoveryFeedItem['signal_strength'],
    recorded_at: row.recorded_at as string,
  }
}

const STORAGE_KEY = 'discovery-feed' as const

export function useDiscoveryFeed(
  brandSlug: string | undefined,
): UseDiscoveryFeedResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<DiscoveryFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<DiscoveryFeedItem[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<DiscoveryFeedItem>([brandSlug, STORAGE_KEY]))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: DiscoveryFeedItem[]) => {
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
      .from('discovery_feed_items')
      .select('*')
      .eq('brand_id', brandId)
      .order('recorded_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useDiscoveryFeed] → localStorage', err.message)
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
    setItems((data ?? []).map(rowToItem))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const prepend = useCallback(
    (batch: DiscoveryFeedItem[]) => {
      if (!brandSlug || batch.length === 0) return
      const merged = batch.map((b) => ({
        ...b,
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
      }))
      const next = [...merged, ...itemsRef.current]
      setItems(next)

      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }

      const rows = merged.map((b) => ({
        id: b.id,
        brand_id: brandId,
        category: b.category,
        title: b.title,
        summary: b.summary,
        signal_strength: b.signal_strength,
        recorded_at: b.recorded_at,
      }))

      void supabase.from('discovery_feed_items').insert(rows).then(({ error: err }) => {
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

  return { items, loading, error, prepend }
}
