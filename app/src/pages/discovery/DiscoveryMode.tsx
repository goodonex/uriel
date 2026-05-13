import { Navigate, useParams } from 'react-router-dom'

/** Legacy-Route — gesamte Discovery-UI liegt unter `/brand/:slug/foundation`. */
export function DiscoveryMode() {
  const { slug = '' } = useParams<{ slug: string }>()
  return <Navigate to={`/brand/${slug}/foundation`} replace />
}
