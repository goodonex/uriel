import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { SOP } from '../types/db'
import { useBrandId } from './useBrandId'

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

function rowToSOP(row: Record<string, unknown>): SOP {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    title: row.title as string,
    content: (row.content as Record<string, unknown>) ?? EMPTY_DOC,
    category: row.category as string,
    updated_at: row.updated_at as string,
  }
}

const STORAGE_KEY = 'sops' as const

export function useSOPs(brandSlug: string | undefined): UseSOPsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SOP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<SOP[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<SOP>([brandSlug, STORAGE_KEY]))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: SOP[]) => {
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
      .from('sops')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useSOPs] → localStorage', err.message)
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
    setItems((data ?? []).map(rowToSOP))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial?: Partial<Omit<SOP, 'id' | 'brand_id' | 'updated_at'>>): SOP => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const item: SOP = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        title: partial?.title ?? 'Neue SOP',
        content: partial?.content ?? EMPTY_DOC,
        category: partial?.category ?? 'template',
        updated_at: now,
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
        title: item.title,
        content: item.content,
        category: item.category,
        updated_at: now,
      }
      setItems([...itemsRef.current, item])
      void supabase.from('sops').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<SOP, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((s) =>
        s.id === id ? { ...s, ...patch, updated_at: now } : s,
      )
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('sops')
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
      const next = itemsRef.current.filter((s) => s.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('sops')
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
