import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HERRMANN_POSITIONING_STATEMENT,
  HERRMANN_TONE_OF_VOICE,
  isLegacyHerrmannPositioning,
} from '../data/defaultCopy'
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

function herrmannSeedPositioning(): Positioning {
  return {
    id: generateId(),
    brand_id: 'herrmann',
    statement: HERRMANN_POSITIONING_STATEMENT,
    tone_of_voice: HERRMANN_TONE_OF_VOICE,
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
        let next = loadOne<Positioning>([brandSlug, 'positioning'])

        if (brandSlug === 'herrmann') {
          if (!next) {
            next = herrmannSeedPositioning()
            saveOne([brandSlug, 'positioning'], next)
          } else if (isLegacyHerrmannPositioning(next.statement)) {
            next = {
              ...next,
              statement: HERRMANN_POSITIONING_STATEMENT,
              tone_of_voice: HERRMANN_TONE_OF_VOICE,
              updated_at: new Date().toISOString(),
            }
            saveOne([brandSlug, 'positioning'], next)
          }
        }

        setItem(next)
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
