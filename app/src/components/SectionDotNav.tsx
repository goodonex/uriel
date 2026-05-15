import { useState } from 'react'
import { SECTION_LABELS, SECTION_ORDER, type SectionKey } from '../lib/scrollFlow'

interface SectionDotNavProps {
  active: SectionKey
  onSelect: (section: SectionKey) => void
}

export function SectionDotNav({ active, onSelect }: SectionDotNavProps) {
  const [hovered, setHovered] = useState<SectionKey | null>(null)

  return (
    <nav
      aria-label="Bereiche"
      style={{
        position: 'fixed',
        right: 24,
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
                width: isActive ? 12 : 8,
                height: isActive ? 12 : 8,
                borderRadius: '50%',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: isActive ? 'var(--brand-accent, var(--accent-teal))' : 'rgba(200,204,220,0.45)',
                boxShadow: isActive ? '0 0 12px color-mix(in srgb, var(--brand-accent, var(--accent-teal)) 55%, transparent)' : 'none',
                transition: 'width 0.2s, height 0.2s, background 0.2s',
              }}
            />
          </div>
        )
      })}
    </nav>
  )
}
