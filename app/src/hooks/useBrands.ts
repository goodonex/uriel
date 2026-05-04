import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brand } from '../types/db'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULT_BRANDS: Omit<Brand, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Herrmann & Co.', slug: 'herrmann', color: 'var(--accent-blue)' },
  { name: 'Offmarketbude', slug: 'offmarketbude', color: 'var(--accent-purple)' },
  { name: 'Homeflower', slug: 'homeflower', color: 'var(--accent-teal)' },
]

/** Wenn die DB-Migrationen noch nicht laufen: gleiche Slugs wie später in Supabase, damit Navigation stimmt. */
const FALLBACK_BRANDS: Brand[] = [
  {
    id: 'local-fallback-herrmann',
    user_id: null,
    name: 'Herrmann & Co.',
    slug: 'herrmann',
    color: 'var(--accent-blue)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-offmarketbude',
    user_id: null,
    name: 'Offmarketbude',
    slug: 'offmarketbude',
    color: 'var(--accent-purple)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-homeflower',
    user_id: null,
    name: 'Homeflower',
    slug: 'homeflower',
    color: 'var(--accent-teal)',
    created_at: new Date().toISOString(),
  },
]

function isBrandsTableUnavailable(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    m.includes('relation') && m.includes('brands') && m.includes('does not exist')
  )
}

interface UseBrandsResult {
  brands: Brand[]
  loading: boolean
  error: string | null
  /** Explizit neu laden (z. B. nach Seed). */
  reload: () => Promise<void>
}

function mapBrand(row: {
  id: string
  user_id: string | null
  name: string
  slug: string
  color: string | null
  created_at: string
}): Brand {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    slug: row.slug,
    color: row.color ?? '',
    created_at: row.created_at,
  }
}

export function useBrands(): UseBrandsResult {
  const { user } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seedAttemptedRef = useRef(false)

  const reload = useCallback(async () => {
    if (!supabase || !user?.id) {
      setBrands([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (err) {
      if (isBrandsTableUnavailable(err.message)) {
        console.warn(
          '[useBrands] Tabelle `brands` fehlt oder Cache — 3D-Graph nutzt Fallback. Migration 0001 im Supabase SQL Editor ausführen.',
          err.message,
        )
        setError(null)
        setBrands(FALLBACK_BRANDS)
      } else {
        setError(err.message)
        setBrands([])
      }
    } else {
      setError(null)
      setBrands((data ?? []).map(mapBrand))
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!supabase || !user?.id || loading) return
    if (brands.length > 0) {
      seedAttemptedRef.current = false
      return
    }
    if (seedAttemptedRef.current) return
    seedAttemptedRef.current = true
    void (async () => {
      const rows = DEFAULT_BRANDS.map((b) => ({
        user_id: user.id,
        name: b.name,
        slug: b.slug,
        color: b.color,
      }))
      const { error: insErr } = await supabase.from('brands').insert(rows)
      if (insErr) {
        if (isBrandsTableUnavailable(insErr.message)) {
          console.warn(
            '[useBrands] Seed übersprungen (keine Tabelle) — Fallback-Nodes.',
            insErr.message,
          )
          setBrands(FALLBACK_BRANDS)
          setError(null)
        } else {
          console.warn('[useBrands] Standard-Brands:', insErr.message)
        }
        seedAttemptedRef.current = false
        return
      }
      await reload()
    })()
  }, [user?.id, brands.length, loading, reload])

  return { brands, loading, error, reload }
}
