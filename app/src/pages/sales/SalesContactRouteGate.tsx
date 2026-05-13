import { ContactPage } from './ContactPage'
import { useViewport } from '../../hooks/useViewport'

/** Desktop: null. Mobile: klassische Kontakt-Vollseite. */
export function SalesContactRouteGate() {
  const { isMobile } = useViewport()
  if (!isMobile) return null
  return <ContactPage />
}
