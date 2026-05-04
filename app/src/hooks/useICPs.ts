import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type { ICP } from '../types/db'

interface UseICPsResult {
  items: ICP[]
  loading: boolean
  error: string | null
  create: (partial?: Partial<Omit<ICP, 'id' | 'brand_id' | 'updated_at'>>) => ICP
  update: (id: string, patch: Partial<Omit<ICP, 'id' | 'brand_id'>>) => void
  remove: (id: string) => void
}

function sortByPriority(list: ICP[]): ICP[] {
  return [...list].sort((a, b) => a.priority - b.priority)
}

export function useICPs(brandSlug: string | undefined): UseICPsResult {
  const [items, setItems] = useState<ICP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ICP[]>([])
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
        const loaded = loadList<ICP>([brandSlug, 'icps'])
        setItems(sortByPriority(loaded))
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
    (next: ICP[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'icps'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (partial?: Partial<Omit<ICP, 'id' | 'brand_id' | 'updated_at'>>): ICP => {
      const now = new Date().toISOString()
      const existingPriorities = itemsRef.current.map((i) => i.priority)
      const defaultPriority: 1 | 2 | 3 = !existingPriorities.includes(1)
        ? 1
        : !existingPriorities.includes(2)
          ? 2
          : 3
      const item: ICP = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
        name: partial?.name ?? 'Neuer ICP',
        age_range: partial?.age_range ?? '',
        location: partial?.location ?? '',
        pain_points: partial?.pain_points ?? [],
        word_clusters: partial?.word_clusters ?? [],
        priority: partial?.priority ?? defaultPriority,
        notes: partial?.notes ?? '',
        updated_at: now,
      }
      const next = sortByPriority([...itemsRef.current, item])
      setItems(next)
      persist(next)
      return item
    },
    [brandSlug, persist],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<ICP, 'id' | 'brand_id'>>) => {
      const now = new Date().toISOString()
      const next = sortByPriority(
        itemsRef.current.map((i) =>
          i.id === id ? { ...i, ...patch, updated_at: now } : i,
        ),
      )
      setItems(next)
      persist(next)
    },
    [persist],
  )

  const remove = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((i) => i.id !== id)
      setItems(next)
      persist(next)
    },
    [persist],
  )

  return { items, loading, error, create, update, remove }
}
