import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brand } from '../types/db'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULT_BRANDS: Omit<Brand, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Herrmann & Co.', slug: 'herrmann', color: 'var(--accent-blue)' },
  { name: 'Offmarketbude', slug: 'offmarketbude', color: 'var(--accent-purple)' },
  { name: 'Homeflower', slug: 'homeflower', color: 'var(--accent-teal)' },
]

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
      setError(err.message)
      setBrands([])
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
        console.warn('[useBrands] Standard-Brands:', insErr.message)
        seedAttemptedRef.current = false
        return
      }
      await reload()
    })()
  }, [user?.id, brands.length, loading, reload])

  return { brands, loading, error, reload }
}
