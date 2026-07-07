import type { DailyMetricsRow, MetricField } from '../lib/useDailyMetrics'

const QUICK_FIELDS: Array<{ field: MetricField; label: string }> = [
  { field: 'li_anfragen', label: 'LinkedIn' },
  { field: 'inmails', label: 'InMail' },
  { field: 'ig_anfragen', label: 'Insta' },
  { field: 'coldmails', label: 'Cold' },
  { field: 'followups', label: 'Follow-up' },
  { field: 'looms', label: 'Loom' },
]

/**
 * Schnell-Tracking im Cockpit: die 6 Input-Zähler (Frühindikatoren) als
 * Mini-Stepper — für den Akquise-Flow ohne Bereichswechsel.
 * Ergebnis-Felder (Termine, Abschlüsse, Umsatz) bleiben in /tracking.
 */
export function QuickTrack({
  today,
  onBump,
}: {
  today: DailyMetricsRow
  onBump: (field: MetricField, delta: number) => void
}) {
  return (
    <section className="ck-panel" aria-label="Schnell-Tracking heute">
      <div className="ck-label" style={{ padding: '10px 12px 6px' }}>
        Quick Track · heute
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          padding: '0 10px 10px',
        }}
      >
        {QUICK_FIELDS.map((f) => (
          <div
            key={f.field}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
              border: '1px solid var(--ck-border)',
              borderRadius: 6,
              padding: '4px 6px 4px 8px',
            }}
          >
            <span className="ck-label" style={{ fontSize: 9.5 }}>{f.label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'right' }}>
                {today[f.field]}
              </span>
              <button
                className="ck-btn"
                style={{ padding: '1px 7px', fontSize: 12 }}
                onClick={() => onBump(f.field, 1)}
                aria-label={`${f.label} plus 1`}
              >
                +
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
