import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type { Asset, AssetType } from '../types/db'

interface UseAssetsResult {
  items: Asset[]
  loading: boolean
  error: string | null
  create: (partial?: Partial<Omit<Asset, 'id' | 'brand_id' | 'updated_at'>>) => Asset
  update: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  remove: (id: string) => void
}

export function useAssets(brandSlug: string | undefined): UseAssetsResult {
  const [items, setItems] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Asset[]>([])
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
        setItems(loadList<Asset>([brandSlug, 'assets']))
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
    (next: Asset[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'assets'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (partial?: Partial<Omit<Asset, 'id' | 'brand_id' | 'updated_at'>>): Asset => {
      const now = new Date().toISOString()
      const item: Asset = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
        name: partial?.name ?? 'Neues Asset',
        type: (partial?.type as AssetType) ?? 'website',
        url: partial?.url ?? '',
        embed: partial?.embed ?? false,
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
    (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => {
      const next = itemsRef.current.map((a) =>
        a.id === id
          ? { ...a, ...patch, updated_at: new Date().toISOString() }
          : a,
      )
      setItems(next)
      persist(next)
    },
    [persist],
  )

  const remove = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((a) => a.id !== id)
      setItems(next)
      persist(next)
    },
    [persist],
  )

  return { items, loading, error, create, update, remove }
}
