import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { BusinessModelDoc } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseBusinessModelResult {
  item: BusinessModelDoc | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => void
}

function emptyDoc(brandId: string): BusinessModelDoc {
  return {
    id: generateId(),
    brand_id: brandId,
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

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItem(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('foundation_business_models')
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
    (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const base = itemRef.current ?? emptyDoc(brandId)
      const next: BusinessModelDoc = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
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
            setError(err.message)
            void reload()
          }
        })
    },
    [brandId, reload],
  )

  return { item, loading, error, save }
}
