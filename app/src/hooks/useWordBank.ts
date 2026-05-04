import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { WordBankEntry } from '../types/db'
import { useBrandId } from './useBrandId'

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

function rowToWord(row: Record<string, unknown>): WordBankEntry {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    word: row.word as string,
    type: row.type as WordBankEntry['type'],
    cluster: row.cluster as string,
    updated_at: row.updated_at as string,
  }
}

export function useWordBank(brandSlug: string | undefined): UseWordBankResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<WordBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<WordBankEntry[]>([])
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
      .from('foundation_word_bank')
      .select('*')
      .eq('brand_id', brandId)
      .order('cluster', { ascending: true })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToWord))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial: Pick<WordBankEntry, 'word' | 'type' | 'cluster'>): WordBankEntry => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const row = {
        id: generateId(),
        brand_id: brandId,
        word: partial.word.trim(),
        type: partial.type,
        cluster: partial.cluster.trim() || 'Allgemein',
        updated_at: new Date().toISOString(),
      }
      const item = rowToWord(row)
      setItems([...itemsRef.current, item])
      void supabase.from('foundation_word_bank').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<WordBankEntry, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((i) =>
        i.id === id ? { ...i, ...patch, updated_at: now } : i,
      )
      setItems(next)
      void supabase
        .from('foundation_word_bank')
        .update({ ...patch, updated_at: now })
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
      const next = itemsRef.current.filter((i) => i.id !== id)
      setItems(next)
      void supabase
        .from('foundation_word_bank')
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
