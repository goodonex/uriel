import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Asset, AssetType } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseAssetsResult {
  items: Asset[]
  loading: boolean
  error: string | null
  create: (
    partial?: Partial<Omit<Asset, 'id' | 'brand_id' | 'updated_at' | 'created_at'>>,
  ) => Asset
  update: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  remove: (id: string) => void
}

function rowToAsset(row: Record<string, unknown>): Asset {
  const updatedAt = row.updated_at as string
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    type: row.type as AssetType,
    url: row.url as string,
    embed: row.embed as boolean,
    notes: (row.notes as string) ?? '',
    social_platform: (row.social_platform as Asset['social_platform']) ?? null,
    created_at: (row.created_at as string) ?? updatedAt,
    updated_at: updatedAt,
  }
}

const STORAGE_KEY = 'assets' as const

export function useAssets(brandSlug: string | undefined): UseAssetsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Asset[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    const raw = loadList<Asset>([brandSlug, STORAGE_KEY])
    setItems(raw.map((a) => ({
      ...a,
      notes: a.notes ?? '',
      created_at: a.created_at ?? a.updated_at ?? new Date().toISOString(),
      social_platform: a.social_platform ?? null,
    })))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: Asset[]) => {
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
      .from('assets')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useAssets] → localStorage', err.message)
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
    setItems((data ?? []).map(rowToAsset))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<Asset, 'id' | 'brand_id' | 'updated_at' | 'created_at'>>,
    ): Asset => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const item: Asset = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        name: partial?.name ?? 'Neues Asset',
        type: (partial?.type as AssetType) ?? 'website',
        url: partial?.url ?? '',
        embed: partial?.embed ?? false,
        notes: partial?.notes ?? '',
        social_platform: partial?.social_platform ?? null,
        created_at: now,
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
        name: item.name,
        type: item.type,
        url: item.url,
        embed: item.embed,
        notes: item.notes,
        social_platform: item.social_platform,
        created_at: now,
        updated_at: now,
      }
      setItems([...itemsRef.current, item])
      void supabase.from('assets').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((a) =>
        a.id === id ? { ...a, ...patch, updated_at: now } : a,
      )
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('assets')
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
      const next = itemsRef.current.filter((a) => a.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('assets')
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
