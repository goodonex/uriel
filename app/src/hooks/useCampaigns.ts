import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type { Campaign } from '../types/db'

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

export function useCampaigns(brandSlug: string | undefined): UseCampaignsResult {
  const [items, setItems] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Campaign[]>([])
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
        setItems(loadList<Campaign>([brandSlug, 'campaigns']))
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
    (next: Campaign[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'campaigns'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (
      partial?: Partial<Omit<Campaign, 'id' | 'brand_id' | 'updated_at'>>,
    ): Campaign => {
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const item: Campaign = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
        name: partial?.name ?? 'Neue Kampagne',
        goal: partial?.goal ?? '',
        start_at: partial?.start_at ?? today,
        end_at: partial?.end_at ?? null,
        content_piece_ids: partial?.content_piece_ids ?? [],
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
    (id: string, patch: Partial<Omit<Campaign, 'id' | 'brand_id'>>) => {
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
