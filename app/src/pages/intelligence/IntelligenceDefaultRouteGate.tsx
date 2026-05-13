import { useViewport } from '../../hooks/useViewport'
import { IntelligenceMode } from './IntelligenceMode'

export function IntelligenceDefaultRouteGate() {
  const { isMobile } = useViewport()
  if (!isMobile) return null
  return <IntelligenceMode />
}
