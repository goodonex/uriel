import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadOne, saveOne } from '../lib/storage'
import type { DiscoveryFoundationDoc } from '../types/db'

interface UseDiscoveryFoundationResult {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  save: (
    patch: Partial<
      Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>
    >,
  ) => void
}

function emptyDoc(brandSlug: string): DiscoveryFoundationDoc {
  return {
    id: generateId(),
    brand_id: brandSlug,
    market: '',
    competitors: '',
    niche: '',
    analysis: null,
    analysis_run_at: null,
    updated_at: new Date().toISOString(),
  }
}

export function useDiscoveryFoundation(
  brandSlug: string | undefined,
): UseDiscoveryFoundationResult {
  const [item, setItem] = useState<DiscoveryFoundationDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<DiscoveryFoundationDoc | null>(null)
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
        setItem(
          loadOne<DiscoveryFoundationDoc>([brandSlug, 'discovery-foundation']),
        )
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
    (
      patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>,
    ) => {
      if (!brandSlug) return
      const base = itemRef.current ?? emptyDoc(brandSlug)
      const next: DiscoveryFoundationDoc = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
      saveOne([brandSlug, 'discovery-foundation'], next)
    },
    [brandSlug],
  )

  return { item, loading, error, save }
}
