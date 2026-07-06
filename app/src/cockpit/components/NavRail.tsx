import { NavLink } from 'react-router-dom'

const ITEMS: Array<{ to: string; label: string; icon: string }> = [
  { to: '/cockpit', label: 'Cockpit', icon: '◉' },
  { to: '/crm', label: 'CRM', icon: '▤' },
  { to: '/email', label: 'E-Mail', icon: '✉' },
  { to: '/tracking', label: 'Tracking', icon: '▦' },
]

export function NavRail() {
  return (
    <nav
      aria-label="Cockpit-Bereiche"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '14px 10px',
        borderRight: '1px solid var(--ck-border)',
        width: 148,
        flexShrink: 0,
      }}
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `ck-nav-item${isActive ? ' active' : ''}`}
        >
          <span aria-hidden style={{ fontSize: 13, width: 16, textAlign: 'center' }}>
            {item.icon}
          </span>
          {item.label}
        </NavLink>
      ))}

      <div style={{ flex: 1 }} />

      {/* Zurück zur alten App, solange alt+neu koexistieren (bis Phase 6) */}
      <NavLink to="/" className="ck-nav-item" style={{ opacity: 0.6 }}>
        <span aria-hidden style={{ fontSize: 13, width: 16, textAlign: 'center' }}>↩</span>
        Universe
      </NavLink>
    </nav>
  )
}
