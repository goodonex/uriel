import { areaProgress, deliverablesForArea } from './deliverableCatalog'
import type {
  DeliverableItem,
  DeliverProjectStage,
  DeliverStageDurations,
} from '../types/db'
import { DELIVER_STAGE_ORDER } from '../types/db'

export type PhaseKey = 'branding' | 'website' | 'leadgen' | 'scaling'

export const PHASE_ORDER: PhaseKey[] = ['branding', 'website', 'leadgen', 'scaling']

export const PHASE_LABELS: Record<PhaseKey, string> = {
  branding: 'Branding',
  website: 'Website',
  leadgen: 'Lead Generation — Test',
  scaling: 'Skalierung',
}

/** DB-Stages die zu einer UI-Phase gehören. */
export const PHASE_STAGES: Record<PhaseKey, DeliverProjectStage[]> = {
  branding: ['onboarding', 'discover'],
  website: ['inner_world'],
  leadgen: ['visual_world'],
  scaling: ['execute'],
}

export function phaseForStage(stage: DeliverProjectStage): PhaseKey {
  if (stage === 'onboarding' || stage === 'discover') return 'branding'
  if (stage === 'inner_world') return 'website'
  if (stage === 'visual_world') return 'leadgen'
  return 'scaling'
}

export function phaseIndex(phase: PhaseKey): number {
  return PHASE_ORDER.indexOf(phase)
}

export type PhaseCardState = 'completed' | 'active' | 'locked'

export function getPhaseState(
  phase: PhaseKey,
  currentStage: DeliverProjectStage,
): PhaseCardState {
  const currentPhase = phaseForStage(currentStage)
  const pi = phaseIndex(phase)
  const ci = phaseIndex(currentPhase)
  if (pi < ci) return 'completed'
  if (pi === ci) return 'active'
  return 'locked'
}

export function previousPhaseLabel(phase: PhaseKey): string | null {
  const idx = phaseIndex(phase)
  if (idx <= 0) return null
  return PHASE_LABELS[PHASE_ORDER[idx - 1]]
}

export function phaseDurationLabel(
  phase: PhaseKey,
  durations: DeliverStageDurations | null | undefined,
): string | null {
  if (!durations) return null
  const stages = PHASE_STAGES[phase]
  const parts = stages
    .map((s) => durations[s])
    .filter((v): v is string => Boolean(v?.trim()))
  if (parts.length === 0) return null
  return parts.join(' + ')
}

export function phaseDeliverableProgress(
  deliverables: DeliverableItem[],
  phase: PhaseKey,
): { ready: number; total: number } {
  if (phase === 'leadgen' || phase === 'scaling') {
    return { ready: 0, total: 0 }
  }
  const area = phase === 'branding' ? 'branding' : 'website'
  return areaProgress(deliverablesForArea(deliverables, area))
}

export function stageCompletionDate(
  phase: PhaseKey,
  currentStage: DeliverProjectStage,
): string | null {
  const state = getPhaseState(phase, currentStage)
  if (state !== 'completed') return null
  const lastStage = PHASE_STAGES[phase][PHASE_STAGES[phase].length - 1]
  const idx = DELIVER_STAGE_ORDER.indexOf(lastStage)
  const nextStage = DELIVER_STAGE_ORDER[idx + 1]
  if (!nextStage) return null
  return null
}
