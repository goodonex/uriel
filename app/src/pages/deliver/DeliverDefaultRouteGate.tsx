import { useViewport } from '../../hooks/useViewport'
import { DeliverMode } from '../DeliverMode'

/** Desktop: null (Scroll-Flow). Mobile: klassische Deliver-Vollseite. */
export function DeliverDefaultRouteGate() {
  const { isMobile } = useViewport()
  if (!isMobile) return null
  return <DeliverMode />
}
