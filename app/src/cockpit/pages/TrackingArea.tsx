import { useMemo, useState } from 'react'
import { MonthCurve } from '../components/MonthCurve'
import { VitalsPanel } from '../components/VitalsPanel'
import { channelRates, weekVitals } from '../lib/metricsAggregate'
import type { MetricField } from '../lib/useDailyMetrics'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { formatEuro } from '../lib/goals'

/** Eingabefelder in Zähl-Reihenfolge (REBUILD-PLAN §9). */
const INPUT_FIELDS: Array<{ field: MetricField; label: string; group: 'input' | 'ergebnis' }> = [
  { field: 'li_anfragen', label: 'LinkedIn', group: 'input' },
  { field: 'inmails', label: 'InMail', group: 'input' },
  { field: 'ig_anfragen', label: 'Instagram', group: 'input' },
  { field: 'coldmails', label: 'Cold-Mail', group: 'input' },
  { field: 'followups', label: 'Follow-ups', group: 'input' },
  { field: 'looms', label: 'Looms', group: 'input' },
  { field: 'antworten_li', label: 'Antw. LinkedIn', group: 'ergebnis' },
  { field: 'antworten_inmail', label: 'Antw. InMail', group: 'ergebnis' },
  { field: 'antworten_ig', label: 'Antw. Instagram', group: 'ergebnis' },
  { field: 'antworten_cold', label: 'Antw. Cold-Mail', group: 'ergebnis' },
  { field: 'quali_termine', label: 'Quali-Termine', group: 'ergebnis' },
  { field: 'sales_calls', label: 'Sales-Calls', group: 'ergebnis' },
  { field: 'abschluesse', label: 'Abschlüsse', group: 'ergebnis' },
]

function Stepper({
  label,
  value,
  onBump,
}: {
  label: string
  value: number
  onBump: (delta: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '7px 10px',
        border: '1px solid var(--ck-border)',
        borderRadius: 6,
      }}
    >
      <span className="ck-label" style={{ fontSize: 10.5 }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <button className="ck-btn" style={{ padding: '2px 9px' }} onClick={() => onBump(-1)} aria-label={`${label} minus 1`}>
          −
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 26, textAlign: 'center' }}>{value}</span>
        <button className="ck-btn" style={{ padding: '2px 9px' }} onClick={() => onBump(1)} aria-label={`${label} plus 1`}>
          +
        </button>
      </span>
    </div>
  )
}

function UmsatzInput({ value, onSet }: { value: number; onSet: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '7px 10px',
        border: '1px solid var(--ck-border-strong)',
        borderRadius: 6,
      }}
    >
      <span className="ck-label" style={{ fontSize: 10.5 }}>Umsatz heute (€)</span>
      <input
        className="ck-input"
        type="number"
        min={0}
        step={100}
        style={{ width: 110, textAlign: 'right' }}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft != null) {
            const v = Number(draft)
            if (!Number.isNaN(v)) onSet(v)
            setDraft(null)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </div>
  )
}

function RatesTable({ rates }: { rates: ReturnType<typeof channelRates> }) {
  const fmt = (r: number | null) => (r == null ? '—' : `${(r * 100).toFixed(1)}%`)
  return (
    <table className="ck-table">
      <thead>
        <tr>
          <th>Kanal</th>
          <th style={{ textAlign: 'right' }}>Anfragen</th>
          <th style={{ textAlign: 'right' }}>Antworten</th>
          <th style={{ textAlign: 'right' }}>Rate</th>
          <th style={{ textAlign: 'right' }}>Benchmark</th>
        </tr>
      </thead>
      <tbody>
        {rates.map((r) => {
          const inBench = r.rate != null && r.rate >= r.benchMin
          return (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td style={{ textAlign: 'right' }}>{r.anfragen}</td>
              <td style={{ textAlign: 'right' }}>{r.antworten}</td>
              <td
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: r.rate == null ? 'var(--ck-text-3)' : inBench ? 'var(--ck-accent)' : 'var(--ck-warn)',
                }}
              >
                {fmt(r.rate)}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--ck-text-3)' }}>
                {Math.round(r.benchMin * 100)}–{Math.round(r.benchMax * 100)}%
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * Tracking (REBUILD-PLAN §9): Heute-Eingabe, Wochenziele, Soll-Kurve, Kanal-Raten.
 * Frühindikator-Logik: Umsatz läuft dem Input ~1–2 Wochen nach — die UI
 * alarmiert deshalb über fehlenden INPUT, nicht über fehlenden Umsatz.
 */
export function TrackingArea() {
  const metrics = useDailyMetrics()
  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.monthRows),
    [metrics.weekRows, metrics.monthRows],
  )
  const rates = useMemo(() => channelRates(metrics.monthRows), [metrics.monthRows])

  if (metrics.tableMissing) {
    return (
      <div className="ck-panel" style={{ padding: 20, borderColor: 'var(--ck-warn)' }}>
        <div className="ck-label" style={{ color: 'var(--ck-warn)', marginBottom: 8 }}>
          Migration ausstehend
        </div>
        <p style={{ fontSize: 13, color: 'var(--ck-text-2)', lineHeight: 1.6 }}>
          Die Tabelle <code>daily_metrics</code> existiert noch nicht. Führe{' '}
          <code>supabase/migrations/0049_daily_metrics.sql</code> im Supabase-Dashboard
          (SQL-Editor) aus und lade diese Seite neu.
        </p>
      </div>
    )
  }

  const weekUmsatz = metrics.weekRows.reduce((a, r) => a + (Number(r.umsatz) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100 }}>
      {/* Heute-Eingabe */}
      <section className="ck-panel" aria-label="Heute eintragen">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 12px 6px' }}>
          <span className="ck-label">Heute · {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
          {metrics.error ? (
            <span className="ck-label" style={{ color: 'var(--ck-warn)' }}>Speichern fehlgeschlagen: {metrics.error}</span>
          ) : null}
        </div>

        <div style={{ padding: '0 12px 6px' }}>
          <div className="ck-label" style={{ margin: '4px 0 6px', color: 'var(--ck-text-3)' }}>Input (Frühindikator)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
            {INPUT_FIELDS.filter((f) => f.group === 'input').map((f) => (
              <Stepper
                key={f.field}
                label={f.label}
                value={metrics.today[f.field]}
                onBump={(d) => void metrics.bump(f.field, d)}
              />
            ))}
          </div>
          <div className="ck-label" style={{ margin: '12px 0 6px', color: 'var(--ck-text-3)' }}>Ergebnis (nachlaufend)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, paddingBottom: 10 }}>
            {INPUT_FIELDS.filter((f) => f.group === 'ergebnis').map((f) => (
              <Stepper
                key={f.field}
                label={f.label}
                value={metrics.today[f.field]}
                onBump={(d) => void metrics.bump(f.field, d)}
              />
            ))}
            <UmsatzInput value={metrics.today.umsatz} onSet={(v) => void metrics.setUmsatz(v)} />
          </div>
        </div>
      </section>

      {/* Woche + Monat nebeneinander */}
      <div className="ck-tracking-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <VitalsPanel vitals={vitals} />
          <section className="ck-panel" style={{ padding: '10px 12px' }} aria-label="Wochenumsatz">
            <div className="ck-label">Umsatz diese Woche</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{formatEuro(weekUmsatz)}</div>
          </section>
        </div>
        <section className="ck-panel" style={{ padding: '10px 12px' }} aria-label="Monatskurve">
          <MonthCurve monthRows={metrics.monthRows} />
        </section>
      </div>

      {/* Kanal-Antwortraten */}
      <section className="ck-panel" aria-label="Antwortrate je Kanal">
        <div className="ck-label" style={{ padding: '10px 12px 4px' }}>
          Antwortrate je Kanal · laufender Monat
        </div>
        <RatesTable rates={rates} />
        <p className="ck-label" style={{ padding: '8px 12px', color: 'var(--ck-text-3)' }}>
          Aussagekräftig ab ~2 Wochen Daten. Rate unter Benchmark → Skript/Zielgruppe prüfen, nicht härter senden.
        </p>
      </section>
    </div>
  )
}
