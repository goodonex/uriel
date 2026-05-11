import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ModeKey } from '../types/db'
import { useBrandWorkspaceMetrics } from '../hooks/useBrandDashboard'
import { useBrands } from '../hooks/useBrands'
import { parseBrandNavSection, type BrandNavSection } from '../lib/brandNav'

const LS_COLLAPSE = 'brand-os-sidebar-collapsed'

/** Schmaler für mehr Content-Breite */
const EXPANDED_W = 204
const COLLAPSED_W = 64

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
      return '--text-accent'
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

  const stats = useBrandWorkspaceMetrics(slug)
  const w = collapsed ? COLLAPSED_W : EXPANDED_W

  const fmt = useCallback((n: number | null) => (n === null ? '—' : String(n)), [])

  const base = `/brand/${slug}`

  const salesBranchActive = active === 'sales' || active === 'sales_lists'
  const otherBrands = brands.filter((b) => b.slug !== slug)

  return (
    <motion.aside
      initial={false}
      animate={{ width: w }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="font-body flex h-screen shrink-0 flex-col"
      style={{
        pointerEvents: 'auto',
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
        <div className="mb-3 flex items-center justify-between gap-1">
          <Link
            to="/"
            className="font-display shrink-0"
            title="Universe"
            style={{
              fontSize: collapsed ? 11 : 13,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              textDecoration: 'none',
            }}
          >
            {collapsed ? 'B' : 'Brand OS'}
          </Link>
          <button
            type="button"
            title={collapsed ? 'Sidebar öffnen' : 'Sidebar einklappen'}
            onClick={() => setCollapsed((c) => !c)}
            className="font-mono shrink-0 rounded-lg transition-colors"
            style={{
              fontSize: 9,
              letterSpacing: '0.08em',
              padding: '5px 7px',
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {!collapsed ? (
          <div
            className="mb-4 rounded-xl px-3 py-2.5"
            style={{
              borderLeft: `2px solid ${accentColor}`,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            <div
              className="font-display leading-tight"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {current?.name ?? slug}
            </div>
            <div
              className="font-mono mt-2"
              style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
            >
              Brand
            </div>
            {otherBrands.length > 0 ? (
              <div
                className="mt-2 flex min-h-0 flex-wrap gap-1"
                style={{ maxHeight: 56, overflowY: 'auto' }}
              >
                {otherBrands.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="font-mono rounded-full truncate"
                    style={{
                      fontSize: 9,
                      maxWidth: '100%',
                      padding: '4px 8px',
                      border: '1px solid var(--glass-border-2)',
                      background: 'var(--glass-2)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/brand/${b.slug}/dashboard`)}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="mb-3 flex justify-center"
            title={current?.name ?? slug}
            style={{
              width: '100%',
              height: 4,
              borderRadius: 2,
              background: accentColor,
              opacity: 0.85,
            }}
          />
        )}

        {!collapsed ? (
          <div
            className="mb-4 rounded-xl px-3 py-2"
            style={{
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: 8, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
            >
              QUICK STATS
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1">
              {(
                [
                  ['Pipeline', stats.pipeline],
                  ['Content', stats.contentMonth],
                  ['Projekte', stats.deliverActive],
                ] as const
              ).map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{label}</div>
                  <div className="font-display" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                    {stats.loading ? '…' : fmt(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-3 flex flex-col gap-1.5">
            {[stats.pipeline, stats.contentMonth, stats.deliverActive].map((v, i) => (
              <div
                key={i}
                className="font-mono text-center"
                style={{
                  fontSize: 9,
                  padding: '3px 0',
                  borderRadius: 6,
                  backgroundColor: 'var(--glass-1)',
                  color: 'var(--text-secondary)',
                }}
                title={['Pipeline', 'Content', 'Projekte'][i]}
              >
                {stats.loading ? '·' : fmt(v)}
              </div>
            ))}
          </div>
        )}

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" style={{ marginRight: -4 }}>
          {NAV.map((item) => {
            const isActive = item.section === 'sales' ? salesBranchActive : active === item.section
            const to = `${base}/${item.path}`
            const accent = item.mono ? modeCssVar(item.mono) : '--text-accent'

            return (
              <Link
                key={item.path}
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
                    className="font-display min-w-0 truncate"
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {item.label}
                  </span>
                ) : null}
              </Link>
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
