import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type { SOP } from '../types/db'

const EMPTY_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [],
}

interface UseSOPsResult {
  items: SOP[]
  loading: boolean
  error: string | null
  create: (partial?: Partial<Omit<SOP, 'id' | 'brand_id' | 'updated_at'>>) => SOP
  update: (id: string, patch: Partial<Omit<SOP, 'id' | 'brand_id'>>) => void
  remove: (id: string) => void
}

export function useSOPs(brandSlug: string | undefined): UseSOPsResult {
  const [items, setItems] = useState<SOP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<SOP[]>([])
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
        setItems(loadList<SOP>([brandSlug, 'sops']))
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
    (next: SOP[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'sops'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (partial?: Partial<Omit<SOP, 'id' | 'brand_id' | 'updated_at'>>): SOP => {
      const now = new Date().toISOString()
      const item: SOP = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
        title: partial?.title ?? 'Neue SOP',
        content: partial?.content ?? EMPTY_DOC,
        category: partial?.category ?? 'template',
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
    (id: string, patch: Partial<Omit<SOP, 'id' | 'brand_id'>>) => {
      const next = itemsRef.current.map((s) =>
        s.id === id
          ? { ...s, ...patch, updated_at: new Date().toISOString() }
          : s,
      )
      setItems(next)
      persist(next)
    },
    [persist],
  )

  const remove = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((s) => s.id !== id)
      setItems(next)
      persist(next)
    },
    [persist],
  )

  return { items, loading, error, create, update, remove }
}
