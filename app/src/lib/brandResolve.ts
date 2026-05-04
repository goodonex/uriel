import type { Brand } from '../types/db'

/** Fallback-Nodes ohne echte `brands`-Zeile in Supabase — nie mit DB-UUID abgleichen. */
const LOCAL_FALLBACK_PREFIX = 'local-fallback-'

export function isLocalFallbackBrandId(id: string): boolean {
  return id.startsWith(LOCAL_FALLBACK_PREFIX)
}

export function brandIdFromSlug(brands: Brand[], slug: string): string | null {
  const b = brands.find((x) => x.slug === slug)
  if (!b) return null
  if (isLocalFallbackBrandId(b.id)) return null
  return b.id
}
