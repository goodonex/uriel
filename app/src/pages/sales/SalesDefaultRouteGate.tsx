import { SalesMode } from './SalesMode'
import { useViewport } from '../../hooks/useViewport'

/** Desktop: null (Module-System). Mobile: klassische SalesMode-Vollseite. */
export function SalesDefaultRouteGate() {
  const { isMobile } = useViewport()
  if (!isMobile) return null
  return <SalesMode />
}
