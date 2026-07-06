/**
 * E-Mail-Bereich — Platzhalter (Phase 1).
 * Phase 4 zieht Versand, Sequenzen/Flows und Open/Click-Auswertung hierher um.
 */
export function EmailArea() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="ck-label">E-Mail</span>
      <div className="ck-panel" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--ck-text-2)' }}>
          Versand, Sequenzen &amp; Tracking ziehen in Phase 4 hierher um.
        </p>
      </div>
    </div>
  )
}
