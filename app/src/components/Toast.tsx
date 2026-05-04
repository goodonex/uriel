import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
}

interface ToastContextValue {
  show: (message: string, tone?: ToastItem['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback<ToastContextValue['show']>((message, tone = 'info') => {
    const id = ++counter
    setItems((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-6 bottom-6 z-[60] flex flex-col gap-2"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="font-mono"
              style={{
                fontSize: 12,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--glass-3)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                border: `1px solid ${
                  t.tone === 'error'
                    ? 'var(--accent-coral)'
                    : t.tone === 'success'
                      ? 'var(--accent-teal)'
                      : 'var(--glass-border-2)'
                }`,
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-glass)',
              }}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}
