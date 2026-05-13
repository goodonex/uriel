import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrands } from '../hooks/useBrands'
import { useContacts } from '../hooks/useContacts'
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed'
import { useTasks } from '../hooks/useTasks'
import { BrandDashboardPage } from '../pages/BrandDashboardPage'

function fmtDateLong(): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function formatTimeAgoDe(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'gerade eben'
  const m = Math.floor(s / 60)
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24)
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`
}

interface DueItem {
  id: string
  type: 'followup' | 'task'
  label: string
  subtitle: string
  dueAtMs: number
  href: string
}

export function BrandSystemDashboard({ slug, embedded = false }: { slug: string; embedded?: boolean }) {
  const navigate = useNavigate()
  const { brands } = useBrands()
  const contacts = useContacts(slug)
  const tasks = useTasks(slug)
  const feed = useDiscoveryFeed(slug)
  const [expanded, setExpanded] = useState(false)

  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug])
  const accent = brand?.color?.startsWith('#')
    ? brand.color
    : 'var(--accent-teal)'

  const dueItems = useMemo<DueItem[]>(() => {
    const now = Date.now()
    const next: DueItem[] = []

    for (const c of contacts.items) {
      if (!c.next_follow_up_at) continue
      const due = new Date(c.next_follow_up_at).getTime()
      if (Number.isNaN(due)) continue
      next.push({
        id: c.id,
        type: 'followup',
        label: c.name || c.email || 'Kontakt',
        subtitle: `Follow-up · ${new Date(c.next_follow_up_at).toLocaleDateString('de-DE')}`,
        dueAtMs: due,
        href: `/brand/${slug}/sales/${c.id}`,
      })
    }

    for (const t of tasks.items) {
      if (!t.due_at) continue
      if (t.status === 'done' || t.status === 'cancelled') continue
      const due = new Date(t.due_at).getTime()
      if (Number.isNaN(due)) continue
      next.push({
        id: t.id,
        type: 'task',
        label: t.title || 'Task',
        subtitle: `Task · ${new Date(t.due_at).toLocaleDateString('de-DE')}`,
        dueAtMs: due,
        href: t.contact_id
          ? `/brand/${slug}/sales/${t.contact_id}`
          : `/brand/${slug}/sales`,
      })
    }

    return next
      .sort((a, b) => {
        const overdueA = a.dueAtMs < now ? 0 : 1
        const overdueB = b.dueAtMs < now ? 0 : 1
        if (overdueA !== overdueB) return overdueA - overdueB
        return a.dueAtMs - b.dueAtMs
      })
      .slice(0, 3)
  }, [contacts.items, tasks.items, slug])

  const latestSignals = useMemo(
    () => feed.items.slice(0, 2),
    [feed.items],
  )

  return (
    <div
      style={{
        position: 'relative',
        minHeight: embedded ? 0 : '100vh',
        maxHeight: embedded ? 'min(72vh, 640px)' : undefined,
        overflowY: embedded ? 'auto' : undefined,
        padding: embedded ? '8px 4px 12px' : '24px 24px 32px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <div
            className="font-display"
            style={{
              fontSize: embedded ? 22 : 34,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              textShadow: '0 10px 36px rgba(0,0,0,0.45)',
            }}
          >
            {brand?.name ?? slug}
          </div>
          <div
            className="font-mono"
            style={{
              marginTop: 8,
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            {fmtDateLong()}
          </div>
        </div>

        <div
          style={{
            width: embedded ? 'min(260px, 42%)' : 'min(300px, 34vw)',
            display: 'grid',
            gap: 10,
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--glass-border-1)',
              background: 'rgba(8, 8, 16, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '12px 12px 10px',
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: 8,
              }}
            >
              Heute fällig
            </div>
            {dueItems.length === 0 ? (
              <div
                className="font-body"
                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
              >
                Sauberer Tag
              </div>
            ) : (
              <ul className="list-none p-0" style={{ margin: 0, display: 'grid', gap: 6 }}>
                {dueItems.map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <button
                      type="button"
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
                      <div
                        className="font-body"
                        style={{ fontSize: 12.5, color: 'var(--text-primary)' }}
                      >
                        {item.label}
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          marginTop: 3,
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {item.subtitle}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            style={{
              borderRadius: 14,
              border: '1px solid var(--glass-border-1)',
              background: 'rgba(8, 8, 16, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '12px 12px 10px',
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: 8,
              }}
            >
              Neueste Signale
            </div>
            {latestSignals.length === 0 ? (
              <div
                className="font-body"
                style={{ fontSize: 13, color: 'var(--text-secondary)' }}
              >
                Noch keine Signale
              </div>
            ) : (
              <ul className="list-none p-0" style={{ margin: 0, display: 'grid', gap: 6 }}>
                {latestSignals.map((sig) => (
                  <li key={sig.id}>
                    <button
                      type="button"
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
                      <div
                        className="font-body"
                        style={{ fontSize: 12.5, color: 'var(--text-primary)' }}
                      >
                        {sig.title}
                      </div>
                      <div
                        className="font-mono"
                        style={{
                          marginTop: 3,
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        {formatTimeAgoDe(sig.recorded_at)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            borderRadius: 10,
            border: '1px solid var(--glass-border-2)',
            background: 'rgba(8, 8, 16, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            padding: '8px 10px',
            cursor: 'pointer',
            boxShadow: `0 0 22px color-mix(in srgb, ${accent} 12%, transparent)`,
          }}
        >
          {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="brand-dashboard-expanded"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 14,
              borderRadius: 16,
              border: '1px solid var(--glass-border-1)',
              background: 'rgba(8, 8, 16, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: 16,
              pointerEvents: 'auto',
              maxHeight: embedded ? 'min(40vh, 360px)' : '70vh',
              overflowY: 'auto',
            }}
          >
            <BrandDashboardPage />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
