import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
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

const STORAGE_KEY = 'word-bank' as const

export function useWordBank(brandSlug: string | undefined): UseWordBankResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<WordBankEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<WordBankEntry[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<WordBankEntry>([brandSlug, STORAGE_KEY]))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: WordBankEntry[]) => {
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
      .from('foundation_word_bank')
      .select('*')
      .eq('brand_id', brandId)
      .order('cluster', { ascending: true })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useWordBank] → localStorage', err.message)
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
    setItems((data ?? []).map(rowToWord))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial: Pick<WordBankEntry, 'word' | 'type' | 'cluster'>): WordBankEntry => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const item: WordBankEntry = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        word: partial.word.trim(),
        type: partial.type,
        cluster: partial.cluster.trim() || 'Allgemein',
        updated_at: new Date().toISOString(),
      }
      if (localOnlyRef.current || !supabase || !brandId) {
        const next = [...itemsRef.current, item]
        setItems(next)
        persistLocal(next)
        return item
      }
      const row = {
        id: item.id,
        brand_id: brandId,
        word: item.word,
        type: item.type,
        cluster: item.cluster,
        updated_at: item.updated_at,
      }
      setItems([...itemsRef.current, item])
      void supabase.from('foundation_word_bank').insert(row).then(({ error: err }) => {
        if (err) {
          if (isMissingSupabaseTableError(err.message)) {
            localOnlyRef.current = true
            const next = [...itemsRef.current, item]
            persistLocal(next)
            setItems(next)
          } else {
            setError(err.message)
            void reload()
          }
        }
      })
      return item
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<WordBankEntry, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((i) =>
        i.id === id ? { ...i, ...patch, updated_at: now } : i,
      )
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('foundation_word_bank')
        .update({ ...patch, updated_at: now })
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
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

  const remove = useCallback(
    (id: string) => {
      if (!brandSlug) return
      const next = itemsRef.current.filter((i) => i.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('foundation_word_bank')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
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

  return { items, loading, error, create, update, remove }
}
