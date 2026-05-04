import { useCallback, useEffect, useRef, useState } from 'react'
import { loadList, saveList } from '../lib/storage'
import type { DiscoveryFeedItem } from '../types/db'

interface UseDiscoveryFeedResult {
  items: DiscoveryFeedItem[]
  loading: boolean
  error: string | null
  prepend: (batch: DiscoveryFeedItem[]) => void
}

export function useDiscoveryFeed(
  brandSlug: string | undefined,
): UseDiscoveryFeedResult {
  const [items, setItems] = useState<DiscoveryFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<DiscoveryFeedItem[]>([])
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
        setItems(loadList<DiscoveryFeedItem>([brandSlug, 'discovery-feed']))
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
    (next: DiscoveryFeedItem[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'discovery-feed'], next)
    },
    [brandSlug],
  )

  const prepend = useCallback(
    (batch: DiscoveryFeedItem[]) => {
      if (!brandSlug || batch.length === 0) return
      const next = [...batch, ...itemsRef.current]
      setItems(next)
      persist(next)
    },
    [brandSlug, persist],
  )

  return { items, loading, error, prepend }
}
