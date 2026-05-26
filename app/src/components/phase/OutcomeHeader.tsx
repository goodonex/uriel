import { formatProjectRevenue } from '../../lib/projectOutcomes'
import type { ProjectOutcomes } from '../../lib/projectOutcomes'

interface OutcomeHeaderProps {
  outcomes: ProjectOutcomes
  projectName?: string
  startedAt?: string | null
  loading?: boolean
  accentColor?: string
}

export function OutcomeHeader({
  outcomes,
  projectName,
  startedAt,
  loading = false,
  accentColor = 'var(--accent-teal)',
}: OutcomeHeaderProps) {
  const startedLabel =
    startedAt &&
    (() => {
      try {
        return new Date(startedAt).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      } catch {
        return null
      }
    })()

  return (
    <section
      className="phase-outcome-header"
      style={{
        borderRadius: 16,
        border: `1px solid color-mix(in srgb, ${accentColor} 25%, var(--glass-border-1))`,
        background: 'var(--glass-2)',
        padding: '20px 24px',
        marginBottom: 20,
      }}
    >
      {projectName || startedLabel ? (
        <div
          className="font-mono mb-3 flex flex-wrap items-center gap-3"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          {projectName ? <span>{projectName}</span> : null}
          {startedLabel ? <span>Gestartet: {startedLabel}</span> : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <OutcomeMetric
          label="Generierte Leads"
          value={loading ? '…' : String(outcomes.totalLeads)}
          hint="wird befüllt ab Execute"
          accentColor={accentColor}
        />
        <OutcomeMetric
          label="Hochgerechneter Umsatz"
          value={loading ? '…' : formatProjectRevenue(outcomes.projectedRevenue)}
          hint="wird befüllt ab Execute"
          accentColor={accentColor}
        />
      </div>
    </section>
  )
}

function OutcomeMetric({
  label,
  value,
  hint,
  accentColor,
}: {
  label: string
  value: string
  hint: string
  accentColor: string
}) {
  return (
    <div>
      <div
        className="font-mono uppercase tracking-wider"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
      >
        {label}
      </div>
      <div
        className="font-display mt-1"
        style={{
          fontSize: 32,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div className="font-mono mt-1" style={{ fontSize: 10, color: accentColor, opacity: 0.75 }}>
        ({hint})
      </div>
    </div>
  )
}
