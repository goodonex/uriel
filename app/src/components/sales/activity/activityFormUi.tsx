import type { CSSProperties, ReactNode } from 'react'
import {
  SALES_FIELD_SOLID,
  SALES_MODAL_GHOST_BTN,
  SalesModalPortal,
} from './salesModalUi'

export const fieldLabel: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.1em',
  color: 'var(--text-tertiary)',
  display: 'block',
  marginBottom: 4,
}

export const fieldInput: CSSProperties = SALES_FIELD_SOLID

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
    <SalesModalPortal open onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="font-display" style={{ fontSize: 18, margin: 0, color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <button type="button" onClick={onClose} className="font-mono" style={SALES_MODAL_GHOST_BTN}>
          ✕
        </button>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        {onDraft ? (
          <button type="button" onClick={onDraft} className="font-mono" style={SALES_MODAL_GHOST_BTN}>
            Entwurf speichern
          </button>
        ) : null}
        <button
          type="button"
          disabled={doneDisabled}
          onClick={onDone}
          className="font-mono"
          style={{
            ...SALES_MODAL_GHOST_BTN,
            border: '1px solid var(--mode-sales)',
            color: 'var(--mode-sales)',
            opacity: doneDisabled ? 0.5 : 1,
          }}
        >
          ✓ {doneLabel}
        </button>
      </div>
    </SalesModalPortal>
  )
}
