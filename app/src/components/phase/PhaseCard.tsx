import { useState, type ReactNode } from 'react'
import {
  getPhaseState,
  phaseDeliverableProgress,
  phaseDurationLabel,
  previousPhaseLabel,
  PHASE_LABELS,
  type PhaseKey,
} from '../../lib/phaseMapping'
import type { DeliverableItem, DeliverProjectStage, DeliverStageDurations } from '../../types/db'
import { DELIVERABLE_STATUS_LABEL } from '../../types/db'

interface PhaseCardProps {
  phase: PhaseKey
  currentStage: DeliverProjectStage
  deliverables: DeliverableItem[]
  stageDurations?: DeliverStageDurations | null
  accentColor?: string
  leadCount?: number
  children?: ReactNode
  footer?: ReactNode
  readOnlyDeliverables?: boolean
}

export function PhaseCard({
  phase,
  currentStage,
  deliverables,
  stageDurations,
  accentColor = 'var(--accent-teal)',
  leadCount = 0,
  children,
  footer,
  readOnlyDeliverables = false,
}: PhaseCardProps) {
  const state = getPhaseState(phase, currentStage)
  const [expanded, setExpanded] = useState(state === 'active')
  const label = PHASE_LABELS[phase]
  const prevLabel = previousPhaseLabel(phase)
  const duration = phaseDurationLabel(phase, stageDurations)
  const progress = phaseDeliverableProgress(deliverables, phase)

  const isOpen = state === 'active' || (state === 'completed' && expanded)

  const cardStyle: React.CSSProperties =
    state === 'completed'
      ? {
          opacity: 0.72,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-2)',
        }
      : state === 'active'
        ? {
            background: 'var(--glass-3)',
            border: `2px solid color-mix(in srgb, ${accentColor} 55%, transparent)`,
            boxShadow: `0 0 0 1px color-mix(in srgb, ${accentColor} 12%, transparent)`,
          }
        : {
            opacity: 0.45,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-2)',
            pointerEvents: 'none' as const,
          }

  return (
    <article
      className="phase-card"
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'opacity 0.2s, border-color 0.2s',
        ...cardStyle,
      }}
    >
      <header
        className="flex items-start gap-3"
        style={{ padding: state === 'active' ? '18px 20px' : '14px 18px' }}
      >
        <PhaseIcon state={state} accentColor={accentColor} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="font-display"
              style={{
                fontSize: state === 'active' ? 18 : 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {label}
            </h2>
            {state === 'active' && progress.total > 0 ? (
              <span
                className="font-mono"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                {progress.ready} von {progress.total} fertig
              </span>
            ) : null}
            {state === 'locked' && duration ? (
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                ca. {duration}
              </span>
            ) : null}
          </div>

          {state === 'locked' && prevLabel ? (
            <p className="font-mono mt-1" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Startet nach {prevLabel}
            </p>
          ) : null}

          {state === 'completed' ? (
            <button
              type="button"
              className="font-mono mt-1"
              style={{
                fontSize: 11,
                color: accentColor,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Weniger anzeigen' : 'Details ansehen'}
            </button>
          ) : null}

          {phase === 'scaling' && state === 'active' && leadCount > 0 ? (
            <p className="font-mono mt-1" style={{ fontSize: 11, color: accentColor }}>
              {leadCount} Leads warten auf Sie
            </p>
          ) : null}
        </div>
      </header>

      {state === 'completed' && !expanded ? (
        <CompletedSummary
          phase={phase}
          deliverables={deliverables}
          leadCount={leadCount}
          readOnly={readOnlyDeliverables}
        />
      ) : null}

      {isOpen ? (
        <div style={{ padding: '0 20px 20px' }}>
          {state === 'completed' && expanded ? (
            <CompletedDeliverablesList deliverables={deliverables} phase={phase} />
          ) : null}
          {state === 'active' ? children : null}
          {footer}
        </div>
      ) : null}
    </article>
  )
}

function PhaseIcon({ state, accentColor }: { state: string; accentColor: string }) {
  if (state === 'completed') {
    return (
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--glass-2)',
          color: 'var(--text-secondary)',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        ✓
      </span>
    )
  }
  if (state === 'locked') {
    return (
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--glass-2)',
          color: 'var(--text-tertiary)',
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        🔒
      </span>
    )
  }
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: `color-mix(in srgb, ${accentColor} 18%, var(--glass-2))`,
        color: accentColor,
        fontSize: 14,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      ●
    </span>
  )
}

function CompletedSummary({
  phase,
  deliverables,
  leadCount,
  readOnly,
}: {
  phase: PhaseKey
  deliverables: DeliverableItem[]
  leadCount: number
  readOnly: boolean
}) {
  if (phase === 'scaling' || phase === 'leadgen') {
    if (leadCount <= 0) return null
    return (
      <div className="font-mono px-[18px] pb-3" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {leadCount} Leads generiert
      </div>
    )
  }
  const progress = phaseDeliverableProgress(deliverables, phase)
  if (progress.total === 0) return null
  return (
    <div className="font-mono px-[18px] pb-3" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
      {progress.ready}/{progress.total} Deliverables
      {readOnly ? '' : ' abgeschlossen'}
    </div>
  )
}

function CompletedDeliverablesList({
  deliverables,
  phase,
}: {
  deliverables: DeliverableItem[]
  phase: PhaseKey
}) {
  const progress = phaseDeliverableProgress(deliverables, phase)
  if (progress.total === 0) return null

  const area = phase === 'branding' ? 'branding' : 'website'
  const items = deliverables.filter((d) => d.area === area || (!d.area && phase === 'branding'))

  return (
    <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
          style={{ background: 'var(--glass-1)', border: '1px solid var(--glass-border-2)' }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.title}</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {DELIVERABLE_STATUS_LABEL[item.status]}
          </span>
          {item.status === 'fertig' && item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--accent-teal)' }}
            >
              Öffnen →
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
