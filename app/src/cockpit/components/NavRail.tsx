import { NavLink } from 'react-router-dom'
import { useSocialUnread } from '../lib/socialApi'

const ITEMS: Array<{ to: string; label: string; icon: string }> = [
  { to: '/cockpit', label: 'Cockpit', icon: '◉' },
  { to: '/crm', label: 'CRM', icon: '▤' },
  { to: '/projekte', label: 'Projekte', icon: '◈' },
  { to: '/ads', label: 'Ads', icon: '◨' },
  { to: '/content', label: 'Content', icon: '◐' },
  { to: '/agenten', label: 'Agenten', icon: '⚙' },
  { to: '/email', label: 'E-Mail', icon: '✉' },
  { to: '/tracking', label: 'Tracking', icon: '▦' },
]

export function NavRail() {
  const socialUnread = useSocialUnread()
  return (
    <nav aria-label="Cockpit-Bereiche" className="ck-nav-rail">
      {ITEMS.map((item) => {
        const badge = item.to === '/content' ? socialUnread : 0
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `ck-nav-item${isActive ? ' active' : ''}`}
          >
            <span aria-hidden className="ck-nav-icon" style={{ position: 'relative' }}>
              {item.icon}
              {badge > 0 ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -6,
                    minWidth: 14,
                    height: 14,
                    padding: '0 3px',
                    borderRadius: 99,
                    background: 'var(--ck-accent)',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: '14px',
                    textAlign: 'center',
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </span>
            <span className="ck-nav-label">
              {item.label}
              {badge > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    width: 1,
                    height: 1,
                    overflow: 'hidden',
                    clip: 'rect(0 0 0 0)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {' '}
                  ({badge} neu)
                </span>
              ) : null}
            </span>
          </NavLink>
        )
      })}

      <div className="ck-nav-spacer" />

      {/* Zurück zur alten App, solange alt+neu koexistieren (bis Phase 6); auf Mobile ausgeblendet (Platz). */}
      <NavLink to="/" className="ck-nav-item ck-nav-back">
        <span aria-hidden className="ck-nav-icon">↩</span>
        <span className="ck-nav-label">Universe</span>
      </NavLink>
    </nav>
  )
}
