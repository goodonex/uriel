import type { CSSProperties } from 'react'
import type { PipelineStage } from '../../types/db'

const STAGES: Array<{ key: PipelineStage; label: string; color: string }> = [
  { key: 'first_contact', label: 'Erstkontakt', color: 'var(--text-tertiary)' },
  { key: 'conversation', label: 'Gespräch', color: 'var(--accent-blue)' },
  { key: 'proposal', label: 'Angebot', color: 'var(--mode-sales)' },
  { key: 'deal', label: 'Deal', color: 'var(--accent-teal)' },
]

export function ContactStageStepper({
  current,
  onChange,
  inline = false,
  fullWidth = false,
}: {
  current: PipelineStage
  onChange: (s: PipelineStage) => void
  inline?: boolean
  fullWidth?: boolean
}) {
  const progression: PipelineStage[] = ['first_contact', 'conversation', 'proposal', 'deal']
  const currentIdx = progression.indexOf(current)
  const isPaused = current === 'paused'

  const accent = isPaused
    ? 'var(--text-tertiary)'
    : (STAGES[currentIdx] ?? STAGES[0]).color

  const totalSteps = progression.length
  const fillRatio =
    isPaused || currentIdx < 0 ? 0 : currentIdx / (totalSteps - 1)

  const lineInset = fullWidth ? 22 : 6

  const line = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: fullWidth ? 20 : 10,
        flexWrap: 'nowrap',
      }}
    >
      <div
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minWidth: fullWidth ? 0 : 220,
          maxWidth: fullWidth ? 'none' : 420,
          height: 28,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: lineInset,
            right: lineInset,
            height: 2,
            transform: 'translateY(-50%)',
            background: 'var(--glass-border-2)',
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: lineInset,
            height: 2,
            width: `calc((100% - ${lineInset * 2}px) * ${fillRatio})`,
            transform: 'translateY(-50%)',
            background: accent,
            borderRadius: 1,
            transition: 'width 220ms ease, background 220ms ease',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '100%',
            paddingLeft: lineInset - 7,
            paddingRight: lineInset - 7,
          }}
        >
          {progression.map((stage, idx) => {
            const meta = STAGES.find((s) => s.key === stage)!
            const reached = !isPaused && idx <= currentIdx
            const isCurrent = !isPaused && idx === currentIdx
            const dotSize = isCurrent ? 14 : 10
            const isFirst = idx === 0
            const isLast = idx === progression.length - 1
            const dotStyle: CSSProperties = {
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: reached ? meta.color : 'var(--glass-2)',
              border: isCurrent
                ? `2px solid ${meta.color}`
                : reached
                  ? `2px solid ${meta.color}`
                  : '2px solid var(--glass-border-2)',
              boxShadow: isCurrent
                ? `0 0 0 4px color-mix(in srgb, ${meta.color} 18%, transparent)`
                : 'none',
              transition: 'all 180ms ease',
            }
            const labelPos: CSSProperties = isFirst
              ? { left: -2, transform: 'translateX(0)', textAlign: 'left' }
              : isLast
                ? { right: -2, transform: 'translateX(0)', textAlign: 'right' }
                : { left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }
            return (
              <button
                key={stage}
                type="button"
                onClick={() => onChange(stage)}
                title={meta.label}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <span style={dotStyle} />
                <span
                  className="font-mono"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    ...labelPos,
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isCurrent
                      ? meta.color
                      : reached
                        ? 'var(--text-secondary)'
                        : 'var(--text-tertiary)',
                    fontWeight: isCurrent ? 700 : 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {meta.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(isPaused ? 'first_contact' : 'paused')}
        title={isPaused ? 'Wieder aktivieren' : 'Pause'}
        className="font-mono"
        style={{
          flexShrink: 0,
          fontSize: 11,
          lineHeight: 1,
          padding: '7px 10px',
          borderRadius: 999,
          border: isPaused
            ? '1px solid var(--text-tertiary)'
            : '1px solid var(--glass-border-2)',
          background: isPaused ? 'var(--glass-3)' : 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
        }}
      >
        ⏸
      </button>
    </div>
  )

  if (inline) {
    return <div style={{ paddingBottom: 18 }}>{line}</div>
  }

  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        PHASE
      </div>
      <div style={{ paddingBottom: 18 }}>{line}</div>
    </div>
  )
}
