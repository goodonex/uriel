import type { DeliverProjectStage } from '../../types/db'

export const DELIVER_STAGE_LABEL: Record<DeliverProjectStage, string> = {
  onboarding: 'Onboarding',
  discover: 'Discover',
  inner_world: 'Inner World',
  visual_world: 'Visual World',
  execute: 'Execute',
}
