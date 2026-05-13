import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { BrandPresenceShowcase } from '../components/BrandPresenceShowcase'
import { GoalsCard } from '../components/dashboard/GoalsCard'
import { TasksSection } from '../components/dashboard/TasksSection'
import { TodaySection } from '../components/dashboard/TodaySection'
import { EmptyState } from '../components/EmptyState'
import {
  contactsDueToday,
  deliverStageProgress,
  stageHistogram,
  useBrandDashboardData,
  useMemoizedNextAndLastPieces,
} from '../hooks/useBrandDashboard'
import { useBrands } from '../hooks/useBrands'
import type { DeliverProject, PipelineStage } from '../types/db'

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

const STAGE_ORDER: PipelineStage[] = [
  'first_contact',
  'conversation',
  'proposal',
  'deal',
  'paused',
]

function fmt(n: number | null): string {
  if (n === null) return '—'
  return String(n)
}

function FlowStation({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      className="flex min-w-[100px] flex-1 flex-col items-center text-center"
      style={{ padding: '12px 8px' }}
    >
      <div
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
      >
        {label}
      </div>
      <div
        className="font-display mt-1"
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textShadow: `0 0 28px color-mix(in srgb, var(${accent}) 35%, transparent)`,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Chevron() {
  return (
    <span className="font-mono hidden shrink-0 sm:block" style={{ color: 'var(--text-tertiary)', opacity: 0.25 }}>
      →
    </span>
  )
}

export function BrandDashboardPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug)
  const presenceAccent =
    brand?.color?.trim() && !brand.color.startsWith('var(')
      ? brand.color
      : 'var(--accent-teal)'

  const dash = useBrandDashboardData(slug)
  const { nextPlanned, lastPublished } = useMemoizedNextAndLastPieces(dash.contentPieces)
  const due = contactsDueToday(dash.contacts)
  const hist = stageHistogram(dash.contacts)
  const activeDeliver = dash.deliverProjects.filter((p) => p.status === 'active').slice(0, 4)

  const m = dash.metrics

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      {/* HERO — Mein Tag heute */}
      {slug ? (
        <div style={{ paddingBottom: 4 }}>
          <TodaySection slug={slug} contacts={dash.contacts} loading={dash.loading} />
        </div>
      ) : null}

      {slug ? (
        <div className="mb-10 grid gap-4 lg:grid-cols-2">
          <TasksSection slug={slug} />
          <GoalsCard slug={slug} />
        </div>
      ) : null}

      {/* Trennlinie zwischen Hero-Bereich und Übersicht — dezent */}
      <div
        style={{
          margin: '4px 0 24px',
          height: 1,
          background:
            'linear-gradient(90deg, transparent, var(--glass-border-1), transparent)',
        }}
      />

      <div
        className="font-mono"
        style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
      >
        System Overview
      </div>
      <h2
        className="font-display mb-6 mt-1"
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: '-0.2px',
        }}
      >
        Brand als zusammenhängender Flow
      </h2>

      {slug ? (
        <BrandPresenceShowcase
          slug={slug}
          brandName={brand?.name ?? slug}
          accent={presenceAccent}
        />
      ) : null}

      {dash.error ? (
        <div className="mb-4 font-mono text-sm" style={{ color: 'var(--accent-coral)' }}>
          {dash.error}
        </div>
      ) : null}

      <section
        className="mb-6 rounded-2xl"
        style={{
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
          padding: '20px 16px',
        }}
      >
        <div className="font-mono mb-4" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          DISCOVERY → PROMO → SALES → DELIVER
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FlowStation
            label="Discovery"
            value={fmt(m.discoveryWeek)}
            accent="--accent-coral"
          />
          <Chevron />
          <FlowStation label="Promo" value={fmt(m.promoUpcoming)} accent="--mode-promo" />
          <Chevron />
          <FlowStation label="Sales" value={fmt(m.pipeline)} accent="--mode-sales" />
          <Chevron />
          <FlowStation label="Deliver" value={fmt(m.deliverActive)} accent="--accent-teal" />
        </div>
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
              Pipeline
            </h3>
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 10,
                color: 'var(--mode-sales)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/brand/${slug}/sales`)}
            >
              Öffnen →
            </button>
          </div>
          <div className="mb-3 font-body" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Heute fällig:{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {dash.loading ? '…' : due.length}
            </span>
            {due[0] ? (
              <span className="block truncate opacity-70">{due[0].name}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {STAGE_ORDER.filter((s) => s !== 'paused').map((st) => {
              const n = hist[st] ?? 0
              return (
                <div
                  key={st}
                  className="rounded-lg px-2.5 py-1.5"
                  style={{
                    background: 'var(--glass-2)',
                    border: '1px solid var(--glass-border-1)',
                  }}
                >
                  <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                    {STAGE_LABEL[st]}
                  </div>
                  <div className="font-display" style={{ fontSize: 18 }}>
                    {n}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section
          className="rounded-2xl p-5"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
              Promo
            </h3>
            <button
              type="button"
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--mode-promo)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => navigate(`/brand/${slug}/promo`)}
            >
              Kalender →
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                Nächstes Piece
              </div>
              <div className="font-body mt-1" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {nextPlanned?.title ?? '—'}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {nextPlanned ? nextPlanned.scheduled_at : ''}
              </div>
            </div>
            <div>
              <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                Zuletzt live
              </div>
              <div className="font-body mt-1" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {lastPublished?.title ?? '—'}
              </div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {lastPublished?.published_at
                  ? new Date(lastPublished.published_at).toLocaleString('de-DE', {
                      dateStyle: 'short',
                    })
                  : ''}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-2xl p-5"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
              Deliver
            </h3>
            <button
              type="button"
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--accent-teal)', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => navigate(`/brand/${slug}/deliver`)}
            >
              Projekte →
            </button>
          </div>
          {activeDeliver.length === 0 ? (
            <EmptyState
              compact
              title="Noch kein Projekt aktiv."
              description="Kommt automatisch, wenn du einen Deal abschließt."
              accent="var(--accent-teal)"
            />
          ) : (
            <ul className="list-none space-y-3 p-0">
              {activeDeliver.map((p: DeliverProject) => {
                const pct = deliverStageProgress(p.internal_stage)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full text-left"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/brand/${slug}/deliver/${p.id}`)}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-body" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                          {p.name || p.client_name || 'Projekt'}
                        </span>
                        <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {pct}%
                        </span>
                      </div>
                      <div
                        className="mt-1 h-1.5 overflow-hidden rounded-full"
                        style={{ background: 'var(--glass-2)' }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, var(--accent-teal), var(--mode-promo))',
                          }}
                        />
                      </div>
                      <div className="font-mono mt-1" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                        {p.internal_stage.replace(/_/g, ' ')}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section
          className="rounded-2xl p-5"
          style={{
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
              Discovery (7 Tage)
            </h3>
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 10,
                color: 'var(--accent-coral)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/brand/${slug}/foundation`)}
            >
              Feed →
            </button>
          </div>
          {dash.feedItems.length === 0 ? (
            <EmptyState
              compact
              title="Noch keine Signale."
              description="Brand OS analysiert Markt und Wettbewerb für dich."
              actionLabel="Analyse starten"
              onAction={() => navigate(`/brand/${slug}/foundation`)}
              accent="var(--accent-coral)"
            />
          ) : (
            <ul className="list-none space-y-2 p-0">
              {dash.feedItems.slice(0, 5).map((it) => (
                <li key={it.id} className="font-body" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--text-primary)' }}>{it.title}</span>
                  <span className="font-mono ml-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {new Date(it.recorded_at).toLocaleDateString('de-DE')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        className="rounded-2xl p-5"
        style={{
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <div className="font-mono mb-3" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          QUICK ACTIONS
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl font-mono"
            style={{
              fontSize: 11,
              padding: '10px 16px',
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/brand/${slug}/sales`)}
          >
            Neuer Kontakt
          </button>
          <button
            type="button"
            className="rounded-xl font-mono"
            style={{
              fontSize: 11,
              padding: '10px 16px',
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/brand/${slug}/promo`)}
          >
            Neues Piece
          </button>
          <button
            type="button"
            className="rounded-xl font-mono"
            style={{
              fontSize: 11,
              padding: '10px 16px',
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/brand/${slug}/foundation`)}
          >
            Discovery starten
          </button>
        </div>
      </section>
    </motion.div>
  )
}
