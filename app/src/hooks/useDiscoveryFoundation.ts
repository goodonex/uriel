import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadOne, saveOne } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
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

const STORAGE_PART = 'discovery-foundation' as const

function emptyDoc(brandKey: string): DiscoveryFoundationDoc {
  return {
    id: generateId(),
    brand_id: brandKey,
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
  const localOnlyRef = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItem(null)
      setLoading(false)
      setError(null)
      return
    }
    if (!supabase || !brandId) {
      localOnlyRef.current = true
      setItem(loadOne<DiscoveryFoundationDoc>([brandSlug, STORAGE_PART]))
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('discovery_foundation')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useDiscoveryFoundation] → localStorage', err.message)
      localOnlyRef.current = true
      setItem(loadOne<DiscoveryFoundationDoc>([brandSlug, STORAGE_PART]))
      setError(null)
      setLoading(false)
      return
    }

    if (err) {
      setError(err.message)
      setItem(null)
    } else {
      localOnlyRef.current = false
      setError(null)
      setItem(data ? rowToDoc(data as Record<string, unknown>) : null)
    }
    setLoading(false)
  }, [brandId, brandSlug])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    (patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const key = localOnlyRef.current ? brandSlug : (brandId ?? brandSlug)
      const base = itemRef.current ?? emptyDoc(key)
      const next: DiscoveryFoundationDoc = {
        ...base,
        ...patch,
        brand_id: localOnlyRef.current ? brandSlug : base.brand_id,
        updated_at: new Date().toISOString(),
      }
      setItem(next)

      if (localOnlyRef.current || !supabase || !brandId) {
        saveOne([brandSlug, STORAGE_PART], next)
        return
      }

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
            if (isMissingSupabaseTableError(err.message)) {
              localOnlyRef.current = true
              saveOne([brandSlug, STORAGE_PART], next)
            } else {
              setError(err.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, reload],
  )

  return { item, loading, error, save }
}
