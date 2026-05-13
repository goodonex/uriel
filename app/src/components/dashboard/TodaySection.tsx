import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  contactsDueToday,
  contactsOverdue,
  contactsThisWeek,
} from '../../hooks/useBrandDashboard'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import type { Contact } from '../../types/db'

interface TodaySectionProps {
  slug: string
  contacts: Contact[]
  loading: boolean
}

function formatWeekday(): string {
  const d = new Date()
  const day = d.toLocaleDateString('de-DE', { weekday: 'long' })
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })
  return `${day}, ${date}`
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const day0 = new Date(d)
    day0.setHours(0, 0, 0, 0)
    return Math.round((today.getTime() - day0.getTime()) / 86400000)
  } catch {
    return null
  }
}

export function TodaySection({ slug, contacts, loading }: TodaySectionProps) {
  const navigate = useNavigate()
  const positioning = usePositioning(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const businessModel = useBusinessModel(slug)

  const due = useMemo(() => contactsDueToday(contacts), [contacts])
  const overdue = useMemo(() => contactsOverdue(contacts), [contacts])
  const week = useMemo(() => contactsThisWeek(contacts), [contacts])

  const foundationScore = useMemo(() => {
    const checks: Array<{ label: string; ok: boolean }> = [
      {
        label: 'Positioning',
        ok: Boolean(positioning.item?.statement?.trim()),
      },
      {
        label: 'Tone',
        ok: Boolean(positioning.item?.tone_of_voice?.trim()),
      },
      {
        label: 'ICPs',
        ok: icps.items.length > 0,
      },
      {
        label: 'Wortbank',
        ok: wordBank.items.length >= 3,
      },
      {
        label: 'Business Model',
        ok: Boolean(
          businessModel.item?.who?.trim() &&
            businessModel.item?.what?.trim() &&
            businessModel.item?.how?.trim() &&
            businessModel.item?.for_whom?.trim() &&
            businessModel.item?.revenue?.trim(),
        ),
      },
    ]
    const ok = checks.filter((c) => c.ok).length
    return { checks, ok, total: checks.length, pct: Math.round((ok / checks.length) * 100) }
  }, [positioning.item, icps.items, wordBank.items, businessModel.item])

  const lastContactActivity = useMemo(() => {
    let latest: string | null = null
    for (const c of contacts) {
      const ts = c.last_contact_at ?? c.updated_at
      if (!ts) continue
      if (!latest || ts > latest) latest = ts
    }
    return latest
  }, [contacts])
  const daysSinceLast = daysSince(lastContactActivity)
  const streakLabel =
    daysSinceLast === null
      ? '—'
      : daysSinceLast === 0
      ? 'heute'
      : daysSinceLast === 1
      ? 'gestern'
      : `vor ${daysSinceLast} Tagen`

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 rounded-2xl"
      style={{
        background:
          'linear-gradient(140deg, color-mix(in srgb, var(--brand-accent, var(--accent-blue)) 16%, transparent), color-mix(in srgb, var(--accent-teal) 8%, transparent))',
        border:
          '1px solid color-mix(in srgb, var(--brand-accent, var(--glass-border-2)) 28%, var(--glass-border-2))',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
        padding: '22px 22px 20px',
      }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
          >
            MEIN TAG
          </div>
          <h3
            className="font-display mt-1"
            style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}
          >
            {formatWeekday()}
          </h3>
        </div>
        <div
          className="flex flex-wrap gap-2 font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          <span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{due.length}</span>{' '}
            heute
          </span>
          <span style={{ color: 'var(--glass-border-2)' }}>·</span>
          <span>
            <span
              style={{
                color: overdue.length > 0 ? 'var(--accent-coral)' : 'var(--text-primary)',
                fontWeight: 600,
              }}
            >
              {overdue.length}
            </span>{' '}
            überfällig
          </span>
          <span style={{ color: 'var(--glass-border-2)' }}>·</span>
          <span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{week.length}</span>{' '}
            Woche
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="rounded-xl"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            padding: '14px 14px 12px',
          }}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <div
              className="font-mono"
              style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
            >
              FOLLOW-UPS HEUTE
            </div>
            {due.length > 5 ? (
              <button
                type="button"
                onClick={() => navigate(`/brand/${slug}/sales`)}
                className="font-mono"
                style={{
                  fontSize: 9,
                  color: 'var(--mode-sales)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                +{due.length - 5}
              </button>
            ) : null}
          </div>
          {loading ? (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Lädt …
            </div>
          ) : due.length === 0 ? (
            <div
              className="font-body"
              style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
            >
              Nichts heute fällig. Sauberer Tag.
            </div>
          ) : (
            <ul className="list-none space-y-1.5 p-0">
              {due.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/brand/${slug}/sales/${c.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-md text-left transition-colors"
                    style={{
                      background: 'transparent',
                      border: '1px solid transparent',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--glass-2)'
                      e.currentTarget.style.borderColor = 'var(--glass-border-1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = 'transparent'
                    }}
                  >
                    <span
                      className="truncate font-body"
                      style={{ fontSize: 12, fontWeight: 500 }}
                    >
                      {c.name || c.email || 'Unbenannt'}
                    </span>
                    <span
                      className="font-mono shrink-0"
                      style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                    >
                      {c.pipeline_stage}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="rounded-xl"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            padding: '14px 14px 12px',
          }}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <div
              className="font-mono"
              style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
            >
              ÜBERFÄLLIG
            </div>
            {overdue.length > 0 ? (
              <span
                className="font-mono"
                style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 5,
                  background: 'color-mix(in srgb, var(--accent-coral) 14%, transparent)',
                  color: 'var(--accent-coral)',
                }}
              >
                {overdue.length}
              </span>
            ) : null}
          </div>
          {loading ? (
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Lädt …
            </div>
          ) : overdue.length === 0 ? (
            <div className="font-body" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Nichts überfällig. 
            </div>
          ) : (
            <ul className="list-none space-y-1.5 p-0">
              {overdue.slice(0, 4).map((c) => {
                const d = daysSince(c.next_follow_up_at)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/brand/${slug}/sales/${c.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-md text-left transition-colors"
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--glass-2)'
                        e.currentTarget.style.borderColor = 'var(--glass-border-1)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      <span className="truncate font-body" style={{ fontSize: 12 }}>
                        {c.name || c.email || 'Unbenannt'}
                      </span>
                      <span
                        className="font-mono shrink-0"
                        style={{ fontSize: 9, color: 'var(--accent-coral)' }}
                      >
                        {d !== null ? `-${d}d` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div
          className="rounded-xl"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            padding: '14px 14px 12px',
          }}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <div
              className="font-mono"
              style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
            >
              FOUNDATION
            </div>
            <button
              type="button"
              onClick={() => navigate(`/brand/${slug}/foundation`)}
              className="font-mono"
              style={{
                fontSize: 9,
                color: 'var(--mode-building)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Öffnen →
            </button>
          </div>
          <div className="mb-2 flex items-baseline gap-2">
            <span
              className="font-display"
              style={{
                fontSize: 28,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {foundationScore.pct}%
            </span>
            <span
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
            >
              {foundationScore.ok}/{foundationScore.total} bereit
            </span>
          </div>
          <div
            className="mb-3 h-1.5 overflow-hidden rounded-full"
            style={{ background: 'var(--glass-2)' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${foundationScore.pct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: '100%',
                borderRadius: 999,
                background:
                  'linear-gradient(90deg, var(--mode-building), var(--accent-teal))',
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {foundationScore.checks.map((c) => (
              <span
                key={c.label}
                className="font-mono"
                style={{
                  fontSize: 9,
                  padding: '3px 7px',
                  borderRadius: 999,
                  border: '1px solid var(--glass-border-2)',
                  background: c.ok
                    ? 'color-mix(in srgb, var(--accent-teal) 14%, transparent)'
                    : 'transparent',
                  color: c.ok ? 'var(--accent-teal)' : 'var(--text-tertiary)',
                  letterSpacing: '0.02em',
                }}
                title={c.ok ? 'Bereit' : 'Noch nicht befüllt'}
              >
                {c.ok ? '✓' : '○'} {c.label}
              </span>
            ))}
          </div>
          <div
            className="font-mono mt-3 border-t pt-2"
            style={{
              fontSize: 9,
              color: 'var(--text-tertiary)',
              borderColor: 'var(--glass-border-1)',
              letterSpacing: '0.06em',
            }}
          >
            Letzte Aktivität: {streakLabel}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
