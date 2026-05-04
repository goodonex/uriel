import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Asset, AssetType } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseAssetsResult {
  items: Asset[]
  loading: boolean
  error: string | null
  create: (partial?: Partial<Omit<Asset, 'id' | 'brand_id' | 'updated_at'>>) => Asset
  update: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  remove: (id: string) => void
}

function rowToAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    type: row.type as AssetType,
    url: row.url as string,
    embed: row.embed as boolean,
    updated_at: row.updated_at as string,
  }
}

export function useAssets(brandSlug: string | undefined): UseAssetsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Asset[]>([])
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
      .from('assets')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToAsset))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (partial?: Partial<Omit<Asset, 'id' | 'brand_id' | 'updated_at'>>): Asset => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const now = new Date().toISOString()
      const row = {
        id: generateId(),
        brand_id: brandId,
        name: partial?.name ?? 'Neues Asset',
        type: (partial?.type as AssetType) ?? 'website',
        url: partial?.url ?? '',
        embed: partial?.embed ?? false,
        updated_at: now,
      }
      const item = rowToAsset(row)
      setItems([...itemsRef.current, item])
      void supabase.from('assets').insert(row).then(({ error: err }) => {
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
    (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((a) =>
        a.id === id ? { ...a, ...patch, updated_at: now } : a,
      )
      setItems(next)
      void supabase
        .from('assets')
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
      const next = itemsRef.current.filter((a) => a.id !== id)
      setItems(next)
      void supabase
        .from('assets')
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
