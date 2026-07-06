import { Navigate, useLocation, useParams } from 'react-router-dom'
import { storeBrandSlug } from './activeBrand'

/**
 * Brücke alte Welt → Cockpit (Phase 4): /brand/:slug/sales/* → /crm/*.
 * Übernimmt den Slug aus der URL als aktive Cockpit-Brand, damit interne
 * Links aus SalesMode (die weiter auf /brand/… zeigen) korrekt landen.
 */
export function LegacySalesRedirect() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()

  if (slug) storeBrandSlug(slug)

  const marker = '/sales'
  const idx = location.pathname.indexOf(marker)
  const rest = idx >= 0 ? location.pathname.slice(idx + marker.length) : ''

  // /pipeline und /heute waren Default-Ansichten der alten Welt → Pipeline-Home
  const normalized = rest === '/pipeline' || rest === '/heute' ? '' : rest

  return <Navigate to={`/crm${normalized}${location.search}`} replace />
}
