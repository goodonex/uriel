import { useCallback, useEffect, useState } from 'react'
import type { Brand } from '../types/db'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

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

  return { brands, loading, error, reload }
}
