import { useState } from 'react'

export function ContactDeleteConfirm({
  open,
  contactName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  contactName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [phase, setPhase] = useState<'warn' | 'type'>('warn')
  const [typed, setTyped] = useState('')

  if (!open) return null

  const targetLabel = contactName.trim() || 'LÖSCHEN'
  const matches = typed.trim() === targetLabel

  const close = () => {
    setPhase('warn')
    setTyped('')
    onCancel()
  }

  return (
    <div
      role="dialog"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.6)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          padding: 20,
          borderRadius: 16,
          border: '1px solid color-mix(in srgb, var(--accent-coral) 35%, var(--glass-border-1))',
          background: 'var(--glass-1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--accent-coral)',
          }}
        >
          LEAD LÖSCHEN
        </div>
        <h3 className="font-display" style={{ fontSize: 16, margin: 0 }}>
          {contactName || 'Kontakt'}
        </h3>

        {phase === 'warn' ? (
          <>
            <p
              className="font-mono"
              style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}
            >
              Diese Aktion ist <strong>endgültig</strong>. Alle Verlaufseinträge, Tasks und
              Aktivitäten dieses Leads bleiben in der Historie verknüpft, der Lead selbst wird
              entfernt.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={close} className="font-mono" style={btnGhost}>
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => setPhase('type')}
                className="font-mono"
                style={btnDanger}
              >
                Weiter
              </button>
            </div>
          </>
        ) : (
          <>
            <p
              className="font-mono"
              style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}
            >
              Tippe <strong style={{ color: 'var(--text-primary)' }}>{targetLabel}</strong> zum
              endgültigen Löschen.
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={targetLabel}
              className="font-mono"
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches) {
                  onConfirm()
                  close()
                }
                if (e.key === 'Escape') close()
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button
                type="button"
                onClick={() => setPhase('warn')}
                className="font-mono"
                style={btnGhost}
              >
                Zurück
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={close} className="font-mono" style={btnGhost}>
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={!matches}
                  onClick={() => {
                    onConfirm()
                    close()
                  }}
                  className="font-mono"
                  style={{
                    ...btnDanger,
                    opacity: matches ? 1 : 0.4,
                    cursor: matches ? 'pointer' : 'not-allowed',
                  }}
                >
                  Endgültig löschen
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const btnGhost = {
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const btnDanger = {
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--accent-coral)',
  background: 'color-mix(in srgb, var(--accent-coral) 18%, transparent)',
  color: 'var(--accent-coral)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
} as const
