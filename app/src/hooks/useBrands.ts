import { useEffect, useState } from 'react'
import type { Brand } from '../types/db'

const MOCK_BRANDS: Brand[] = [
  {
    id: 'mock-herrmann',
    user_id: null,
    name: 'Herrmann & Co.',
    slug: 'herrmann',
    color: 'var(--accent-blue)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-offmarketbude',
    user_id: null,
    name: 'Offmarketbude',
    slug: 'offmarketbude',
    color: 'var(--accent-purple)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-homeflower',
    user_id: null,
    name: 'Homeflower',
    slug: 'homeflower',
    color: 'var(--accent-teal)',
    created_at: new Date().toISOString(),
  },
]

interface UseBrandsResult {
  brands: Brand[]
  loading: boolean
  error: string | null
}

export function useBrands(): UseBrandsResult {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // TODO: replace with supabase.from('brands').select() when configured.
    const timer = window.setTimeout(() => {
      if (cancelled) return
      try {
        setBrands(MOCK_BRANDS)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return { brands, loading, error }
}
