import { motion } from 'framer-motion'
import { useState } from 'react'
import { useScrollSectionContext } from '../context/ScrollSectionContext'
import { SECTION_LABELS, SECTION_ORDER, type SectionKey } from '../lib/scrollFlow'

interface SectionDotNavProps {
  onSelect: (section: SectionKey) => void
}

export function SectionDotNav({ onSelect }: SectionDotNavProps) {
  const [hovered, setHovered] = useState<SectionKey | null>(null)
  const scrollCtx = useScrollSectionContext()
  const active = scrollCtx?.activeSection ?? 'dashboard'

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
        return (
          <div
            key={key}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
          >
            {showTip ? (
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: 'rgba(8,8,16,0.75)',
                  border: '1px solid var(--glass-border-2)',
                }}
              >
                {SECTION_LABELS[key]}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={SECTION_LABELS[key]}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(key)}
              style={{
                position: 'relative',
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {isActive ? (
                <motion.span
                  layoutId="scroll-dot-active"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: 'var(--brand-accent, var(--accent-teal))',
                    boxShadow:
                      '0 0 14px color-mix(in srgb, var(--brand-accent, var(--accent-teal)) 60%, transparent)',
                  }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                />
              ) : (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'rgba(200,204,220,0.4)',
                    transition: 'background 0.2s, transform 0.2s',
                    transform: hovered === key ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              )}
            </button>
          </div>
        )
      })}
    </nav>
  )
}
