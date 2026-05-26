import type { CSSProperties, ReactNode } from 'react'

export const fieldLabel: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
  display: 'block',
  marginBottom: 4,
}

export const fieldInput: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  outline: 'none',
}

export function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span className="font-mono" style={fieldLabel}>
        {label.toUpperCase()}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

export function ModalShell({
  title,
  onClose,
  onDone,
  onDraft,
  doneLabel = 'Done',
  doneDisabled,
  children,
}: {
  title: string
  onClose: () => void
  onDone: () => void
  onDraft?: () => void
  doneLabel?: string
  doneDisabled?: boolean
  children: ReactNode
}) {
  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.55)',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          maxHeight: 'min(90vh, 720px)',
          overflowY: 'auto',
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="font-display" style={{ fontSize: 18, margin: 0 }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} className="font-mono" style={ghostBtn}>
            ✕
          </button>
        </div>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {onDraft ? (
            <button type="button" onClick={onDraft} className="font-mono" style={ghostBtn}>
              Entwurf speichern
            </button>
          ) : null}
          <button
            type="button"
            disabled={doneDisabled}
            onClick={onDone}
            className="font-mono"
            style={{
              ...ghostBtn,
              border: '1px solid var(--mode-sales)',
              color: 'var(--mode-sales)',
              opacity: doneDisabled ? 0.5 : 1,
            }}
          >
            ✓ {doneLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const ghostBtn: CSSProperties = {
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}
