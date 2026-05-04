import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadOne, saveOne } from '../lib/storage'
import type { Positioning } from '../types/db'

interface UsePositioningResult {
  item: Positioning | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<Positioning, 'id' | 'brand_id'>>) => void
}

function emptyPositioning(brandSlug: string): Positioning {
  return {
    id: generateId(),
    brand_id: brandSlug,
    statement: '',
    tone_of_voice: '',
    business_model: null,
    updated_at: new Date().toISOString(),
  }
}

export function usePositioning(
  brandSlug: string | undefined,
): UsePositioningResult {
  const [item, setItem] = useState<Positioning | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<Positioning | null>(null)
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
        setItem(loadOne<Positioning>([brandSlug, 'positioning']))
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
    (patch: Partial<Omit<Positioning, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const base = itemRef.current ?? emptyPositioning(brandSlug)
      const next: Positioning = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
      saveOne([brandSlug, 'positioning'], next)
    },
    [brandSlug],
  )

  return { item, loading, error, save }
}
