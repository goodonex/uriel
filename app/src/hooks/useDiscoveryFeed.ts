import { useCallback, useEffect, useRef, useState } from 'react'
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

export function useDiscoveryFeed(
  brandSlug: string | undefined,
): UseDiscoveryFeedResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<DiscoveryFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<DiscoveryFeedItem[]>([])
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
      .from('discovery_feed_items')
      .select('*')
      .eq('brand_id', brandId)
      .order('recorded_at', { ascending: false })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToItem))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const prepend = useCallback(
    (batch: DiscoveryFeedItem[]) => {
      if (!supabase || !brandId || batch.length === 0) return
      const rows = batch.map((b) => ({
        id: b.id,
        brand_id: brandId,
        category: b.category,
        title: b.title,
        summary: b.summary,
        signal_strength: b.signal_strength,
        recorded_at: b.recorded_at,
      }))
      const merged = batch.map((b) => ({ ...b, brand_id: brandId }))
      setItems([...merged, ...itemsRef.current])
      void supabase.from('discovery_feed_items').insert(rows).then(({ error: err }) => {
        if (err) {
          setError(err.message)
          void reload()
        }
      })
    },
    [brandId, reload],
  )

  return { items, loading, error, prepend }
}
