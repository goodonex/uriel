import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface WorkspaceContextMenuProps {
  open: boolean
  x: number
  y: number
  label?: string
  onOpenInNewTab: () => void
  onClose: () => void
}

export function WorkspaceContextMenu({
  open,
  x,
  y,
  label = 'In neuem Tab öffnen',
  onOpenInNewTab,
  onClose,
}: WorkspaceContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [onClose, open])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      className="font-mono"
      role="menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 200,
        minWidth: 180,
        padding: 4,
        borderRadius: 10,
        border: '1px solid var(--glass-border-2)',
        background: 'color-mix(in srgb, var(--bg-base) 96%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <button
        type="button"
        role="menuitem"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenInNewTab()
          onClose()
        }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          borderRadius: 7,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    </div>,
    document.body,
  )
}

export function useWorkspaceContextMenu() {
  const actionRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<{
    open: boolean
    x: number
    y: number
  }>({ open: false, x: 0, y: 0 })

  const close = useCallback(() => {
    actionRef.current = null
    setState((s) => ({ ...s, open: false }))
  }, [])

  const openAt = useCallback((e: React.MouseEvent, action: () => void) => {
    e.preventDefault()
    e.stopPropagation()
    actionRef.current = action
    setState({ open: true, x: e.clientX, y: e.clientY })
  }, [])

  const runAction = useCallback(() => {
    actionRef.current?.()
  }, [])

  return { state, close, openAt, runAction }
}
