import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { ICP } from '../types/db'
import { useBrandId } from './useBrandId'

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

function rowToICP(row: Record<string, unknown>): ICP {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    age_range: row.age_range as string,
    location: row.location as string,
    pain_points: (row.pain_points as string[]) ?? [],
    word_clusters: (row.word_clusters as string[]) ?? [],
    priority: row.priority as ICP['priority'],
    notes: row.notes as string,
    updated_at: row.updated_at as string,
  }
}

export function useICPs(brandSlug: string | undefined): UseICPsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ICP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ICP[]>([])
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
      .from('foundation_icps')
      .select('*')
      .eq('brand_id', brandId)
      .order('priority', { ascending: true })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems(sortByPriority((data ?? []).map(rowToICP)))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial?: Partial<Omit<ICP, 'id' | 'brand_id' | 'updated_at'>>): ICP => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const now = new Date().toISOString()
      const existingPriorities = itemsRef.current.map((i) => i.priority)
      const defaultPriority: 1 | 2 | 3 = !existingPriorities.includes(1)
        ? 1
        : !existingPriorities.includes(2)
          ? 2
          : 3
      const row = {
        id: generateId(),
        brand_id: brandId,
        name: partial?.name ?? 'Neuer ICP',
        age_range: partial?.age_range ?? '',
        location: partial?.location ?? '',
        pain_points: partial?.pain_points ?? [],
        word_clusters: partial?.word_clusters ?? [],
        priority: partial?.priority ?? defaultPriority,
        notes: partial?.notes ?? '',
        updated_at: now,
      }
      const item = rowToICP(row)
      setItems(sortByPriority([...itemsRef.current, item]))
      void supabase.from('foundation_icps').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<ICP, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = sortByPriority(
        itemsRef.current.map((i) =>
          i.id === id ? { ...i, ...patch, updated_at: now } : i,
        ),
      )
      setItems(next)
      void supabase
        .from('foundation_icps')
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
        .from('foundation_icps')
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
