import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadOne, saveOne } from '../lib/storage'
import type { BusinessModelDoc } from '../types/db'

interface UseBusinessModelResult {
  item: BusinessModelDoc | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => void
}

function emptyDoc(brandSlug: string): BusinessModelDoc {
  return {
    id: generateId(),
    brand_id: brandSlug,
    who: '',
    what: '',
    how: '',
    for_whom: '',
    revenue: '',
    updated_at: new Date().toISOString(),
  }
}

export function useBusinessModel(
  brandSlug: string | undefined,
): UseBusinessModelResult {
  const [item, setItem] = useState<BusinessModelDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<BusinessModelDoc | null>(null)
  itemRef.current = item

  useEffect(() => {
    if (!brandSlug) {
      setItem(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      try {
        setItem(loadOne<BusinessModelDoc>([brandSlug, 'businessmodel']))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      } finally {
        setLoading(false)
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [brandSlug])

  const save = useCallback(
    (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const base = itemRef.current ?? emptyDoc(brandSlug)
      const next: BusinessModelDoc = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
      saveOne([brandSlug, 'businessmodel'], next)
    },
    [brandSlug],
  )

  return { item, loading, error, save }
}
