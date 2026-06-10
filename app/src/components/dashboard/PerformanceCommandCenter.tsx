import { memo, useCallback } from 'react'
import { usePerformanceCommandCenter } from '../../hooks/usePerformanceCommandCenter'
import { useBrandId } from '../../hooks/useBrandId'
import { logActivity } from '../../lib/activityLog'
import { useToast } from '../Toast'

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

interface MetricTileProps {
  label: string
  value: number
  target?: number
  accent: string
  compact?: boolean
  onTally?: () => void
}

const MetricTile = memo(function MetricTile({
  label,
  value,
  target = 0,
  accent,
  compact,
  onTally,
}: MetricTileProps) {
  const hasTarget = target > 0
  const pct = hasTarget ? Math.min(100, Math.round((value / target) * 100)) : 0
  const done = hasTarget && value >= target

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        background: done
          ? `color-mix(in srgb, ${accent} 12%, var(--glass-1))`
          : 'var(--glass-1)',
        border: `1px solid ${done ? `color-mix(in srgb, ${accent} 35%, var(--glass-border-1))` : 'var(--glass-border-1)'}`,
        padding: compact ? '10px 8px 8px' : '12px 10px 10px',
        minHeight: compact ? 72 : 84,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: accent,
          opacity: done ? 1 : 0.75,
        }}
      />
      <div className="flex items-start justify-between gap-1" style={{ paddingLeft: 4 }}>
        <div>
          <div
            className="font-display tabular-nums"
            style={{
              fontSize: compact ? 22 : 26,
              fontWeight: 600,
              lineHeight: 1,
              color: 'var(--text-primary)',
            }}
          >
            {value}
            {hasTarget ? (
              <span
                className="font-mono"
                style={{
                  fontSize: compact ? 11 : 12,
                  fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  marginLeft: 2,
                }}
              >
                /{target}
              </span>
            ) : null}
          </div>
          <div
            className="font-mono"
            style={{
              marginTop: 4,
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
            }}
          >
            {label}
          </div>
        </div>
        {onTally ? (
          <button
            type="button"
            onClick={onTally}
            title={`+1 ${label}`}
            className="font-mono shrink-0"
            style={{
              fontSize: 9,
              width: 22,
              height: 22,
              borderRadius: 999,
              border: `1px solid color-mix(in srgb, ${accent} 45%, var(--glass-border-2))`,
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
              color: accent,
              cursor: 'pointer',
            }}
          >
            +
          </button>
        ) : null}
      </div>
      {hasTarget ? (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full"
          style={{ background: 'var(--glass-2)', marginLeft: 4 }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: accent,
              borderRadius: 999,
              transition: 'width 0.35s ease',
            }}
          />
        </div>
      ) : null}
    </div>
  )
})

function FunnelStep({
  value,
  label,
  accent,
  compact,
}: {
  value: number
  label: string
  accent: string
  compact?: boolean
}) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5">
      <span
        className="font-display tabular-nums"
        style={{ fontSize: compact ? 15 : 17, fontWeight: 600, color: accent }}
      >
        {value}
      </span>
      <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
        {label}
      </span>
    </span>
  )
}

interface PerformanceCommandCenterProps {
  slug: string
  compact?: boolean
  onOpenSettings?: () => void
  onOpenReview?: () => void
}

export const PerformanceCommandCenter = memo(function PerformanceCommandCenter({
  slug,
  compact = false,
  onOpenSettings,
  onOpenReview,
}: PerformanceCommandCenterProps) {
  const { counts, targets, week, nordstern, weekLoading, reloadActivity } =
    usePerformanceCommandCenter(slug)
  const brandId = useBrandId(slug)
  const { show } = useToast()

  const tally = useCallback(
    (action: 'linkedin_sent' | 'pitch_sent' | 'loom_created', label: string) => {
      if (!brandId) {
        show('Bitte erst Brand auswählen', 'info')
        return
      }
      logActivity({
        brand_id: brandId,
        entity_type: 'contact',
        action,
        summary: `${label} +1`,
      })
      void reloadActivity()
      show(`${label} +1`, 'success')
    },
    [brandId, reloadActivity, show],
  )

  const targetsHit =
    counts.dialAttempts >= targets.dialAttempts &&
    counts.linkedin >= targets.linkedin &&
    counts.pitches >= targets.pitches

  return (
    <section
      id="daily-scorecard"
      className="rounded-2xl"
      style={{
        background:
          'linear-gradient(155deg, color-mix(in srgb, var(--bg-base) 94%, transparent), color-mix(in srgb, var(--bg-surface) 96%, transparent))',
        border: '1px solid color-mix(in srgb, var(--mode-sales) 18%, var(--glass-border-1))',
        backdropFilter: 'var(--blur-lg)',
        WebkitBackdropFilter: 'var(--blur-lg)',
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.48)',
      }}
    >
      <div
        style={{
          padding: compact ? '10px 12px' : '12px 16px',
          borderBottom: '1px solid var(--glass-border-1)',
          background: `linear-gradient(90deg, color-mix(in srgb, ${nordstern.accent} 8%, var(--bg-surface)), transparent)`,
        }}
      >
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
          style={{ justifyContent: 'space-between' }}
        >
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="font-mono shrink-0"
              style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
            >
              NORDSTERN
            </span>
            <span
              className="font-display tabular-nums"
              style={{ fontSize: compact ? 16 : 18, fontWeight: 600 }}
            >
              {fmtEuro(nordstern.mrr)}
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {' '}
                / {fmtEuro(nordstern.target)}
              </span>
            </span>
            {nordstern.hireReached ? (
              <span
                className="font-mono shrink-0 rounded-full px-2 py-0.5"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  color: nordstern.accent,
                  border: `1px solid color-mix(in srgb, ${nordstern.accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${nordstern.accent} 12%, transparent)`,
                }}
              >
                Hire-Trigger
              </span>
            ) : null}
          </div>
          <div
            className="flex min-w-[120px] flex-1 items-center gap-2"
            style={{ maxWidth: compact ? 140 : 220 }}
          >
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--glass-2)' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${nordstern.pct}%`,
                  background: nordstern.accent,
                  borderRadius: 999,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            <span
              className="font-mono shrink-0 tabular-nums"
              style={{ fontSize: 10, color: 'var(--text-secondary)' }}
            >
              {nordstern.pct}%
            </span>
          </div>
          {!compact ? (
            <span className="font-mono shrink-0" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {nordstern.days > 0 ? `${nordstern.days}T → Nov` : 'Deadline'}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ padding: compact ? '10px 12px 12px' : '14px 16px 16px' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className="font-mono"
              style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
            >
              HEUTE
            </span>
            {targetsHit ? (
              <span
                className="font-mono rounded-full px-2 py-0.5"
                style={{
                  fontSize: 9,
                  color: 'var(--accent-success, var(--accent-teal))',
                  border: '1px solid color-mix(in srgb, var(--accent-teal) 35%, transparent)',
                }}
              >
                Ziele erreicht
              </span>
            ) : null}
          </div>
          <div className="flex gap-1.5">
            {onOpenSettings ? <HeaderBtn label="Ziele" onClick={onOpenSettings} /> : null}
            {onOpenReview ? (
              <HeaderBtn label="Review" onClick={onOpenReview} accent="var(--mode-sales)" />
            ) : null}
          </div>
        </div>

        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
          }}
        >
          <MetricTile compact={compact} label="Anrufe" value={counts.dialAttempts} target={targets.dialAttempts} accent="var(--mode-sales)" />
          <MetricTile compact={compact} label="Gespräche" value={counts.conversations} accent="var(--accent-teal)" />
          <MetricTile compact={compact} label="LinkedIn" value={counts.linkedin} target={targets.linkedin} accent="#0A66C2" onTally={() => tally('linkedin_sent', 'LinkedIn')} />
          <MetricTile compact={compact} label="Pitches" value={counts.pitches} target={targets.pitches} accent="var(--accent-blue)" onTally={() => tally('pitch_sent', 'Pitch')} />
          <MetricTile compact={compact} label="Termine" value={counts.meetingsOrDeals} accent="var(--accent-success, #4ade80)" />
          <MetricTile compact={compact} label="Loom" value={counts.loomVideos} accent="var(--accent-purple, #8b5cf6)" onTally={() => tally('loom_created', 'Loom')} />
        </div>
      </div>

      {!compact ? (
        <div
          style={{
            padding: '10px 16px 12px',
            borderTop: '1px solid var(--glass-border-1)',
            background: 'color-mix(in srgb, var(--glass-1) 80%, transparent)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className="font-mono shrink-0"
                style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
              >
                WOCHE
              </span>
              {weekLoading ? (
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  …
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <FunnelStep compact={compact} value={week.conversations} label="Gespr." accent="var(--accent-teal)" />
                  <Arrow />
                  <FunnelStep compact={compact} value={week.pitches} label="Pitch" accent="var(--accent-blue)" />
                  <Arrow />
                  <FunnelStep compact={compact} value={week.deals} label="Deal" accent="var(--accent-success, #4ade80)" />
                  <span style={{ color: 'var(--glass-border-2)', margin: '0 2px' }}>·</span>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    {fmtEuro(week.projectRevenue)} · {fmtEuro(week.newMrr)} MRR
                  </span>
                  <span style={{ color: 'var(--glass-border-2)' }}>·</span>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    YT {week.youtubePublished ? '✓' : '—'} · LI {week.linkedinPosts}
                  </span>
                  {week.badLeads > 0 || week.churnWarnings > 0 ? (
                    <>
                      <span style={{ color: 'var(--glass-border-2)' }}>·</span>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--accent-coral)' }}>
                        {week.churnWarnings > 0 ? `${week.churnWarnings} Churn` : `${week.badLeads} bad leads`}
                      </span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            {onOpenReview ? (
              <HeaderBtn label="Review →" onClick={onOpenReview} accent="var(--mode-sales)" />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
})

function Arrow() {
  return (
    <span className="font-mono select-none" style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.45 }}>
      →
    </span>
  )
}

function HeaderBtn({
  label,
  onClick,
  accent = 'var(--text-tertiary)',
}: {
  label: string
  onClick: () => void
  accent?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono"
      style={{
        fontSize: 9,
        letterSpacing: '0.08em',
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid var(--glass-border-2)',
        background: 'var(--glass-1)',
        color: accent,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
