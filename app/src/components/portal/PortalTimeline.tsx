import type { DeliverProjectStage, DeliverStageDurations } from '../../types/db'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'

interface PortalTimelineProps {
  clientStage: DeliverProjectStage
  stageDurations: DeliverStageDurations
  accentColor: string
}

export function PortalTimeline({ clientStage, stageDurations, accentColor }: PortalTimelineProps) {
  const activeIdx = DELIVER_STAGE_ORDER.indexOf(clientStage)

  return (
    <div className="portal-card">
      <h2 className="portal-section-title">Dein Projekt-Fortschritt</h2>
      <p className="portal-section-meta">So läuft dein Projekt ab — Schritt für Schritt.</p>

      <div className="hidden sm:block">
        <div className="flex gap-1">
          {DELIVER_STAGE_ORDER.map((stage, i) => {
            const done = activeIdx >= 0 && activeIdx > i
            const current = activeIdx === i
            return (
              <div key={stage} className="min-w-0 flex-1">
                <div
                  style={{
                    height: 8,
                    borderRadius: 6,
                    background: done ? accentColor : current ? accentColor : '#e8e8ed',
                    opacity: current && !done ? 0.45 : 1,
                  }}
                />
                <div
                  style={{
                    fontSize: 10,
                    marginTop: 6,
                    textAlign: 'center',
                    color: current ? 'var(--portal-text)' : 'var(--portal-text-tertiary)',
                    lineHeight: 1.2,
                  }}
                >
                  {DELIVER_STAGE_LABEL[stage]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {DELIVER_STAGE_ORDER.map((stage, i) => {
          const done = activeIdx >= 0 && activeIdx > i
          const current = activeIdx === i
          return (
            <div key={stage} className="flex items-start gap-3">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: done ? accentColor : current ? accentColor : '#e8e8ed',
                  color: done || current ? '#fff' : 'var(--portal-text-secondary)',
                  opacity: current && !done ? 0.7 : 1,
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <div>
                <div style={{ fontWeight: current ? 600 : 500, fontSize: 14 }}>
                  {DELIVER_STAGE_LABEL[stage]}
                </div>
                <div style={{ fontSize: 12, color: 'var(--portal-text-secondary)', marginTop: 2 }}>
                  {stageDurations[stage]}
                  {current ? ' · Aktuelle Phase' : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
