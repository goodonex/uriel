import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ModeKey } from '../types/db'
import { useBrands } from '../hooks/useBrands'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import { useSidebarSignals } from '../hooks/useSidebarSignals'
import { parseBrandNavSection, type BrandNavSection } from '../lib/brandNav'
import { useCommandPalette } from '../lib/commandPaletteContext'
import { NotificationBell } from './NotificationBell'

const COLLAPSED_W = 64
const EXPANDED_W = 240
/** Float-Dock links; zusammen mit EXPANDED_W = Platzbedarf bei Hover */
const FLOAT_DOCK_INSET = 16

interface NavItem {
  section: BrandNavSection
  path: string
  label: string
  mono: ModeKey | null
}

const NAV: NavItem[] = [
  { section: 'dashboard', path: 'dashboard', label: 'Dashboard', mono: null },
  {
    section: 'foundation',
    path: 'foundation',
    label: 'Foundation',
    mono: 'building',
  },
  { section: 'promo', path: 'promo', label: 'Promo', mono: 'promo' },
  { section: 'sales', path: 'sales', label: 'Sales', mono: 'sales' },
  { section: 'deliver', path: 'deliver', label: 'Deliver', mono: 'deliver' },
  { section: 'intelligence', path: 'intelligence', label: 'Intelligence', mono: 'intelligence' },
]

function navIcon(section: BrandNavSection): ReactNode {
  switch (section) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" strokeLinejoin="round" />
        </svg>
      )
    case 'foundation':
      return (
        <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x="2" y="7" width="12" height="7" rx="2" />
          <path d="M4 7V5a4 4 0 0 1 8 0v2" />
          <circle cx="11" cy="4.5" r="2" fill="currentColor" stroke="none" opacity={0.35} />
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

export interface BrandWorkspaceSidebarProps {
  slug: string
  /** `float`: fixed links, Hover expand. `drawer`: im Mobile-Drawer immer breit */
  layout?: 'float' | 'drawer'
}

export function BrandWorkspaceSidebar({ slug, layout = 'float' }: BrandWorkspaceSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location
  const { brands } = useBrands()
  const current = brands.find((b) => b.slug === slug)
  const active = parseBrandNavSection(pathname)
  const accentColor =
    current?.color && current.color.trim() && !current.color.startsWith('var(')
      ? current.color
      : 'var(--accent-teal)'

  const isDrawer = layout === 'drawer'
  const [hoverOpen, setHoverOpen] = useState(false)
  const [tapPinned, setTapPinned] = useState(false)

  const expanded = isDrawer || hoverOpen || tapPinned
  const w = expanded ? EXPANDED_W : COLLAPSED_W

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
  const signals = useSidebarSignals(slug)
  const { openPalette } = useCommandPalette()
  const platformShortcut = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'
  const deliverSectionActive = active === 'deliver'
  const showDeliverSubmenu =
    expanded &&
    activeDeliverProjects.length > 0 &&
    (hoveredSection === 'deliver' || deliverSectionActive)

  const floatDockStyle = {
    position: 'fixed' as const,
    left: FLOAT_DOCK_INSET,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 45,
    pointerEvents: 'none' as const,
  }

  const shellStyle =
    layout === 'float'
      ? {
          /** Positionierung passiert am Dock-Wrapper (vertikal zentriert) */
          height: 'fit-content',
          maxHeight: 'calc(100vh - 32px)',
          borderRadius: 18,
          border: '1px solid var(--glass-border-1)',
          background: 'rgba(8, 8, 16, 0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '8px 0 32px rgba(0,0,0,0.35)',
          pointerEvents: 'auto' as const,
          overflowX: 'hidden' as const,
          overflowY: 'auto' as const,
        }
      : {
          position: 'relative' as const,
          height: '100%',
          minHeight: 0,
          borderRadius: 0,
          border: 'none',
          background: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
          pointerEvents: 'auto' as const,
          overflow: 'hidden',
        }

  const aside = (
    <motion.aside
      initial={false}
      animate={{ width: isDrawer ? EXPANDED_W : w }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="font-body flex flex-col"
      style={shellStyle}
      onMouseEnter={() => {
        if (!isDrawer) setHoverOpen(true)
      }}
      onMouseLeave={() => {
        if (!isDrawer) {
          setHoverOpen(false)
        }
      }}
    >
      <div
        className="flex flex-col"
        style={{ padding: expanded ? '14px 12px' : '10px 8px' }}
      >
        <div
          className="mb-3 flex items-center gap-2"
          style={{ justifyContent: expanded ? 'space-between' : 'center' }}
        >
          {expanded ? (
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
          {!isDrawer ? (
            <button
              type="button"
              title={tapPinned ? 'Ausgeklappt lösen' : 'Ausgeklappt halten'}
              onClick={(e) => {
                e.stopPropagation()
                setTapPinned((p) => !p)
              }}
              className="font-mono shrink-0 rounded-md transition-colors"
              style={{
                fontSize: 10,
                padding: '3px 6px',
                border: '1px solid var(--glass-border-2)',
                background: tapPinned ? 'var(--glass-2)' : 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {tapPinned ? '●' : '○'}
            </button>
          ) : null}
        </div>

        <div
          className="mb-3 flex items-center gap-1.5"
          style={{ flexDirection: expanded ? 'row' : 'column' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              openPalette()
            }}
            title={`Suche · ${platformShortcut}`}
            data-no-scale
            className="font-mono flex min-w-0 items-center gap-2 rounded-lg transition-colors"
            style={{
              flex: expanded ? 1 : undefined,
              height: 30,
              padding: expanded ? '0 8px' : 0,
              width: expanded ? undefined : '100%',
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              justifyContent: expanded ? 'flex-start' : 'center',
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
            {expanded ? (
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
          <NotificationBell slug={slug} collapsed={!expanded} />
        </div>

        <nav className="space-y-0.5" style={{ marginRight: -4 }}>
          {NAV.map((item) => {
            const isActive =
              item.section === 'sales'
                ? salesBranchActive
                : item.section === 'foundation'
                  ? active === 'foundation'
                  : active === item.section
            const to = `${base}/${item.path}`
            const accent = item.mono ? modeCssVar(item.mono) : '--brand-accent'

            const isDeliverItem = item.section === 'deliver'
            const submenuVisibleHere = isDeliverItem && showDeliverSubmenu

            return (
              <div
                key={item.section}
                onMouseEnter={() => setHoveredSection(item.section)}
                onMouseLeave={() =>
                  setHoveredSection((curr) => (curr === item.section ? null : curr))
                }
              >
                <Link
                  to={to}
                  title={!expanded ? item.label : undefined}
                  data-no-scale
                  onClick={(e) => e.stopPropagation()}
                  className="group relative flex items-center rounded-lg"
                  style={{
                    textDecoration: 'none',
                    padding: expanded ? '8px 10px' : '8px 0',
                    justifyContent: expanded ? 'flex-start' : 'center',
                    gap: 10,
                    background: 'transparent',
                    border: '1px solid transparent',
                  }}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      style={{
                        position: 'absolute',
                        left: expanded ? 0 : 4,
                        top: 8,
                        bottom: 8,
                        width: 2,
                        borderRadius: 999,
                        background: `var(${accent})`,
                        boxShadow: `0 0 8px color-mix(in srgb, var(${accent}) 50%, transparent)`,
                      }}
                      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    />
                  ) : null}
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: 26,
                      height: 26,
                      color: isActive ? `var(${accent})` : 'var(--text-tertiary)',
                    }}
                  >
                    {navIcon(item.section)}
                  </span>
                  {expanded ? (
                    <span
                      className="font-display min-w-0 flex-1 truncate"
                      style={{
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {item.label}
                    </span>
                  ) : null}
                  {(() => {
                    const hasSignal =
                      (item.section === 'foundation' && signals.discoveryNew) ||
                      (item.section === 'sales' && signals.salesDue) ||
                      (item.section === 'deliver' && signals.deliverProgress)
                    if (!hasSignal) return null
                    return (
                      <span
                        className="dot-pulse"
                        title="Neue Aktivität"
                        style={{
                          position: !expanded ? 'absolute' : 'static',
                          top: !expanded ? 6 : undefined,
                          right: !expanded ? 8 : undefined,
                          marginLeft: !expanded ? 0 : 4,
                        }}
                      />
                    )
                  })()}
                  {isDeliverItem && expanded && activeDeliverProjects.length > 0 ? (
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
                              data-no-scale
                              onClick={(e) => e.stopPropagation()}
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
            onClick={(e) => {
              e.stopPropagation()
              navigate('/')
            }}
            title="Zurück zum Universe"
            data-no-scale
            className="flex w-full items-center font-mono transition-colors"
            style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: expanded ? '8px 10px' : '8px 0',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: 8,
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 13 }}>◎</span>
            {expanded ? <span>Universe</span> : null}
          </button>
        </div>
      </div>
    </motion.aside>
  )

  if (isDrawer) {
    return aside
  }

  return (
    <div style={floatDockStyle}>
      {aside}
    </div>
  )
}

/**
 * Abstand für Haupt-Module & Seiteninhalt: Dock links + **aufgeklappte** Sidebar-Breite + Luft,
 * damit Hover-Expand nicht über den Inhalt legt.
 */
export const BRAND_FLOAT_MAIN_LEFT_X = FLOAT_DOCK_INSET + EXPANDED_W + 16
export const BRAND_FLOAT_SIDEBAR_CLEARANCE_X = BRAND_FLOAT_MAIN_LEFT_X
