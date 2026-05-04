import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type { WordBankEntry } from '../types/db'

interface UseWordBankResult {
  items: WordBankEntry[]
  loading: boolean
  error: string | null
  create: (
    partial: Pick<WordBankEntry, 'word' | 'type' | 'cluster'>,
  ) => WordBankEntry
  update: (
    id: string,
    patch: Partial<Omit<WordBankEntry, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => void
}

export function useWordBank(brandSlug: string | undefined): UseWordBankResult {
  const [items, setItems] = useState<WordBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<WordBankEntry[]>([])
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
        setItems(loadList<WordBankEntry>([brandSlug, 'word-bank']))
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
    (next: WordBankEntry[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'word-bank'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (partial: Pick<WordBankEntry, 'word' | 'type' | 'cluster'>): WordBankEntry => {
      const item: WordBankEntry = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
        word: partial.word.trim(),
        type: partial.type,
        cluster: partial.cluster.trim() || 'Allgemein',
        updated_at: new Date().toISOString(),
      }
      const next = [...itemsRef.current, item]
      setItems(next)
      persist(next)
      return item
    },
    [brandSlug, persist],
  )

  const update = useCallback(
    (
      id: string,
      patch: Partial<Omit<WordBankEntry, 'id' | 'brand_id'>>,
    ) => {
      const next = itemsRef.current.map((i) =>
        i.id === id
          ? { ...i, ...patch, updated_at: new Date().toISOString() }
          : i,
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
