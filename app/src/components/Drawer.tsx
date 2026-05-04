import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
}

export function Drawer({ open, onClose, title, children, width = 380 }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="drawer"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed top-4 right-4 bottom-4 z-50"
          style={{
            width,
            background: 'var(--glass-3)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid var(--glass-border-2)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-glass)',
            padding: 20,
            overflow: 'auto',
          }}
        >
          <div className="mb-5 flex items-center justify-between">
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
              }}
            >
              ×
            </button>
          </div>
          {children}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
