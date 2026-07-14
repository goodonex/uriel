import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
}

const DRAWER_Z = 90

export function Drawer({ open, onClose, title, children, width = 380 }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0"
            style={{
              zIndex: DRAWER_Z,
              background: 'var(--overlay-backdrop)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed top-4 right-4 bottom-4 flex flex-col"
            style={{
              zIndex: DRAWER_Z + 1,
              width: `min(${width}px, calc(100vw - 24px))`,
              maxWidth: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--glass-border-2)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              padding: 20,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex shrink-0 items-center justify-between">
              <span
                className="font-display"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {title}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="flex items-center justify-center transition-colors"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--glass-2)',
                  border: '1px solid var(--glass-border-1)',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                paddingRight: 2,
              }}
            >
              {children}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
