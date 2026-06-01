import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ModeKey } from '../types/db'
import { useBrands } from '../hooks/useBrands'
import { useContactLists } from '../hooks/useContactLists'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import { useSidebarSignals } from '../hooks/useSidebarSignals'
import { parseBrandNavSection, type BrandNavSection } from '../lib/brandNav'
import { sectionFromPathname } from '../lib/scrollFlow'
import {
  navSectionToScrollKey,
  scrollKeyToNavSection,
  useScrollSectionContext,
} from '../context/ScrollSectionContext'
import { useCommandPalette } from '../lib/commandPaletteContext'
import { ClosedModulesTray } from './ClosedModulesTray'
import { FlyoutLink, SidebarSubmenuFlyout } from './SidebarSubmenuFlyout'
import { PROMO_PANELS, promoPathForPanel } from '../lib/horizontalPanels'

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

/** Sub-Routen behalten Pfad-basiertes Sidebar-Highlight (Listen, Projekte, …). */
function scrollSyncUsesPathHighlight(pathname: string): boolean {
  return (
    /\/sales\/lists/.test(pathname) ||
    /\/sales\/call-mode/.test(pathname) ||
    /\/deliver\/[^/]+/.test(pathname)
  )
}

const NAV: NavItem[] = [
  { section: 'dashboard', path: '', label: 'Dashboard', mono: null },
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
  const base = `/brand/${slug}`
  const { brands } = useBrands()
  const current = brands.find((b) => b.slug === slug)
  const scrollCtx = useScrollSectionContext()
  const pathActive = parseBrandNavSection(pathname)
  const pathSectionKey = sectionFromPathname(pathname)
  const active =
    scrollCtx?.syncEnabled &&
    !scrollSyncUsesPathHighlight(pathname) &&
    pathSectionKey === 'dashboard'
      ? scrollKeyToNavSection(scrollCtx.activeSection)
      : pathActive

  const accentColor =
    current?.color && current.color.trim() && !current.color.startsWith('var(')
      ? current.color
      : 'var(--accent-teal)'

  const isDrawer = layout === 'drawer'
  const [hoverOpen, setHoverOpen] = useState(false)
  const [tapPinned, setTapPinned] = useState(false)
  const hoverCloseTimer = useRef<number | null>(null)

  const cancelHoverClose = () => {
    if (hoverCloseTimer.current !== null) {
      window.clearTimeout(hoverCloseTimer.current)
      hoverCloseTimer.current = null
    }
  }

  const salesBranchActive = active === 'sales' || active === 'sales_lists'

  const [sidebarGlowTick, setSidebarGlowTick] = useState(0)
  useEffect(() => {
    setSidebarGlowTick((n) => n + 1)
  }, [active])

  const deliverProjects = useDeliverProjects(slug)
  const contactLists = useContactLists(slug)
  const params = useParams<{ projectId?: string }>()
  const activeProjectId = params.projectId ?? null

  const activeSalesListId = useMemo(() => {
    const m = pathname.match(/\/sales\/lists\/([^/]+)\/?$/)
    return m?.[1] ?? null
  }, [pathname])

  const activeDeliverProjects = useMemo(
    () =>
      deliverProjects.items
        .filter((p) => p.status === 'active')
        .slice()
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [deliverProjects.items],
  )

  const [hoveredSection, setHoveredSection] = useState<BrandNavSection | null>(null)
  const [flyoutPinned, setFlyoutPinned] = useState<
    'sales' | 'deliver' | 'intelligence' | 'promo' | null
  >(null)
  const flyoutClearTimer = useRef<number | null>(null)

  // Sidebar bleibt expanded, solange ein Flyout sichtbar ist, damit die Sub-Items
  // (Listen, Projekte, …) auch erreichbar sind, ohne dass die Sidebar erst zuklappt.
  const scheduleHoverClose = () => {
    cancelHoverClose()
    hoverCloseTimer.current = window.setTimeout(() => {
      setHoverOpen(false)
    }, 180)
  }

  const cancelFlyoutClear = () => {
    if (flyoutClearTimer.current !== null) {
      window.clearTimeout(flyoutClearTimer.current)
      flyoutClearTimer.current = null
    }
  }

  const scheduleFlyoutClear = () => {
    cancelFlyoutClear()
    flyoutClearTimer.current = window.setTimeout(() => {
      setFlyoutPinned(null)
      setHoveredSection(null)
    }, 160)
  }

  const openFlyout = (section: 'sales' | 'deliver' | 'intelligence' | 'promo') => {
    cancelHoverClose()
    cancelFlyoutClear()
    setHoveredSection(section)
    setFlyoutPinned(section)
  }

  const collapseAll = () => {
    cancelHoverClose()
    cancelFlyoutClear()
    setHoverOpen(false)
    setHoveredSection(null)
    setFlyoutPinned(null)
  }

  // Nach jedem Routenwechsel Hover-States zurücksetzen — sonst hängt die
  // Sidebar offen, wenn man im Flyout auf einen Link klickt (das Flyout-DOM
  // unmounted, bevor sein onMouseLeave feuern kann).
  useEffect(() => {
    if (isDrawer || tapPinned) return
    collapseAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Sicherheitsnetz: wenn der Maus das Browserfenster verlässt oder Tab den
  // Fokus verliert, Sidebar zumachen (ausser fest gepinnt).
  useEffect(() => {
    if (isDrawer || tapPinned) return
    const onDocLeave = (e: MouseEvent) => {
      if (e.relatedTarget === null) collapseAll()
    }
    const onBlur = () => collapseAll()
    document.addEventListener('mouseleave', onDocLeave)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('mouseleave', onDocLeave)
      window.removeEventListener('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawer, tapPinned])

  const anyFlyoutOpen = flyoutPinned !== null || hoveredSection !== null
  const expanded = isDrawer || hoverOpen || tapPinned || anyFlyoutOpen
  const w = expanded ? EXPANDED_W : COLLAPSED_W

  const signals = useSidebarSignals(slug)
  const { openPalette } = useCommandPalette()
  const platformShortcut = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K'
  const deliverSectionActive = active === 'deliver'
  const flyoutLeft = FLOAT_DOCK_INSET + w + 10

  const showSalesFlyout =
    flyoutPinned === 'sales' || hoveredSection === 'sales'
  const showDeliverFlyout =
    (flyoutPinned === 'deliver' || hoveredSection === 'deliver') &&
    activeDeliverProjects.length > 0
  const showIntelligenceFlyout =
    flyoutPinned === 'intelligence' || hoveredSection === 'intelligence'
  const showPromoFlyout = flyoutPinned === 'promo' || hoveredSection === 'promo'

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
        if (!isDrawer) {
          cancelHoverClose()
          setHoverOpen(true)
        }
      }}
      onMouseLeave={() => {
        if (!isDrawer) scheduleHoverClose()
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
              to={base}
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
        </div>

        <nav className="space-y-0.5" style={{ marginRight: -4 }}>
          {NAV.map((item) => {
            const isActive =
              item.section === 'sales'
                ? salesBranchActive
                : item.section === 'foundation'
                  ? active === 'foundation'
                  : active === item.section
            const to = item.path ? `${base}/${item.path}` : base
            const accent = item.mono ? modeCssVar(item.mono) : '--brand-accent'

            const isDeliverItem = item.section === 'deliver'
            const isSalesItem = item.section === 'sales'
            const isIntelligenceItem = item.section === 'intelligence'
            const isPromoItem = item.section === 'promo'
            const hasFlyout = isDeliverItem || isSalesItem || isIntelligenceItem || isPromoItem

            const salesTo =
              isSalesItem && contactLists.lists.length === 1
                ? `${base}/sales/lists/${contactLists.lists[0].id}`
                : isSalesItem
                  ? `${base}/sales/lists`
                  : to

            return (
              <div
                key={item.section}
                onMouseEnter={() => {
                  if (hasFlyout) {
                    openFlyout(item.section as 'sales' | 'deliver' | 'intelligence' | 'promo')
                  } else {
                    setHoveredSection(item.section)
                  }
                }}
                onMouseLeave={() => {
                  if (hasFlyout) {
                    scheduleFlyoutClear()
                  } else {
                    setHoveredSection((curr) => (curr === item.section ? null : curr))
                  }
                }}
              >
                <Link
                  to={isSalesItem ? salesTo : to}
                  title={!expanded ? item.label : undefined}
                  data-no-scale
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!scrollCtx?.syncEnabled) return
                    e.preventDefault()
                    const key = navSectionToScrollKey(item.section)
                    const target = isSalesItem ? `${base}/sales` : to
                    navigate(target, { replace: true })
                    scrollCtx.setActiveSection(key)
                    scrollCtx.scrollToSection(key)
                  }}
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
                      layoutId="active-indicator"
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
                      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
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
                    <motion.span
                      key={`nav-${item.section}-${isActive ? sidebarGlowTick : 'idle'}`}
                      className="font-display min-w-0 flex-1 truncate"
                      animate={
                        isActive
                          ? {
                              textShadow: [
                                '0 0 12px var(--brand-accent)',
                                '0 0 0px transparent',
                              ],
                            }
                          : { textShadow: '0 0 0px transparent' }
                      }
                      transition={{ duration: 0.6 }}
                      style={{
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {item.label}
                    </motion.span>
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
                  {isSalesItem && expanded && contactLists.lists.length > 0 ? (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: isActive
                          ? 'color-mix(in srgb, var(--mode-sales) 22%, transparent)'
                          : 'var(--glass-1)',
                        color: 'var(--mode-sales)',
                        border: '1px solid var(--glass-border-2)',
                      }}
                    >
                      {contactLists.lists.length}
                    </span>
                  ) : null}
                </Link>
              </div>
            )
          })}
        </nav>

        {!isDrawer ? <ClosedModulesTray /> : null}

        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--glass-border-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {scrollCtx?.syncEnabled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                scrollCtx.setSectionScrollEnabled(!scrollCtx.sectionScrollEnabled)
              }}
              title={
                scrollCtx.sectionScrollEnabled
                  ? 'Section-Scrollen deaktivieren'
                  : 'Section-Scrollen aktivieren'
              }
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
                border: scrollCtx.sectionScrollEnabled
                  ? '1px solid color-mix(in srgb, var(--accent-teal) 45%, var(--glass-border-2))'
                  : '1px solid var(--glass-border-2)',
                background: scrollCtx.sectionScrollEnabled
                  ? 'color-mix(in srgb, var(--accent-teal) 12%, transparent)'
                  : 'var(--glass-1)',
                color: scrollCtx.sectionScrollEnabled ? 'var(--accent-teal)' : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.4}>
                <path d="M4 6 L8 2 L12 6" />
                <path d="M4 10 L8 14 L12 10" />
              </svg>
              {expanded ? (
                <span>{scrollCtx.sectionScrollEnabled ? 'Section-Scroll an' : 'Section-Scroll aus'}</span>
              ) : null}
            </button>
          ) : null}
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
      <SidebarSubmenuFlyout
        visible={showSalesFlyout}
        left={flyoutLeft}
        title="Sales"
        accentVar="--mode-sales"
        onMouseEnter={() => openFlyout('sales')}
        onMouseLeave={scheduleFlyoutClear}
      >
        <FlyoutLink
          to={`${base}/sales`}
          label="Pipeline"
          accentVar="--mode-sales"
          active={active === 'sales' && !activeSalesListId}
          onClick={() => scrollCtx?.scrollToSection('sales')}
        />
        <FlyoutLink
          to={`${base}/sales/lists`}
          label="Alle Listen"
          accentVar="--mode-sales"
          active={active === 'sales_lists' && !activeSalesListId}
        />
        {contactLists.lists.map((l) => (
          <FlyoutLink
            key={l.id}
            to={`${base}/sales/lists/${l.id}`}
            label={l.name}
            accentVar="--mode-sales"
            active={activeSalesListId === l.id}
            onClick={() => scrollCtx?.scrollToSection('sales')}
          />
        ))}
      </SidebarSubmenuFlyout>

      <SidebarSubmenuFlyout
        visible={showDeliverFlyout}
        left={flyoutLeft}
        title="Deliver"
        accentVar="--accent-teal"
        onMouseEnter={() => openFlyout('deliver')}
        onMouseLeave={scheduleFlyoutClear}
      >
        <FlyoutLink
          to={`${base}/deliver`}
          label="Alle Projekte"
          accentVar="--accent-teal"
          active={deliverSectionActive && !activeProjectId}
          onClick={() => scrollCtx?.scrollToSection('deliver')}
        />
        {activeDeliverProjects.map((p) => (
          <FlyoutLink
            key={p.id}
            to={`${base}/deliver/${p.id}`}
            label={p.name}
            accentVar="--accent-teal"
            active={activeProjectId === p.id}
            onClick={() => scrollCtx?.scrollToSection('deliver')}
          />
        ))}
      </SidebarSubmenuFlyout>

      <SidebarSubmenuFlyout
        visible={showIntelligenceFlyout}
        left={flyoutLeft}
        title="Intelligence"
        accentVar="--mode-intelligence"
        onMouseEnter={() => openFlyout('intelligence')}
        onMouseLeave={scheduleFlyoutClear}
      >
        <FlyoutLink
          to={`${base}/intelligence`}
          label="Übersicht"
          accentVar="--mode-intelligence"
          active={active === 'intelligence'}
          onClick={() => scrollCtx?.scrollToSection('intelligence')}
        />
        <FlyoutLink
          to={`${base}/intelligence`}
          label="Morning Brief"
          accentVar="--mode-intelligence"
          active={false}
          onClick={() => scrollCtx?.scrollToSection('intelligence')}
        />
        <FlyoutLink
          to={`${base}/intelligence`}
          label="Live Reports"
          accentVar="--mode-intelligence"
          active={false}
          onClick={() => scrollCtx?.scrollToSection('intelligence')}
        />
        <FlyoutLink
          to={`${base}/intelligence`}
          label="Focus"
          accentVar="--mode-intelligence"
          active={false}
          onClick={() => scrollCtx?.scrollToSection('intelligence')}
        />
      </SidebarSubmenuFlyout>

      <SidebarSubmenuFlyout
        visible={showPromoFlyout}
        left={flyoutLeft}
        title="Promo"
        accentVar="--mode-promo"
        onMouseEnter={() => openFlyout('promo')}
        onMouseLeave={scheduleFlyoutClear}
      >
        {PROMO_PANELS.map((panel, index) => (
          <FlyoutLink
            key={panel.id}
            to={promoPathForPanel(slug, index)}
            label={panel.label}
            accentVar="--mode-promo"
            active={
              active === 'promo' &&
              (panel.segment
                ? pathname.includes(`/promo/${panel.segment}`)
                : /\/promo\/?$/.test(pathname))
            }
            onClick={() => scrollCtx?.scrollToSection('promo')}
          />
        ))}
      </SidebarSubmenuFlyout>
    </div>
  )
}

/**
 * Abstand für Haupt-Module & Seiteninhalt: Dock links + **eingeklappte** Sidebar-Breite + kleine Luft.
 * Beim Hover-Expand floatet die (semi-transparente, blurred) Sidebar sauber über den Content,
 * statt rechts daneben einen toten Streifen zu hinterlassen.
 */
export const BRAND_FLOAT_MAIN_LEFT_X = FLOAT_DOCK_INSET + COLLAPSED_W + 16
export const BRAND_FLOAT_SIDEBAR_CLEARANCE_X = BRAND_FLOAT_MAIN_LEFT_X
