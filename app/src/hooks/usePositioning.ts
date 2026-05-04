import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HERRMANN_POSITIONING_STATEMENT,
  HERRMANN_TONE_OF_VOICE,
  isLegacyHerrmannPositioning,
} from '../data/defaultCopy'
import { generateId } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Positioning } from '../types/db'
import { useBrandId } from './useBrandId'

interface UsePositioningResult {
  item: Positioning | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<Positioning, 'id' | 'brand_id'>>) => void
}

function emptyPositioning(brandId: string): Positioning {
  return {
    id: generateId(),
    brand_id: brandId,
    statement: '',
    tone_of_voice: '',
    business_model: null,
    updated_at: new Date().toISOString(),
  }
}

function herrmannSeedPositioning(brandId: string): Positioning {
  return {
    id: generateId(),
    brand_id: brandId,
    statement: HERRMANN_POSITIONING_STATEMENT,
    tone_of_voice: HERRMANN_TONE_OF_VOICE,
    business_model: null,
    updated_at: new Date().toISOString(),
  }
}

function rowToPositioning(row: Record<string, unknown>): Positioning {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    statement: row.statement as string,
    tone_of_voice: row.tone_of_voice as string,
    business_model: (row.business_model as Positioning['business_model']) ?? null,
    updated_at: row.updated_at as string,
  }
}

export function usePositioning(
  brandSlug: string | undefined,
): UsePositioningResult {
  const brandId = useBrandId(brandSlug)
  const [item, setItem] = useState<Positioning | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<Positioning | null>(null)
  itemRef.current = item

  const reload = useCallback(async () => {
    if (!supabase || !brandId || !brandSlug) {
      setItem(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('foundation_positioning')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle()
    if (err) {
      setError(err.message)
      setItem(null)
      setLoading(false)
      return
    }

    let next: Positioning | null = data
      ? rowToPositioning(data as Record<string, unknown>)
      : null

    if (!next && brandSlug === 'herrmann') {
      next = herrmannSeedPositioning(brandId)
      const { error: insErr } = await supabase.from('foundation_positioning').insert({
        id: next.id,
        brand_id: brandId,
        statement: next.statement,
        tone_of_voice: next.tone_of_voice,
        business_model: next.business_model,
        updated_at: next.updated_at,
      })
      if (insErr) {
        setError(insErr.message)
        next = null
      }
    } else if (
      next &&
      brandSlug === 'herrmann' &&
      isLegacyHerrmannPositioning(next.statement)
    ) {
      next = {
        ...next,
        statement: HERRMANN_POSITIONING_STATEMENT,
        tone_of_voice: HERRMANN_TONE_OF_VOICE,
        updated_at: new Date().toISOString(),
      }
      await supabase
        .from('foundation_positioning')
        .update({
          statement: next.statement,
          tone_of_voice: next.tone_of_voice,
          updated_at: next.updated_at,
        })
        .eq('brand_id', brandId)
    }

    setError(null)
    setItem(next)
    setLoading(false)
  }, [brandId, brandSlug])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    (patch: Partial<Omit<Positioning, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId || !brandSlug) return
      const base = itemRef.current ?? emptyPositioning(brandId)
      const next: Positioning = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
      void supabase
        .from('foundation_positioning')
        .upsert(
          {
            id: next.id,
            brand_id: brandId,
            statement: next.statement,
            tone_of_voice: next.tone_of_voice,
            business_model: next.business_model,
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
    [brandId, brandSlug, reload],
  )

  return { item, loading, error, save }
}
