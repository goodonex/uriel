import { useParams } from 'react-router-dom'
import { readStoredBrandSlug, useActiveBrandOptional } from '../cockpit/lib/activeBrand'

/**
 * Brand-Slug-Brücke (Phase 4): löst den Slug unabhängig von der Shell auf.
 * 1. URL-Param (:slug) — alte /brand/:slug/…-Routen
 * 2. ActiveBrand-Context — Cockpit-Routen (/crm, /email, …)
 * 3. localStorage-Fallback — Redirect-Zwischenzustände
 *
 * Damit laufen die Sales-Seiten unverändert in beiden Welten.
 */
export function useCurrentBrandSlug(): string {
  const { slug } = useParams<{ slug?: string }>()
  const active = useActiveBrandOptional()
  return slug ?? active?.activeSlug ?? readStoredBrandSlug()
}
