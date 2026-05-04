import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
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

export function useSOPs(brandSlug: string | undefined): UseSOPsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SOP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<SOP[]>([])
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
      .from('sops')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToSOP))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial?: Partial<Omit<SOP, 'id' | 'brand_id' | 'updated_at'>>): SOP => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const now = new Date().toISOString()
      const row = {
        id: generateId(),
        brand_id: brandId,
        title: partial?.title ?? 'Neue SOP',
        content: partial?.content ?? EMPTY_DOC,
        category: partial?.category ?? 'template',
        updated_at: now,
      }
      const item = rowToSOP(row)
      setItems([...itemsRef.current, item])
      void supabase.from('sops').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<SOP, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((s) =>
        s.id === id ? { ...s, ...patch, updated_at: now } : s,
      )
      setItems(next)
      void supabase
        .from('sops')
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
      const next = itemsRef.current.filter((s) => s.id !== id)
      setItems(next)
      void supabase
        .from('sops')
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
