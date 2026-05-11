import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ModeKey } from '../types/db'
import { useBrands } from '../hooks/useBrands'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import { parseBrandNavSection, type BrandNavSection } from '../lib/brandNav'
import { useCommandPalette } from '../lib/commandPaletteContext'
import { NotificationBell } from './NotificationBell'

const LS_COLLAPSE = 'brand-os-sidebar-collapsed'

const EXPANDED_W = 196
const COLLAPSED_W = 60

interface NavItem {
  section: BrandNavSection
  path: string
  label: string
  mono: ModeKey | null
}

const NAV: NavItem[] = [
  { section: 'dashboard', path: 'dashboard', label: 'Dashboard', mono: null },
  { section: 'building', path: 'building', label: 'Building', mono: 'building' },
  { section: 'discovery', path: 'discovery', label: 'Discovery', mono: 'discovery' },
  { section: 'promo', path: 'promo', label: 'Promo', mono: 'promo' },
  { section: 'sales', path: 'sales', label: 'Sales', mono: 'sales' },
  { section: 'deliver', path: 'deliver', label: 'Deliver', mono: 'deliver' },
  { section: 'intelligence', path: 'intelligence', label: 'Intelligence', mono: 'intelligence' },
]

function navIcon(section: BrandNavSection): React.ReactNode {
  switch (section) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" strokeLinejoin="round" />
        </svg>
      )
    case 'building':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="2" y="2" width="12" height="12" rx="3" />
          <path d="M5 8h6M5 5.5h4M5 10.5h3" />
        </svg>
      )
    case 'discovery':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth={1.5} />
          <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth={1.2} />
        </svg>
      )
    case 'promo':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M3 12 L7 6 L10 9 L13 4" />
        </svg>
      )
    case 'sales':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="8" cy="6" r="3" />
          <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" />
        </svg>
      )
    case 'deliver':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M3 13 L8 3 L13 13 Z" strokeLinejoin="round" />
        </svg>
      )
    case 'intelligence':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M8 2 L10 6 L14 6.5 L11 9.5 L11.5 14 L8 12 L4.5 14 L5 9.5 L2 6.5 L6 6 Z" />
        </svg>
      )
    default:
      return null
  }
}

function modeCssVar(m: ModeKey): string {
  switch (m) {
    case 'building':
      return '--mode-building'
    case 'discovery':
      return '--accent-coral'
    case 'promo':
      return '--mode-promo'
    case 'sales':
      return '--mode-sales'
    case 'deliver':
      return '--accent-teal'
    case 'intelligence':
      return '--mode-intelligence'
    default:
      return '--brand-accent'
  }
}

export function BrandWorkspaceSidebar({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { brands } = useBrands()
  const current = brands.find((b) => b.slug === slug)
  const active = parseBrandNavSection(location.pathname)
  const accentColor =
    current?.color && current.color.trim() && !current.color.startsWith('var(')
      ? current.color
      : 'var(--accent-teal)'

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_COLLAPSE) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSE, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const w = collapsed ? COLLAPSED_W : EXPANDED_W

  const base = `/brand/${slug}`

  const salesBranchActive = active === 'sales' || active === 'sales_lists'

  const deliverProjects = useDeliverProjects(slug)
  const params = useParams<{ projectId?: string }>()
  const activeProjectId = params.projectId ?? null

  const activeDeliverProjects = useMemo(
    () =>
      deliverProjects.items
        .filter((p) => p.status === 'active')
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [deliverProjects.items],
  )

  const [hoveredSection, setHoveredSection] = useState<BrandNavSection | null>(null)
  const { openPalette } = useCommandPalette()
  const platformShortcut = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'
  const deliverSectionActive = active === 'deliver'
  const showDeliverSubmenu =
    !collapsed &&
    activeDeliverProjects.length > 0 &&
    (hoveredSection === 'deliver' || deliverSectionActive)

  return (
    <motion.aside
      initial={false}
      animate={{ width: w }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="font-body flex shrink-0 flex-col"
      style={{
        pointerEvents: 'auto',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        borderRight: '1px solid var(--glass-border-1)',
        background: 'color-mix(in srgb, var(--bg-base) 82%, transparent)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
        boxShadow: '8px 0 32px rgba(0,0,0,0.25)',
      }}
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ padding: collapsed ? '10px 8px' : '14px 12px' }}
      >
        <div
          className="mb-3 flex items-center gap-2"
          style={{ justifyContent: collapsed ? 'center' : 'space-between' }}
        >
          {!collapsed ? (
            <Link
              to={`${base}/dashboard`}
              className="font-display min-w-0 flex-1 truncate"
              title={current?.name ?? slug}
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                borderLeft: `2px solid ${accentColor}`,
                paddingLeft: 8,
                lineHeight: 1.15,
              }}
            >
              {current?.name ?? slug}
            </Link>
          ) : (
            <div
              title={current?.name ?? slug}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: accentColor,
                boxShadow: `0 0 10px ${accentColor}`,
              }}
            />
          )}
          <button
            type="button"
            title={collapsed ? 'Sidebar öffnen' : 'Sidebar einklappen'}
            onClick={() => setCollapsed((c) => !c)}
            className="font-mono shrink-0 rounded-md transition-colors"
            style={{
              fontSize: 10,
              padding: '3px 6px',
              border: '1px solid var(--glass-border-2)',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <div
          className="mb-3 flex items-center gap-1.5"
          style={{ flexDirection: collapsed ? 'column' : 'row' }}
        >
          <button
            type="button"
            onClick={openPalette}
            title={`Suche · ${platformShortcut}`}
            className="font-mono flex min-w-0 items-center gap-2 rounded-lg transition-colors"
            style={{
              flex: 1,
              height: 30,
              padding: collapsed ? 0 : '0 8px',
              width: collapsed ? '100%' : undefined,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <svg
              width={11}
              height={11}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              style={{ flexShrink: 0 }}
            >
              <circle cx="7" cy="7" r="4" />
              <path d="M10 10 L13 13" strokeLinecap="round" />
            </svg>
            {!collapsed ? (
              <>
                <span style={{ fontSize: 11, flex: 1, textAlign: 'left' }}>Suchen</span>
                <span
                  className="shrink-0"
                  style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 4,
                    border: '1px solid var(--glass-border-2)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {platformShortcut}
                </span>
              </>
            ) : null}
          </button>
          <NotificationBell slug={slug} collapsed={collapsed} />
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" style={{ marginRight: -4 }}>
          {NAV.map((item) => {
            const isActive = item.section === 'sales' ? salesBranchActive : active === item.section
            const to = `${base}/${item.path}`
            const accent = item.mono ? modeCssVar(item.mono) : '--brand-accent'

            const isDeliverItem = item.section === 'deliver'
            const submenuVisibleHere = isDeliverItem && showDeliverSubmenu

            return (
              <div
                key={item.path}
                onMouseEnter={() => setHoveredSection(item.section)}
                onMouseLeave={() =>
                  setHoveredSection((curr) => (curr === item.section ? null : curr))
                }
              >
                <Link
                  to={to}
                  title={collapsed ? item.label : undefined}
                  className="group flex items-center rounded-xl transition-all duration-200"
                  style={{
                    textDecoration: 'none',
                    padding: collapsed ? '9px 0' : '9px 10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10,
                    background: isActive ? 'var(--glass-3)' : 'transparent',
                    border: `1px solid ${isActive ? 'var(--glass-border-3)' : 'transparent'}`,
                    boxShadow: isActive
                      ? `0 0 16px color-mix(in srgb, var(${accent}) 10%, transparent)`
                      : undefined,
                  }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      color: isActive ? `var(${accent})` : 'var(--text-secondary)',
                      background: isActive
                        ? `color-mix(in srgb, var(${accent}) 16%, transparent)`
                        : 'var(--glass-1)',
                    }}
                  >
                    {navIcon(item.section)}
                  </span>
                  {!collapsed ? (
                    <span
                      className="font-display min-w-0 flex-1 truncate"
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {item.label}
                    </span>
                  ) : null}
                  {isDeliverItem &&
                  !collapsed &&
                  activeDeliverProjects.length > 0 ? (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: isActive
                          ? 'color-mix(in srgb, var(--accent-teal) 22%, transparent)'
                          : 'var(--glass-1)',
                        color: 'var(--accent-teal)',
                        border: '1px solid var(--glass-border-2)',
                      }}
                    >
                      {activeDeliverProjects.length}
                    </span>
                  ) : null}
                </Link>

                <AnimatePresence initial={false}>
                  {submenuVisibleHere ? (
                    <motion.ul
                      key="deliver-submenu"
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-col gap-0.5 overflow-hidden"
                      style={{
                        marginLeft: 18,
                        paddingLeft: 10,
                        borderLeft: '1px solid var(--glass-border-1)',
                        marginTop: 2,
                        marginBottom: 4,
                      }}
                    >
                      {activeDeliverProjects.map((p) => {
                        const projectActive = activeProjectId === p.id
                        return (
                          <li key={p.id}>
                            <Link
                              to={`${base}/deliver/${p.id}`}
                              title={p.name}
                              className="flex items-center gap-2 rounded-lg truncate transition-colors"
                              style={{
                                textDecoration: 'none',
                                padding: '5px 8px',
                                fontSize: 11,
                                color: projectActive
                                  ? 'var(--accent-teal)'
                                  : 'var(--text-secondary)',
                                background: projectActive ? 'var(--glass-2)' : 'transparent',
                                border: `1px solid ${
                                  projectActive ? 'var(--glass-border-2)' : 'transparent'
                                }`,
                              }}
                            >
                              <span
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: '50%',
                                  background: projectActive
                                    ? 'var(--accent-teal)'
                                    : 'var(--text-tertiary)',
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                className="truncate"
                                style={{ fontWeight: projectActive ? 600 : 400 }}
                              >
                                {p.name}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </motion.ul>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>

        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--glass-border-1)',
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            title="Zurück zum Universe"
            className="flex w-full items-center font-mono transition-colors"
            style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: collapsed ? '8px 0' : '8px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8,
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13 }}>◎</span>
            {!collapsed ? <span>Universe</span> : null}
          </button>
        </div>
      </div>
    </motion.aside>
  )
}

export { EXPANDED_W as BRAND_SIDEBAR_EXPANDED_WIDTH }
