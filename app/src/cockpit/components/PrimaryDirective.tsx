import { currentSoll, formatEuro, monthTargetFor } from '../lib/goals'

/** Kumulierter Monatsumsatz groß + aktuelles Wochen-Soll (REBUILD-PLAN §5.1). */
export function PrimaryDirective({ monthRevenue }: { monthRevenue: number }) {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = monthTargetFor(monthKey)

  const soll = month ? currentSoll(month.curve, now) : 0
  const total = month?.total ?? 0
  const onTrack = monthRevenue >= soll

  const pct = total > 0 ? Math.min(1, monthRevenue / total) : 0

  return (
    <section className="ck-panel" aria-label="Monatsziel" style={{ padding: '12px 14px' }}>
      <div className="ck-label">
        Primary Directive · {month?.label ?? 'Monat'}
        {month?.generated ? <span style={{ color: 'var(--ck-text-3)' }}> · Ziel geplant</span> : null}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.25 }}>
        {formatEuro(monthRevenue)}
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ck-text-3)' }}>
          {' '}/ {formatEuro(total)}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--ck-border)', borderRadius: 2, overflow: 'hidden', margin: '8px 0 6px' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: onTrack ? 'var(--ck-accent)' : 'var(--ck-idle)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span className="ck-label">Soll bis heute</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: onTrack ? 'var(--ck-accent)' : 'var(--ck-warn)' }}>
          {formatEuro(soll)}
        </span>
      </div>
      <div className="ck-label" style={{ marginTop: 2 }}>
        {onTrack ? 'on track' : 'Input prüfen — Ernte folgt dem Lag'}
      </div>
    </section>
  )
}
