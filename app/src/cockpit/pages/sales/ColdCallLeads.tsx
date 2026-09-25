import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

/**
 * Cold-Call-Leads (25.09.2026) — EIN Bereich für alles, was nicht LinkedIn ist.
 *
 * Kevin: *„Leads nennen wir Cold-Call-Leads. Die Listen packen wir auch in
 * Leads rein … Call-Mode kommt auch in Leads rein. Neuer Lead kommt auch in
 * Leads rein … und Pipeline klassisch, dass das alles miteinander
 * zusammenwächst."* Vorher waren das fünf eigene Reiter in der Sales-Leiste.
 *
 * Die Adressen bleiben (`/sales/leads`, `/sales/lists`, `/sales/pipeline`,
 * `/sales/call-mode`, `/sales/new`) — sie hängen in Listen-Links, im
 * Suchfenster und in alten Lesezeichen. Neu ist nur der gemeinsame Kopf.
 */
const ANSICHTEN = [
  { to: '/sales/leads', label: 'Leads' },
  { to: '/sales/lists', label: 'Listen' },
  { to: '/sales/pipeline', label: 'Pipeline' },
]

export function ColdCallLeads({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <nav className="ck-segmente" aria-label="Cold-Call-Leads" style={{ flex: 1, minWidth: 0 }}>
          {ANSICHTEN.map((a) => (
            <NavLink key={a.to} to={a.to} className={({ isActive }) => `ck-segment${isActive ? ' active' : ''}`}>
              {a.label}
            </NavLink>
          ))}
        </nav>
        <span style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
          <button type="button" className="ck-btn" onClick={() => navigate('/sales/call-mode')}>
            Call-Mode
          </button>
          <button type="button" className="ck-btn ck-btn--primary" onClick={() => navigate('/sales/new')}>
            Neuer Lead
          </button>
        </span>
      </div>
      {children}
    </div>
  )
}
