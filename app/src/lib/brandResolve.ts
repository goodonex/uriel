import type { Brand } from '../types/db'

export function brandIdFromSlug(brands: Brand[], slug: string): string | null {
  return brands.find((b) => b.slug === slug)?.id ?? null
}
