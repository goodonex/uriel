import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOne, saveOne } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { DiscoverySettingsDoc } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseDiscoverySettingsResult {
  item: DiscoverySettingsDoc | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<DiscoverySettingsDoc, 'updated_at'>>) => void
}

const STORAGE_PART = 'discovery-settings' as const

function defaults(): DiscoverySettingsDoc {
  return {
    feed_interval_days: 7,
    last_feed_generated_at: null,
    updated_at: new Date().toISOString(),
  }
}

function rowToDoc(row: Record<string, unknown>): DiscoverySettingsDoc {
  return {
    feed_interval_days: row.feed_interval_days as DiscoverySettingsDoc['feed_interval_days'],
    last_feed_generated_at:
      (row.last_feed_generated_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  }
}

export function useDiscoverySettings(
  brandSlug: string | undefined,
): UseDiscoverySettingsResult {
  const brandId = useBrandId(brandSlug)
  const [item, setItem] = useState<DiscoverySettingsDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<DiscoverySettingsDoc | null>(null)
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
      setItem(loadOne<DiscoverySettingsDoc>([brandSlug, STORAGE_PART]))
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('discovery_settings')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useDiscoverySettings] → localStorage', err.message)
      localOnlyRef.current = true
      setItem(loadOne<DiscoverySettingsDoc>([brandSlug, STORAGE_PART]))
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
    (patch: Partial<Omit<DiscoverySettingsDoc, 'updated_at'>>) => {
      if (!brandSlug) return
      const base = itemRef.current ?? defaults()
      const next: DiscoverySettingsDoc = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)

      if (localOnlyRef.current || !supabase || !brandId) {
        saveOne([brandSlug, STORAGE_PART], next)
        return
      }

      void supabase
        .from('discovery_settings')
        .upsert(
          {
            brand_id: brandId,
            feed_interval_days: next.feed_interval_days,
            last_feed_generated_at: next.last_feed_generated_at,
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
