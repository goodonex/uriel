import { useViewport } from '../../hooks/useViewport'
import { PromoMode } from './PromoMode'

export function PromoDefaultRouteGate() {
  const { isMobile } = useViewport()
  if (!isMobile) return null
  return <PromoMode />
}
