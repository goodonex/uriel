import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const SALES_MODAL_Z = 200

export const SALES_MODAL_BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: SALES_MODAL_Z,
  background: 'var(--overlay-backdrop)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  pointerEvents: 'auto',
}

/** Dropdown unter Aktivität ▾ — deckend, per Portal */
export const SALES_DROPDOWN_PANEL: CSSProperties = {
  minWidth: 240,
  padding: 6,
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--surface-popover)',
  boxShadow: 'var(--shadow-lg)',
  maxHeight: 360,
  overflowY: 'auto',
}

export const SALES_MODAL_PANEL: CSSProperties = {
  width: 'min(520px, 100%)',
  maxHeight: 'min(90vh, 720px)',
  overflowY: 'auto',
  borderRadius: 16,
  border: '1px solid var(--glass-border-2)',
  padding: 20,
  background: 'var(--surface-drawer)',
  boxShadow: 'var(--shadow-lg)',
}

export const SALES_FIELD_SOLID: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  outline: 'none',
}

export const SALES_MODAL_GHOST_BTN: CSSProperties = {
  fontSize: 11,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

export function SalesModalPortal({
  open,
  onClose,
  children,
  panelStyle,
  backdropStyle,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  panelStyle?: CSSProperties
  backdropStyle?: CSSProperties
}) {
  if (!open) return null
  return createPortal(
    <div role="presentation" style={{ ...SALES_MODAL_BACKDROP, ...backdropStyle }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        style={{ ...SALES_MODAL_PANEL, ...panelStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
