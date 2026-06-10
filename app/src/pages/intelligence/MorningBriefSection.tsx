import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useMorningBrief } from '../../hooks/useMorningBrief'
import type { PipelineStage } from '../../types/db'

const STAGE_ORDER: PipelineStage[] = [
  'first_contact',
  'conversation',
  'follow_up',
  'proposal',
  'deal',
  'paused',
]

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  follow_up: 'Follow up',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

function todayIsoDay(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function scheduledIsoDay(scheduledAt: string): string {
  const t = scheduledAt.trim()
  return t.length >= 10 ? t.slice(0, 10) : t
}

export function MorningBriefSection({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { data, loading, reload } = useMorningBrief(slug)
  const contacts = useContacts(slug)
  const pieces = useContentPieces(slug)
  const [generatedAt, setGeneratedAt] = useState(() => new Date())

  const onRefresh = useCallback(() => {
    setGeneratedAt(new Date())
    reload()
    void contacts.reload()
    void pieces.reload()
  }, [contacts, pieces, reload])

  const pipelineBars = useMemo(() => {
    const counts: Record<PipelineStage, number> = {
      first_contact: 0,
      conversation: 0,
      follow_up: 0,
      proposal: 0,
      deal: 0,
      paused: 0,
    }
    for (const c of contacts.items) {
      counts[c.pipeline_stage] += 1
    }
    const max = Math.max(1, ...Object.values(counts))
    return STAGE_ORDER.map((stage) => ({
      stage,
      label: STAGE_LABEL[stage],
      count: counts[stage],
      widthPct: Math.round((counts[stage] / max) * 100),
    }))
  }, [contacts.items])

  const todayDay = todayIsoDay()
  const liveToday = useMemo(() => {
    return pieces.items.filter((p) => {
      const pub = p.published_at?.trim()
      if (pub && scheduledIsoDay(pub) === todayDay) return true
      const sched = p.scheduled_at?.trim()
      if (!p.published_at && sched && scheduledIsoDay(sched) === todayDay) return true
      return false
    })
  }, [pieces.items, todayDay])

  const startToday = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-2 mb-8 rounded-2xl p-5"
      style={{
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
      }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--mode-intelligence)' }}
          >
            Morning Brief
          </div>
          <h3 className="font-display mt-1" style={{ fontSize: 18, fontWeight: 600 }}>
            Operations — Live
          </h3>
        </div>
        <button
          type="button"
          className="font-mono"
          onClick={() => onRefresh()}
          style={{
            fontSize: 10,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-3)',
            color: 'var(--text-secondary)',
          }}
        >
          Aktualisieren
        </button>
      </div>

      {loading || !data ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Lade Daten…
        </p>
      ) : (
        <>
          <div
            className="mb-6 grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <div>
              <div
                className="font-mono mb-2"
                style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
              >
                HEUTE
              </div>
              <div className="flex flex-col gap-2">
                {[...data.overdueFollowUps, ...data.todayFollowUps].slice(0, 10).map((c) => {
                  const dueMs = c.next_follow_up_at
                    ? new Date(c.next_follow_up_at).getTime()
                    : 0
                  const overdue = Number.isFinite(dueMs) && dueMs < startToday
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="text-left font-mono"
                      onClick={() => navigate(`/brand/${slug}/sales/${c.id}`)}
                      style={{
                        fontSize: 11,
                        padding: '8px 10px',
                        borderRadius: 10,
                        border: `1px solid ${overdue ? 'var(--accent-coral)' : 'var(--glass-border-2)'}`,
                        background: 'var(--glass-1)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      {c.name || c.email || 'Kontakt'}{' '}
                      <span style={{ color: 'var(--text-tertiary)' }}>
                        · {overdue ? 'überfällig' : 'heute'} · {STAGE_LABEL[c.pipeline_stage]}
                      </span>
                    </button>
                  )
                })}
                {data.overdueFollowUps.length === 0 && data.todayFollowUps.length === 0 ? (
                  <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Keine Follow-ups für heute.
                  </div>
                ) : null}
              </div>
              <div
                className="font-mono mt-3"
                style={{ fontSize: 10, color: 'var(--text-secondary)' }}
              >
                Content heute:{' '}
                {liveToday.length === 0 ? (
                  <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                ) : (
                  liveToday.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="mr-2 underline-offset-2 hover:underline"
                      style={{
                        color: 'var(--accent-teal)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      onClick={() => navigate(`/brand/${slug}/promo`)}
                    >
                      {p.title || 'Piece'}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <div
                className="font-mono mb-2"
                style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
              >
                PIPELINE
              </div>
              <div className="flex flex-col gap-2">
                {pipelineBars.map((row) => (
                  <div key={row.stage}>
                    <div
                      className="font-mono mb-0.5 flex justify-between"
                      style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                    >
                      <span>{row.label}</span>
                      <span>{row.count}</span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: 'var(--glass-2)',
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border-2)',
                      }}
                    >
                      <div
                        style={{
                          width: `${row.widthPct}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: 'color-mix(in srgb, var(--mode-intelligence) 55%, var(--glass-3))',
                          transition: 'width 0.35s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="font-mono mt-3"
                onClick={() => navigate(`/brand/${slug}/sales`)}
                style={{
                  fontSize: 10,
                  border: 'none',
                  background: 'none',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Zur Pipeline →
              </button>
            </div>

            <div>
              <div
                className="font-mono mb-2"
                style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
              >
                EMPFEHLUNG
              </div>
              <p
                className="font-display"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {data.recommendation}
              </p>
              <div
                className="font-mono mt-3 grid gap-1"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                <span>Foundation {data.foundationHealth}%</span>
                <span>Signale (7 Tage): {data.discoverySignalsNew}</span>
                <span>Content live (7 Tage): {data.contentPiecesLive}</span>
                <span>Pipeline-Updates (Woche): {data.pipelineUpdates}</span>
                <span>Aktive Projekte: {data.activeProjects}</span>
              </div>
            </div>
          </div>

          <div
            className="font-mono mt-2 border-t border-[var(--glass-border-1)] pt-3"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Aktualisiert um{' '}
            {generatedAt.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </>
      )}
    </motion.section>
  )
}
