/**
 * Cockpit-Home — Platzhalter (Phase 1).
 * Phase 2 baut hier: d3-force-Graph, SYSTEM VITALS, DOCUMENTS,
 * COMMAND DECK, PRIMARY DIRECTIVE.
 */
export function CockpitHome() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="ck-label">Cockpit · Home</span>
      <div className="ck-panel" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--ck-text-2)' }}>
          Graph, Vitals &amp; Command Deck entstehen in Phase 2.
        </p>
      </div>
    </div>
  )
}
