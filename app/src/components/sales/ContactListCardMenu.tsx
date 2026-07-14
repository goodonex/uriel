import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { ContactList } from '../../types/db'

function KebabIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <circle cx="7" cy="2.5" r="1.25" />
      <circle cx="7" cy="7" r="1.25" />
      <circle cx="7" cy="11.5" r="1.25" />
    </svg>
  )
}

export function ContactListCardMenu({
  list,
  onToggleFavorite,
  onToggleHidden,
  onDelete,
}: {
  list: ContactList
  onToggleFavorite: () => void
  onToggleHidden: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const updateMenuPos = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 6, left: r.right })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPos()
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current?.contains(t)) return
      const portal = document.getElementById('contact-list-card-menu-portal')
      if (portal?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', updateMenuPos, true)
    window.addEventListener('resize', updateMenuPos)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', updateMenuPos, true)
      window.removeEventListener('resize', updateMenuPos)
    }
  }, [open, updateMenuPos])

  const itemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '9px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    borderRadius: 6,
  }

  const menuPanel =
    open && menuPos ? (
      <div
        id="contact-list-card-menu-portal"
        role="menu"
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          transform: 'translateX(-100%)',
          zIndex: 1200,
          minWidth: 196,
          padding: 4,
          borderRadius: 12,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--surface-popover)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          style={itemStyle}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            onToggleFavorite()
          }}
        >
          {list.is_favorite ? '★ Aus Favoriten entfernen' : '☆ Als Favorit markieren'}
        </button>
        <button
          type="button"
          role="menuitem"
          style={itemStyle}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            onToggleHidden()
          }}
        >
          {list.is_hidden ? 'Wieder einblenden' : 'Ausblenden'}
        </button>
        <button
          type="button"
          role="menuitem"
          style={{
            ...itemStyle,
            color: 'var(--status-danger)',
            borderTop: '1px solid var(--glass-border-2)',
            marginTop: 2,
            paddingTop: 10,
          }}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(false)
            onDelete()
          }}
        >
          Löschen
        </button>
      </div>
    ) : null

  return (
    <>
      <div ref={rootRef} style={{ position: 'absolute', top: 8, right: 8, zIndex: 3 }}>
        <button
          ref={btnRef}
          type="button"
          aria-label="Listen-Aktionen"
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen((v) => {
              const next = !v
              if (next) requestAnimationFrame(updateMenuPos)
              return next
            })
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 8,
            border: 'none',
            background:
              open || hovered
                ? 'color-mix(in srgb, var(--glass-3) 70%, transparent)'
                : 'transparent',
            color: open || hovered ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          <KebabIcon />
        </button>
      </div>
      {menuPanel ? createPortal(menuPanel, document.body) : null}
    </>
  )
}
