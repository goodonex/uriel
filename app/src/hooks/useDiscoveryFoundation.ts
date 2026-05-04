import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { DiscoveryFoundationDoc } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseDiscoveryFoundationResult {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  save: (
    patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>,
  ) => void
}

function emptyDoc(brandId: string): DiscoveryFoundationDoc {
  return {
    id: generateId(),
    brand_id: brandId,
    market: '',
    competitors: '',
    niche: '',
    analysis: null,
    analysis_run_at: null,
    updated_at: new Date().toISOString(),
  }
}

function rowToDoc(row: Record<string, unknown>): DiscoveryFoundationDoc {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    market: row.market as string,
    competitors: row.competitors as string,
    niche: row.niche as string,
    analysis: (row.analysis as DiscoveryFoundationDoc['analysis']) ?? null,
    analysis_run_at: (row.analysis_run_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  }
}

export function useDiscoveryFoundation(
  brandSlug: string | undefined,
): UseDiscoveryFoundationResult {
  const brandId = useBrandId(brandSlug)
  const [item, setItem] = useState<DiscoveryFoundationDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<DiscoveryFoundationDoc | null>(null)
  itemRef.current = item

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItem(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('discovery_foundation')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle()
    if (err) {
      setError(err.message)
      setItem(null)
    } else {
      setError(null)
      setItem(data ? rowToDoc(data as Record<string, unknown>) : null)
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    (patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const base = itemRef.current ?? emptyDoc(brandId)
      const next: DiscoveryFoundationDoc = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
      void supabase
        .from('discovery_foundation')
        .upsert(
          {
            id: next.id,
            brand_id: brandId,
            market: next.market,
            competitors: next.competitors,
            niche: next.niche,
            analysis: next.analysis,
            analysis_run_at: next.analysis_run_at,
            updated_at: next.updated_at,
          },
          { onConflict: 'brand_id' },
        )
        .then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void reload()
          }
        })
    },
    [brandId, reload],
  )

  return { item, loading, error, save }
}
