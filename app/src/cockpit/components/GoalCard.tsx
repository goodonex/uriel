import { useMemo } from 'react'
import { computeMrrMetrics } from '../../lib/performanceMetrics'
import type { Contact } from '../../types/db'
import { LIFE_TARGET, currentSoll, formatEuro, monthTargetFor } from '../lib/goals'
import type { DailyMetricsRow } from '../lib/useDailyMetrics'
import { MonthCurve } from './MonthCurve'

/**
 * Ziel-Karte (Dashboard-Vereinfachung Juli 2026): fasst Primary Directive,
 * Monatskurve und Nordstern in EINER Karte zusammen — dieselbe Datenfamilie
 * (Geld vs. Ziel) gehört an einen Ort. Aufbau: Monatsumsatz groß, Soll-Zeile,
 * kompakte Kurve, Nordstern als eine Fußzeile (MRR + Retainer aus dem CRM).
 */
export function GoalCard({
  monthRevenue,
  monthRows,
  contacts,
}: {
  monthRevenue: number
  monthRows: DailyMetricsRow[]
  contacts: Contact[]
}) {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = monthTargetFor(monthKey)

  const soll = month ? currentSoll(month.curve, now) : 0
  const total = month?.total ?? 0
  const onTrack = monthRevenue >= soll
  const pct = total > 0 ? Math.min(1, monthRevenue / total) : 0

  const { activeRetainers, currentMrr } = useMemo(
    () => computeMrrMetrics(contacts),
    [contacts],
  )
  // Solange potenzial_betrag ungepflegt ist, MRR über die Kundenzahl schätzen
  // (gleiches Fallback wie die alte Nordstern-Karte).
  const mrr = currentMrr > 0 ? currentMrr : activeRetainers * LIFE_TARGET.mrrProKunde
  const reached = activeRetainers >= LIFE_TARGET.retainerKundenZiel

  return (
    <section className="ck-panel" aria-label="Monatsziel und Nordstern">
      <div style={{ padding: '12px 14px' }}>
        <div className="ck-label">
          Monatsziel · {month?.label ?? 'Monat'}
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
      </div>

      <div style={{ borderTop: '1px solid var(--ck-border)', padding: '6px 2px 0' }}>
        <MonthCurve monthRows={monthRows} />
      </div>

      {/* Nordstern als eine Zeile — Langfrist-Kontext, kein eigenes Panel mehr. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          padding: '8px 14px 10px',
          borderTop: '1px solid var(--ck-border)',
        }}
      >
        <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>☾ Nordstern</span>
        <span style={{ fontSize: 12, color: reached ? 'var(--ck-accent)' : 'var(--ck-text-2)' }}>
          {reached
            ? '✓ Freundin kann aufhören'
            : `${formatEuro(mrr)} / ${formatEuro(LIFE_TARGET.mrrMeilenstein)} MRR · ${activeRetainers} / ${LIFE_TARGET.retainerKundenZiel} Retainer`}
        </span>
      </div>
    </section>
  )
}
