import type { EmailSequence, PipelineStage } from '../types/db'

export type AppointmentPurpose = 'follow_up' | 'erstgespraech' | 'setting' | 'closing'

export const APPOINTMENT_PURPOSES: Array<{
  key: AppointmentPurpose
  label: string
  keywords: string[]
  suggestedStage?: PipelineStage
}> = [
  {
    key: 'erstgespraech',
    label: 'Erstgespräch',
    keywords: ['erstgespräch', 'erstgespraech', 'first call'],
    suggestedStage: 'conversation',
  },
  {
    key: 'setting',
    label: 'Setting-Termin',
    keywords: ['setting', 'setter'],
    suggestedStage: 'conversation',
  },
  {
    key: 'closing',
    label: 'Closing-Termin',
    keywords: ['closing', 'abschluss', 'close'],
    suggestedStage: 'proposal',
  },
  {
    key: 'follow_up',
    label: 'Follow-up / Kurztermin',
    keywords: ['follow-up', 'followup', 'follow up'],
  },
]

export function appointmentPurposeLabel(key: AppointmentPurpose): string {
  return APPOINTMENT_PURPOSES.find((p) => p.key === key)?.label ?? key
}

export function findSequenceForAppointment(
  sequences: EmailSequence[],
  purpose: AppointmentPurpose,
): EmailSequence | null {
  const cfg = APPOINTMENT_PURPOSES.find((p) => p.key === purpose)
  if (!cfg) return null

  const active = sequences.filter((s) => s.active)
  for (const kw of cfg.keywords) {
    const hit = active.find((s) => s.name.toLowerCase().includes(kw.toLowerCase()))
    if (hit) return hit
  }
  const fallback = active.find((s) => s.name.toLowerCase().includes(cfg.label.toLowerCase()))
  return fallback ?? null
}

export function suggestedStageForPurpose(purpose: AppointmentPurpose): PipelineStage | null {
  return APPOINTMENT_PURPOSES.find((p) => p.key === purpose)?.suggestedStage ?? null
}
