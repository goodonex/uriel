/**
 * CollapsibleSection — Section-Header (Klick zum Auf/Zuklappen)
 * inkl. sanftem Höhen-Animation. Optionaler Status-Dot (z. B. „leer"/„fertig").
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  /** Wird unterhalb des Titels gerendert (z. B. Anzahl, Fortschritt) */
  meta?: ReactNode
  /** Status-Punkt rechts neben dem Titel */
  status?: 'empty' | 'partial' | 'done' | null
  defaultOpen?: boolean
  children: ReactNode
}

const STATUS_COLOR: Record<NonNullable<CollapsibleSectionProps['status']>, string> = {
  empty: 'var(--text-tertiary)',
  partial: 'var(--accent-coral)',
  done: 'var(--accent-success)',
}

export function CollapsibleSection({
  title,
  meta,
  status,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section style={{ marginTop: 8, marginBottom: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-no-scale
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '12px 4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          style={{
            display: 'inline-block',
            color: 'var(--text-tertiary)',
            fontSize: 10,
            width: 12,
          }}
        >
          ▶
        </motion.span>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: open ? 'var(--text-primary)' : 'var(--text-secondary)',
            flex: 1,
          }}
        >
          {title}
        </span>
        {meta ? (
          <span
            className="font-mono"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            {meta}
          </span>
        ) : null}
        {status ? (
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: STATUS_COLOR[status],
              boxShadow: `0 0 8px color-mix(in srgb, ${STATUS_COLOR[status]} 50%, transparent)`,
            }}
          />
        ) : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 8, paddingBottom: 8 }}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}
