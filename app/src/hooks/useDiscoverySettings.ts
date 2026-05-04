import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOne, saveOne } from '../lib/storage'
import type { DiscoverySettingsDoc } from '../types/db'

interface UseDiscoverySettingsResult {
  item: DiscoverySettingsDoc | null
  loading: boolean
  error: string | null
  save: (patch: Partial<Omit<DiscoverySettingsDoc, 'updated_at'>>) => void
}

function defaults(): DiscoverySettingsDoc {
  return {
    feed_interval_days: 7,
    last_feed_generated_at: null,
    updated_at: new Date().toISOString(),
  }
}

export function useDiscoverySettings(
  brandSlug: string | undefined,
): UseDiscoverySettingsResult {
  const [item, setItem] = useState<DiscoverySettingsDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemRef = useRef<DiscoverySettingsDoc | null>(null)
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
        setItem(loadOne<DiscoverySettingsDoc>([brandSlug, 'discovery-settings']))
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
    (patch: Partial<Omit<DiscoverySettingsDoc, 'updated_at'>>) => {
      if (!brandSlug) return
      const base = itemRef.current ?? defaults()
      const next: DiscoverySettingsDoc = {
        ...base,
        ...patch,
        updated_at: new Date().toISOString(),
      }
      setItem(next)
      saveOne([brandSlug, 'discovery-settings'], next)
    },
    [brandSlug],
  )

  return { item, loading, error, save }
}
