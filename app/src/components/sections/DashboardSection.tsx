import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandSystemDashboard } from '../BrandSystemDashboard'
import { PerformanceTrackingSection } from '../dashboard/PerformanceTrackingSection'
import { CardTile, CARD_TILE_TAP } from '../../modules/CardTile'
import { useBrands } from '../../hooks/useBrands'
import { useContacts } from '../../hooks/useContacts'
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed'
import { useTasks } from '../../hooks/useTasks'
import { SCROLL_SIDE_CARD_WIDTH, SECTION_SHELL, SECTION_VIEWPORT } from './sectionLayout'

function fmtDateLong(): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export function DashboardSection({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { brands } = useBrands()
  const contacts = useContacts(slug)
  const tasks = useTasks(slug)
  const feed = useDiscoveryFeed(slug)
  const [expanded, setExpanded] = useState(false)

  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug])

  const dueItems = useMemo(() => {
    const next: Array<{ id: string; label: string; href: string }> = []
    for (const c of contacts.items) {
      if (!c.next_follow_up_at) continue
      next.push({
        id: c.id,
        label: c.name || c.email || 'Kontakt',
        href: `/brand/${slug}/sales/${c.id}`,
      })
    }
    for (const t of tasks.items) {
      if (!t.due_at || t.status === 'done' || t.status === 'cancelled') continue
      next.push({
        id: t.id,
        label: t.title || 'Task',
        href: t.contact_id ? `/brand/${slug}/sales/${t.contact_id}` : `/brand/${slug}/sales`,
      })
    }
    return next.slice(0, 4)
  }, [contacts.items, tasks.items, slug])

  const signals = useMemo(() => feed.items.slice(0, 3), [feed.items])

  if (expanded) {
    return (
      <div data-scroll-section="dashboard" style={SECTION_SHELL}>
        <div style={{ ...SECTION_VIEWPORT, pointerEvents: 'auto', overflowY: 'auto' as const }}>
          <BrandSystemDashboard slug={slug} embedded />
          <button
            type="button"
            className="font-mono"
            onClick={() => setExpanded(false)}
            style={{
              marginTop: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Kompakt
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-scroll-section="dashboard" style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background:
              'radial-gradient(ellipse 80% 70% at 44% 46%, color-mix(in srgb, var(--bg-void) 22%, transparent), color-mix(in srgb, var(--bg-void) 78%, transparent) 72%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            pointerEvents: 'auto',
            zIndex: 2,
            maxWidth: 'min(420px, 55vw)',
          }}
        >
          <div
            className="font-display"
            style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}
          >
            {brand?.name ?? slug}
          </div>
          <div
            className="font-mono"
            style={{
              marginTop: 6,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            {fmtDateLong()}
          </div>
          <button
            type="button"
            className="font-mono"
            onClick={() => setExpanded(true)}
            style={{
              marginTop: 14,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--surface-card-strong)',
              backdropFilter: 'blur(12px)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Mehr anzeigen
          </button>
        </div>

        <CardTile
          flyFrom="left"
          delay={0.04}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: SCROLL_SIDE_CARD_WIDTH,
            maxHeight: '58%',
            overflowY: 'auto',
            zIndex: 3,
          }}
        >
          <PerformanceTrackingSection slug={slug} compact />
        </CardTile>

        <CardTile
          flyFrom="right"
          delay={0.08}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: SCROLL_SIDE_CARD_WIDTH,
            maxHeight: '48%',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            Heute fällig
          </div>
          {dueItems.length === 0 ? (
            <div className="font-body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Sauberer Tag
            </div>
          ) : (
            <ul className="list-none p-0" style={{ margin: 0, display: 'grid', gap: 6 }}>
              {dueItems.map((item) => (
                <li key={item.id}>
                  <motion.button
                    type="button"
                    {...CARD_TILE_TAP}
                    onClick={() => navigate(item.href)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: 10,
                      border: '1px solid var(--glass-border-2)',
                      background: 'var(--glass-1)',
                      padding: '8px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="font-body" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                  </motion.button>
                </li>
              ))}
            </ul>
          )}
        </CardTile>

        <CardTile
          flyFrom="right"
          delay={0.16}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: SCROLL_SIDE_CARD_WIDTH,
            maxHeight: '48%',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            Neueste Signale
          </div>
          {signals.length === 0 ? (
            <div className="font-body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Noch keine Signale
            </div>
          ) : (
            <ul className="list-none p-0" style={{ margin: 0, display: 'grid', gap: 6 }}>
              {signals.map((sig) => (
                <li key={sig.id}>
                  <motion.button
                    type="button"
                    {...CARD_TILE_TAP}
                    onClick={() => navigate(`/brand/${slug}/foundation`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderRadius: 10,
                      border: '1px solid var(--glass-border-2)',
                      background: 'var(--glass-1)',
                      padding: '8px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="font-body" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                      {sig.title}
                    </div>
                  </motion.button>
                </li>
              ))}
            </ul>
          )}
        </CardTile>
      </div>
    </div>
  )
}
