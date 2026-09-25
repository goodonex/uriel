import { Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { CallModePage } from '../../pages/sales/CallModePage'
import { ContactListsPage } from '../../pages/sales/ContactListsPage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { SalesNewLeadPage } from '../../pages/sales/SalesNewLeadPage'
import { SalesBibliothek } from './SalesBibliothek'
import { SalesDashboard } from './SalesDashboard'
import { ColdCallLeads } from './sales/ColdCallLeads'
import { LeadListe } from './sales/LeadListe'
import { LeadDetail } from './sales/LeadDetail'
import { LinkedinListen } from './sales/LinkedinListen'
import { LinkedinArea } from './LinkedinArea'

/**
 * Sales — vier Reiter statt neun (25.09.2026).
 *
 * Kevin: *„dann stört mich hier diese ganzen Reiter da oben. Das ist alles
 * extrem unsinnig."* Vorher standen LinkedIn, Leads, LinkedIn-Kontakte,
 * Listen, Call-Mode, Neuer Lead, Ressourcen und die klassische Pipeline
 * gleichrangig nebeneinander (seit 28.08. einklappbar — das Problem war aber
 * nicht der Platz, sondern die fehlende Ordnung). Jetzt:
 *
 * - **Dashboard** — das Ritual, unverändert.
 * - **LinkedIn-Leads** — Listen (Stand + Bewertung) und Tagesarbeit.
 * - **Cold-Call-Leads** — Leads, Listen, Pipeline, Call-Mode, Neuer Lead.
 * - **Ressourcen** — Skripte und Vorlagen in der Reihenfolge des Ablaufs.
 *
 * Alle alten Adressen bleiben gültig; sie gehören jetzt nur einem Reiter an.
 */
interface Reiter {
  to: string
  label: string
  /** Pfad-Anfänge, unter denen dieser Reiter aktiv ist. */
  unter: string[]
}

const REITER: Reiter[] = [
  { to: '/sales', label: 'Dashboard', unter: [] },
  { to: '/sales/linkedin', label: 'LinkedIn-Leads', unter: ['/sales/linkedin', '/sales/kontakte'] },
  {
    to: '/sales/leads',
    label: 'Cold-Call-Leads',
    unter: ['/sales/leads', '/sales/lists', '/sales/pipeline', '/sales/call-mode', '/sales/new'],
  },
  { to: '/sales/bibliothek', label: 'Ressourcen', unter: ['/sales/bibliothek'] },
]

function aktiverReiter(pathname: string): string {
  const pfad = pathname.replace(/\/+$/, '')
  if (pfad === '/sales') return '/sales'
  for (const r of REITER) {
    if (r.unter.some((u) => pfad === u || pfad.startsWith(`${u}/`))) return r.to
  }
  // `/sales/:contactId` — die Akte eines Cold-Call-Kontakts.
  return '/sales/leads'
}

function SalesReiter() {
  const loc = useLocation()
  const aktiv = aktiverReiter(loc.pathname)
  return (
    <nav className="ck-segmente" aria-label="Sales" style={{ marginBottom: 16 }}>
      {REITER.map((r) => (
        <NavLink
          key={r.to}
          to={r.to}
          className={`ck-segment${r.to === aktiv ? ' active' : ''}`}
          aria-current={r.to === aktiv ? 'page' : undefined}
        >
          {r.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** LinkedIn-Leads: zwei Bereiche — die Listen und das Operative. */
function LinkedinLeads({ bereich }: { bereich: 'listen' | 'arbeit' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <nav className="ck-segmente" aria-label="LinkedIn-Leads">
        <NavLink to="/sales/linkedin" className={`ck-segment${bereich === 'listen' ? ' active' : ''}`}>
          Listen
        </NavLink>
        <NavLink to="/sales/linkedin/arbeit" className={`ck-segment${bereich === 'arbeit' ? ' active' : ''}`}>
          Tagesarbeit
        </NavLink>
      </nav>
      {bereich === 'listen' ? <LinkedinListen /> : <LinkedinArea />}
    </div>
  )
}

/** Alte Adresse der Kontaktliste (17.09.) → dieselbe Akte in den Listen. */
function KontaktWeiche() {
  const { leadId } = useParams<{ leadId: string }>()
  return <Navigate to={leadId ? `/sales/linkedin/lead/${leadId}` : '/sales/linkedin'} replace />
}

export function SalesArea() {
  return (
    <div>
      <SalesReiter />
      <Routes>
        <Route index element={<SalesDashboard />} />
        <Route path="linkedin" element={<LinkedinLeads bereich="listen" />} />
        <Route path="linkedin/lead/:leadId" element={<LinkedinLeads bereich="listen" />} />
        <Route path="linkedin/arbeit" element={<LinkedinLeads bereich="arbeit" />} />
        <Route path="kontakte" element={<KontaktWeiche />} />
        <Route path="kontakte/:leadId" element={<KontaktWeiche />} />
        <Route path="leads" element={<ColdCallLeads><LeadListe /></ColdCallLeads>} />
        <Route path="lists" element={<ColdCallLeads><ContactListsPage /></ColdCallLeads>} />
        <Route path="lists/:listId" element={<ColdCallLeads><ContactListsPage /></ColdCallLeads>} />
        {/* Die klassische Pipeline bleibt, bis die Paritäts-Karte
            (docs/phase2/sales-paritaet.md) abgehakt ist — sie kann Kanban,
            Bulk-Aktionen, E-Mail-Vorlagen und Meeting-Links, die der Neubau
            (noch) nicht kann. */}
        <Route path="pipeline" element={<ColdCallLeads><SalesMode panel="full" scrollEmbed /></ColdCallLeads>} />
        <Route path="call-mode" element={<ColdCallLeads><CallModePage /></ColdCallLeads>} />
        <Route path="new" element={<ColdCallLeads><SalesNewLeadPage /></ColdCallLeads>} />
        <Route path="bibliothek" element={<SalesBibliothek />} />
        <Route path=":contactId" element={<LeadDetail />} />
      </Routes>
    </div>
  )
}
