import { useMemo } from 'react'
import { brandIdFromSlug } from '../lib/brandResolve'
import { useBrands } from './useBrands'

export function useBrandId(brandSlug: string | undefined): string | null {
  const { brands } = useBrands()
  return useMemo(() => {
    if (!brandSlug) return null
    return brandIdFromSlug(brands, brandSlug)
  }, [brands, brandSlug])
}
