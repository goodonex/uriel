/**
 * CRM-Bereich — Platzhalter (Phase 1).
 * Phase 4 zieht Pipeline, Kontakte, Listen und Call-Mode hierher um.
 */
export function CrmArea() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="ck-label">CRM</span>
      <div className="ck-panel" style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--ck-text-2)' }}>
          Pipeline, Kontakte, Listen &amp; Call-Mode ziehen in Phase 4 hierher um.
        </p>
      </div>
    </div>
  )
}
