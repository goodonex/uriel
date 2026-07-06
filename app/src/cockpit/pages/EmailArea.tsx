import { NavLink, Route, Routes } from 'react-router-dom'
import { PromoEmailFlowsPanel } from '../../pages/promo/PromoEmailFlowsPanel'
import { PromoEmailPanel } from '../../pages/promo/PromoEmailPanel'
import { PromoSequencesPanel } from '../../pages/promo/PromoSequencesPanel'
import { useActiveBrand } from '../lib/activeBrand'

function EmailSubNav() {
  const items = [
    { to: '/email', label: 'Versand', end: true },
    { to: '/email/flows', label: 'Flows', end: false },
    { to: '/email/sequenzen', label: 'Sequenzen', end: false },
  ]
  return (
    <nav aria-label="E-Mail-Unterbereiche" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) => `ck-nav-item${isActive ? ' active' : ''}`}
          style={{ padding: '6px 10px' }}
        >
          {i.label}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * E-Mail (REBUILD-PLAN §5.3): Promo-E-Mail-Panels in der Cockpit-Shell.
 * Die Panels nehmen slug als Prop — Promo-Code bleibt komplett unangetastet.
 * Edge Functions (send-email, process-sequences, track-*) unverändert.
 */
export function EmailArea() {
  const { activeBrand, loading } = useActiveBrand()

  if (loading || !activeBrand) {
    return <p style={{ color: 'var(--ck-text-3)', fontSize: 12 }}>Lade Brand…</p>
  }

  return (
    <div>
      <EmailSubNav />
      <Routes>
        <Route index element={<PromoEmailPanel slug={activeBrand.slug} />} />
        <Route path="flows" element={<PromoEmailFlowsPanel slug={activeBrand.slug} />} />
        <Route path="sequenzen" element={<PromoSequencesPanel slug={activeBrand.slug} />} />
      </Routes>
    </div>
  )
}
