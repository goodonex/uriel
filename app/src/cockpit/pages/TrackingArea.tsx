/**
 * Tracking-Bereich — Platzhalter (Phase 1).
 * Phase 3 baut hier: Heute-Eingabe (+1-Stepper), Wochenansicht mit
 * Progress-Bars (150/25/5/2), Monatsansicht mit Juli-Soll-Kurve,
 * Antwortraten je Kanal.
 */
export function TrackingArea() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="ck-label">Tracking</span>
      <div className="ck-panel" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--ck-text-2)' }}>
          KPI-Eingabe, Wochenziele &amp; Soll-Kurve entstehen in Phase 3.
        </p>
      </div>
    </div>
  )
}
