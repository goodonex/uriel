import { motion, type Variants } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import type { ModuleSlot } from './slots'

const enterVariants: Record<ModuleSlot, Variants> = {
  main: {
    initial: { opacity: 0, x: -28 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  },
  'side-top': {
    initial: { opacity: 0, x: 24, y: -16 },
    animate: { opacity: 1, x: 0, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: 16, y: -12, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  },
  'side-bottom': {
    initial: { opacity: 0, x: 24, y: 16 },
    animate: { opacity: 1, x: 0, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: 16, y: 12, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  },
  'overlay-center': {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  },
  'overlay-right': {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: 28, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
  },
}

export interface ModuleContainerProps {
  title: string
  slot: ModuleSlot
  children: ReactNode
  onClose: () => void
  onFocus?: () => void
  /** Optional: zweiter Schritt — Platzhalter für spätere Maximize-Logik */
  showMaximize?: boolean
  compact?: boolean
  /** Position + z-index vom Renderer (slots.ts) */
  frameStyle?: CSSProperties
}

export function ModuleContainer({
  title,
  slot,
  children,
  onClose,
  onFocus,
  showMaximize = false,
  compact = false,
  frameStyle,
}: ModuleContainerProps) {
  const v = enterVariants[slot]

  return (
    <motion.div
      layout
      role="dialog"
      aria-label={title}
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        borderRadius: 18,
        border: '1px solid var(--glass-border-1)',
        background: 'rgba(8, 8, 16, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 24px 72px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        minHeight: 0,
        ...frameStyle,
      }}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={v}
      onPointerDown={() => onFocus?.()}
      whileHover={{
        boxShadow: '0 28px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid var(--glass-border-1)',
          flexShrink: 0,
        }}
      >
        <span
          className="font-mono truncate"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
          }}
        >
          {title}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {showMaximize ? (
            <button
              type="button"
              className="font-mono"
              disabled
              title="Später"
              style={{
                borderRadius: 8,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-tertiary)',
                padding: '5px 8px',
                fontSize: 9,
                cursor: 'not-allowed',
                opacity: 0.45,
              }}
            >
              ▢
            </button>
          ) : null}
          <button
            type="button"
            className="font-mono"
            onClick={onClose}
            style={{
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-secondary)',
              padding: '5px 10px',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Schließen
          </button>
        </div>
      </header>
      <div
        style={{
          minHeight: 0,
          overflow: 'auto',
          padding: compact ? 10 : 14,
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}
