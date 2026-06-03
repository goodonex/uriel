import type { CSSProperties } from 'react'
import {
  OPPORTUNITY_MAIN_STAGES,
  OPPORTUNITY_STAGE_LABEL,
} from '../../lib/opportunityMeta'
import type { OpportunityStage } from '../../types/db'

export function OpportunityStageStepper({
  current,
  onChange,
  accentColor = 'var(--mode-sales)',
  fullWidth = true,
}: {
  current: OpportunityStage
  onChange: (s: OpportunityStage) => void
  accentColor?: string
  fullWidth?: boolean
}) {
  const progression = OPPORTUNITY_MAIN_STAGES
  const isPaused = current === 'pause'
  const isLost = current === 'verloren'
  const currentIdx = isPaused || isLost ? -1 : progression.indexOf(current as (typeof progression)[number])
  const accent = isPaused || isLost ? 'var(--text-tertiary)' : accentColor

  const totalSteps = progression.length
  const fillRatio =
    isPaused || isLost || currentIdx < 0 ? 0 : currentIdx / (totalSteps - 1)

  const lineInset = fullWidth ? 22 : 6

  return (
    <div style={{ paddingBottom: 4, minWidth: 0, flex: fullWidth ? '1 1 auto' : undefined }}>
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
              const reached = !isPaused && !isLost && idx <= currentIdx
              const isCurrent = !isPaused && !isLost && idx === currentIdx
              const dotSize = isCurrent ? 14 : 10
              const isFirst = idx === 0
              const isLast = idx === progression.length - 1
              const dotStyle: CSSProperties = {
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                background: reached ? accent : 'var(--glass-2)',
                border: isCurrent
                  ? `2px solid ${accent}`
                  : reached
                    ? `2px solid ${accent}`
                    : '2px solid var(--glass-border-2)',
                boxShadow: isCurrent
                  ? `0 0 0 4px color-mix(in srgb, ${accent} 18%, transparent)`
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
                  title={OPPORTUNITY_STAGE_LABEL[stage]}
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
                        ? accent
                        : reached
                          ? 'var(--text-secondary)'
                          : 'var(--text-tertiary)',
                      fontWeight: isCurrent ? 700 : 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {OPPORTUNITY_STAGE_LABEL[stage]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        {(isPaused || isLost) && (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
            {OPPORTUNITY_STAGE_LABEL[current]}
          </span>
        )}
      </div>
    </div>
  )
}
