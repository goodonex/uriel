import { motion } from 'framer-motion'
import { useState } from 'react'
import { useScrollFlow } from '../context/ScrollFlowContext'
import { useScrollSectionContext } from '../context/ScrollSectionContext'
import { useUiTheme } from '../hooks/useUiTheme'
import { SECTION_LABELS, SECTION_ORDER, type SectionKey } from '../lib/scrollFlow'

interface SectionDotNavProps {
  onSelect: (section: SectionKey) => void
}

export function SectionDotNav({ onSelect }: SectionDotNavProps) {
  const [hovered, setHovered] = useState<SectionKey | null>(null)
  const scrollCtx = useScrollSectionContext()
  const { scrollBusy } = useScrollFlow()
  const { isPlainLight } = useUiTheme()
  const active = scrollCtx?.activeSection ?? 'dashboard'
  // Konkreter Wert statt var(): framer-motion interpoliert backgroundColor.
  const inactiveDot = isPlainLight ? 'rgba(70, 74, 92, 0.55)' : 'rgba(200, 204, 220, 0.5)'

  return (
    <nav
      aria-label="Bereiche"
      style={{
        position: 'fixed',
        right: 18,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
        pointerEvents: 'auto',
      }}
    >
      {SECTION_ORDER.map((key) => {
        const isActive = key === active
        const showTip = hovered === key

        let inactiveOpacity = 0.35
        if (scrollBusy) inactiveOpacity = 0.6
        else if (hovered === key) inactiveOpacity = 0.7

        const accent = 'var(--brand-accent, var(--accent-teal))'

        return (
          <div
            key={key}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
          >
            {showTip ? (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.12 }}
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'var(--surface-popover)',
                  border: '1px solid var(--glass-border-1)',
                }}
              >
                {SECTION_LABELS[key]}
              </motion.span>
            ) : null}
            <button
              type="button"
              aria-label={SECTION_LABELS[key]}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(key)}
              style={{
                position: 'relative',
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <motion.span
                animate={{
                  scale: isActive ? 1.4 : 1,
                  opacity: isActive ? 1 : inactiveOpacity,
                  backgroundColor: isActive ? accent : inactiveDot,
                  boxShadow: isActive
                    ? '0 0 14px color-mix(in srgb, var(--brand-accent, var(--accent-teal)) 55%, transparent)'
                    : 'none',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                }}
              />
            </button>
          </div>
        )
      })}
    </nav>
  )
}
