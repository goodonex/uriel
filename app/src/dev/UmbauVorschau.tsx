import { useSearchParams } from 'react-router-dom'
import { NavRail } from '../cockpit/components/NavRail'
import { CockpitReiter } from '../cockpit/components/CockpitReiter'
import { ActiveBrandProvider } from '../cockpit/lib/activeBrand'
import { SalesBibliothek } from '../cockpit/pages/SalesBibliothek'
import { LinkedinArea } from '../cockpit/pages/LinkedinArea'
import { LinkedinListen } from '../cockpit/pages/sales/LinkedinListen'
import { ColdCallLeads } from '../cockpit/pages/sales/ColdCallLeads'
import { LeadListe } from '../cockpit/pages/sales/LeadListe'
import '../styles/cockpit.css'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login) für den Umbau vom
 * 25.09.2026: Leiste, Cockpit-Reiter, LinkedIn-Listen, Tagesarbeit,
 * Cold-Call-Leads, Ressourcen. Ohne Sitzung bleiben die Daten leer — geprüft
 * wird Aufbau und Ordnung, nicht der Inhalt. `?seite=` wählt die Fläche.
 */
export function UmbauVorschau() {
  const [params] = useSearchParams()
  const seite = params.get('seite') ?? 'linkedin'
  return (
    <ActiveBrandProvider>
      <div
        className="ck-root"
        style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'auto', zIndex: 2 }}
      >
        <div className="ck-statusbar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ck-wordmark">URIEL</span>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <NavRail />
          <main className="ck-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            {seite === 'cockpit' ? <CockpitReiter agenten={<p className="ck-label">Agenten</p>} /> : null}
            {seite === 'linkedin' ? <LinkedinListen /> : null}
            {seite === 'arbeit' ? <LinkedinArea /> : null}
            {seite === 'coldcall' ? (
              <ColdCallLeads>
                <LeadListe />
              </ColdCallLeads>
            ) : null}
            {seite === 'ressourcen' ? <SalesBibliothek /> : null}
          </main>
        </div>
      </div>
    </ActiveBrandProvider>
  )
}
