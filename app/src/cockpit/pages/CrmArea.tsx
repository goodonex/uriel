import { NavLink, Route, Routes } from 'react-router-dom'
import { CallModePage } from '../../pages/sales/CallModePage'
import { ContactListsPage } from '../../pages/sales/ContactListsPage'
import { ContactPage } from '../../pages/sales/ContactPage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { SalesNewLeadPage } from '../../pages/sales/SalesNewLeadPage'

function CrmSubNav() {
  const items = [
    { to: '/crm', label: 'Pipeline', end: true },
    { to: '/crm/lists', label: 'Listen', end: false },
    { to: '/crm/call-mode', label: 'Call-Mode', end: false },
    { to: '/crm/new', label: 'Neuer Lead', end: false },
  ]
  return (
    <nav aria-label="CRM-Unterbereiche" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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
 * CRM (REBUILD-PLAN §5.2): bestehende Sales-Seiten in der Cockpit-Shell.
 * Logik unangetastet — Brand kommt über useCurrentBrandSlug aus dem
 * ActiveBrand-Context statt aus der URL.
 */
export function CrmArea() {
  return (
    <div>
      <CrmSubNav />
      <Routes>
        <Route index element={<SalesMode panel="full" scrollEmbed />} />
        <Route path="lists" element={<ContactListsPage />} />
        <Route path="lists/:listId" element={<ContactListsPage />} />
        <Route path="call-mode" element={<CallModePage />} />
        <Route path="new" element={<SalesNewLeadPage />} />
        <Route path=":contactId" element={<ContactPage variant="page" />} />
      </Routes>
    </div>
  )
}
