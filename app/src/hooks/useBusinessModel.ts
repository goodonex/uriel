import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadOne, saveOne } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { BusinessModelDoc } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseBusinessModelResult {
  item: BusinessModelDoc | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => void
}

const STORAGE_PART = 'businessmodel' as const

function emptyDoc(brandKey: string): BusinessModelDoc {
  return {
    id: generateId(),
    brand_id: brandKey,
    who: '',
    what: '',
    how: '',
    for_whom: '',
    revenue: '',
    updated_at: new Date().toISOString(),
  }
}

function rowToDoc(row: Record<string, unknown>): BusinessModelDoc {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    who: row.who as string,
    what: row.what as string,
    how: row.how as string,
    for_whom: row.for_whom as string,
    revenue: row.revenue as string,
    updated_at: row.updated_at as string,
  }
}

export function useBusinessModel(
  brandSlug: string | undefined,
): UseBusinessModelResult {
  const brandId = useBrandId(brandSlug)
  const [item, setItem] = useState<BusinessModelDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<BusinessModelDoc | null>(null)
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
      setItem(loadOne<BusinessModelDoc>([brandSlug, STORAGE_PART]))
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('foundation_business_models')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useBusinessModel] → localStorage', err.message)
      localOnlyRef.current = true
      setItem(loadOne<BusinessModelDoc>([brandSlug, STORAGE_PART]))
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
    (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const key = localOnlyRef.current ? brandSlug : (brandId ?? brandSlug)
      const base = itemRef.current ?? emptyDoc(key)
      const next: BusinessModelDoc = {
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
        .from('foundation_business_models')
        .upsert(
          {
            id: next.id,
            brand_id: brandId,
            who: next.who,
            what: next.what,
            how: next.how,
            for_whom: next.for_whom,
            revenue: next.revenue,
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
