import type { ReactNode } from 'react'
import { PHASE_ORDER, type PhaseKey } from '../../lib/phaseMapping'
import type { DeliverableItem, DeliverProjectStage, DeliverStageDurations } from '../../types/db'
import { PhaseCard } from './PhaseCard'

interface PhaseDashboardProps {
  currentStage: DeliverProjectStage
  deliverables: DeliverableItem[]
  stageDurations?: DeliverStageDurations | null
  accentColor?: string
  leadCount?: number
  readOnlyDeliverables?: boolean
  renderPhaseContent: (phase: PhaseKey, state: 'active' | 'completed' | 'locked') => ReactNode
  renderPhaseFooter?: (phase: PhaseKey) => ReactNode
}

export function PhaseDashboard({
  currentStage,
  deliverables,
  stageDurations,
  accentColor = 'var(--accent-teal)',
  leadCount = 0,
  readOnlyDeliverables = false,
  renderPhaseContent,
  renderPhaseFooter,
}: PhaseDashboardProps) {
  return (
    <div className="phase-dashboard flex flex-col gap-3">
      {PHASE_ORDER.map((phase) => (
        <PhaseCard
          key={phase}
          phase={phase}
          currentStage={currentStage}
          deliverables={deliverables}
          stageDurations={stageDurations}
          accentColor={accentColor}
          leadCount={leadCount}
          readOnlyDeliverables={readOnlyDeliverables}
          footer={renderPhaseFooter?.(phase)}
        >
          {renderPhaseContent(phase, 'active')}
        </PhaseCard>
      ))}
    </div>
  )
}
