import { useLocation, useNavigate } from 'react-router-dom'
import { useBrandWorkspaceMetrics } from '../hooks/useBrandDashboard'
import { parseBrandNavSection, type BrandNavSection } from '../lib/brandNav'

function fmt(n: number | null): string {
  if (n === null) return '—'
  return String(n)
}

/** Schmale Kontext-Leiste: andere Modi auf einen Blick, Klick = Navigation. */
export function ModeContextStrip({ slug }: { slug: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const active = parseBrandNavSection(location.pathname)
  const m = useBrandWorkspaceMetrics(slug)
  const base = `/brand/${slug}`

  if (active === 'dashboard') return null

  const segments: {
    key: BrandNavSection
    label: string
    text: string
    path: string
  }[] = []

  const push = (
    key: BrandNavSection,
    label: string,
    text: string,
    path: string,
  ) => {
    if (active !== key) segments.push({ key, label, text, path })
  }

  push('building', 'Building', `${fmt(m.assets)} Assets`, `${base}/building`)
  push(
    'discovery',
    'Discovery',
    `${fmt(m.discoveryWeek)} Signale (7d)`,
    `${base}/discovery`,
  )
  push('promo', 'Promo', `${fmt(m.promoUpcoming)} geplant`, `${base}/promo`)
  push(
    'sales',
    'Sales',
    `${fmt(m.pipeline)} in Pipeline`,
    `${base}/sales`,
  )
  push(
    'deliver',
    'Deliver',
    `${fmt(m.deliverActive)} aktiv`,
    `${base}/deliver`,
  )
  push('intelligence', 'Intel', 'Fokus öffnen', `${base}/intelligence`)

  if (segments.length === 0) return null

  return (
    <div
      className="font-body mb-5 flex min-h-[40px] flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2"
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-sm)',
        WebkitBackdropFilter: 'var(--blur-sm)',
      }}
    >
      <span
        className="font-mono shrink-0"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}
      >
        Kontext
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {segments.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => navigate(s.path)}
            className="font-body text-left transition-opacity hover:opacity-90"
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>{s.label}:</span>{' '}
            <span style={{ color: 'var(--text-primary)' }}>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
