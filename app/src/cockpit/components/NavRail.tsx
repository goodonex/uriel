import { NavLink } from 'react-router-dom'

const ITEMS: Array<{ to: string; label: string; icon: string }> = [
  { to: '/cockpit', label: 'Cockpit', icon: '◉' },
  { to: '/crm', label: 'CRM', icon: '▤' },
  { to: '/projekte', label: 'Projekte', icon: '◈' },
  { to: '/ads', label: 'Ads', icon: '◨' },
  { to: '/email', label: 'E-Mail', icon: '✉' },
  { to: '/tracking', label: 'Tracking', icon: '▦' },
]

export function NavRail() {
  return (
    <nav aria-label="Cockpit-Bereiche" className="ck-nav-rail">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `ck-nav-item${isActive ? ' active' : ''}`}
        >
          <span aria-hidden className="ck-nav-icon">
            {item.icon}
          </span>
          <span className="ck-nav-label">{item.label}</span>
        </NavLink>
      ))}

      <div className="ck-nav-spacer" />

      {/* Zurück zur alten App, solange alt+neu koexistieren (bis Phase 6); auf Mobile ausgeblendet (Platz). */}
      <NavLink to="/" className="ck-nav-item ck-nav-back">
        <span aria-hidden className="ck-nav-icon">↩</span>
        <span className="ck-nav-label">Universe</span>
      </NavLink>
    </nav>
  )
}
