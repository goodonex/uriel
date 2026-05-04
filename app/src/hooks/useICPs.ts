import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
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

const STORAGE_KEY = 'icps' as const

export function useICPs(brandSlug: string | undefined): UseICPsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ICP[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ICP[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(sortByPriority(loadList<ICP>([brandSlug, STORAGE_KEY])))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: ICP[]) => {
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
      .from('foundation_icps')
      .select('*')
      .eq('brand_id', brandId)
      .order('priority', { ascending: true })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useICPs] → localStorage (Tabelle fehlt)', err.message)
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
    setItems(sortByPriority((data ?? []).map(rowToICP)))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial?: Partial<Omit<ICP, 'id' | 'brand_id' | 'updated_at'>>): ICP => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const existingPriorities = itemsRef.current.map((i) => i.priority)
      const defaultPriority: 1 | 2 | 3 = !existingPriorities.includes(1)
        ? 1
        : !existingPriorities.includes(2)
          ? 2
          : 3
      const item: ICP = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        name: partial?.name ?? 'Neuer ICP',
        age_range: partial?.age_range ?? '',
        location: partial?.location ?? '',
        pain_points: partial?.pain_points ?? [],
        word_clusters: partial?.word_clusters ?? [],
        priority: partial?.priority ?? defaultPriority,
        notes: partial?.notes ?? '',
        updated_at: now,
      }

      if (localOnlyRef.current || !supabase || !brandId) {
        const next = sortByPriority([...itemsRef.current, item])
        setItems(next)
        persistLocal(next)
        return item
      }

      const row = {
        id: item.id,
        brand_id: brandId,
        name: item.name,
        age_range: item.age_range,
        location: item.location,
        pain_points: item.pain_points,
        word_clusters: item.word_clusters,
        priority: item.priority,
        notes: item.notes,
        updated_at: now,
      }
      setItems(sortByPriority([...itemsRef.current, item]))
      void supabase.from('foundation_icps').insert(row).then(({ error: err }) => {
        if (err) {
          if (isMissingSupabaseTableError(err.message)) {
            localOnlyRef.current = true
            const next = sortByPriority([...itemsRef.current, item])
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
    (id: string, patch: Partial<Omit<ICP, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const next = sortByPriority(
        itemsRef.current.map((i) =>
          i.id === id ? { ...i, ...patch, updated_at: now } : i,
        ),
      )
      setItems(next)

      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }

      void supabase
        .from('foundation_icps')
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
        .from('foundation_icps')
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
