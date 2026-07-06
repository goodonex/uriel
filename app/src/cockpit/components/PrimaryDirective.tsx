import { MONTH_TARGETS, currentSoll, formatEuro } from '../lib/goals'

/** Kumulierter Monatsumsatz groß + aktuelles Wochen-Soll (REBUILD-PLAN §5.1). */
export function PrimaryDirective({ monthRevenue }: { monthRevenue: number }) {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = MONTH_TARGETS[monthKey]

  const soll = month ? currentSoll(month.curve, now) : 0
  const total = month?.total ?? 0
  const onTrack = monthRevenue >= soll

  return (
    <section
      className="ck-panel"
      aria-label="Monatsziel"
      style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 18px', gap: 16 }}
    >
      <div>
        <div className="ck-label">Primary Directive · {month?.label ?? 'Monat'}</div>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
          {formatEuro(monthRevenue)}
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ck-text-3)' }}>
            {' '}/ {formatEuro(total)}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="ck-label">Soll bis heute</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: onTrack ? 'var(--ck-accent)' : 'var(--ck-warn)' }}>
          {formatEuro(soll)}
        </div>
        <div className="ck-label" style={{ marginTop: 2 }}>
          {onTrack ? 'on track' : 'Input prüfen — Ernte folgt dem Lag'}
        </div>
      </div>
    </section>
  )
}
