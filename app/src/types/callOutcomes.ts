import type { PipelineStage } from './db'

/** Anruf-Outcome (Call Sequencer). */
export type CallOutcome =
  | 'not_reached'
  | 'voicemail'
  | 'no_interest'
  | 'later'
  | 'follow_up'
  | 'meeting'
  | 'direct_yes'

export const CALL_OUTCOME_OPTIONS: ReadonlyArray<{ value: CallOutcome; label: string }> = [
  { value: 'not_reached', label: 'Nicht erreicht' },
  { value: 'voicemail', label: 'AB' },
  { value: 'no_interest', label: 'Kein Interesse' },
  { value: 'later', label: 'Interesse, aber später' },
  { value: 'follow_up', label: 'Folgetermin vereinbart' },
  { value: 'meeting', label: 'Termin gebucht' },
  { value: 'direct_yes', label: 'Direkt Ja' },
]

/** Outcomes für „Anruf protokollieren“ (kein Gespräch / nicht erreicht). */
export const CALL_LOG_OUTCOME_OPTIONS = CALL_OUTCOME_OPTIONS.filter((o) =>
  (['not_reached', 'voicemail', 'no_interest'] as const).includes(
    o.value as 'not_reached' | 'voicemail' | 'no_interest',
  ),
)

export type CallNextActionType =
  | 'call'
  | 'brief_task'
  | 'task'
  | 'reminder'
  | 'blocklist'

/** Bestätigter nächster Schritt (in activity_entries.data.next_action). */
export interface CallNextAction {
  type: CallNextActionType
  /** ISO-Datum/Zeit für Anruf, Task oder Wiedervorlage */
  due_at?: string | null
  title?: string
  pipeline_stage?: PipelineStage | null
  /** Termin-Outcome: Buchungslink im Browser öffnen */
  open_calendar?: boolean
  /** Optionaler Brief parallel (z. B. bei „später“) */
  include_brief?: boolean
}

export interface CallActivityData {
  outcome: CallOutcome
  note?: string
  next_action: CallNextAction
}

export function isCallOutcome(v: unknown): v is CallOutcome {
  return (
    v === 'not_reached' ||
    v === 'voicemail' ||
    v === 'no_interest' ||
    v === 'later' ||
    v === 'follow_up' ||
    v === 'meeting' ||
    v === 'direct_yes'
  )
}

export function parseCallActivityData(data: Record<string, unknown>): CallActivityData | null {
  const outcome = data.outcome
  if (!isCallOutcome(outcome)) return null
  const rawNext = data.next_action
  if (!rawNext || typeof rawNext !== 'object' || Array.isArray(rawNext)) return null
  const n = rawNext as Record<string, unknown>
  const type = n.type
  if (
    type !== 'call' &&
    type !== 'brief_task' &&
    type !== 'task' &&
    type !== 'reminder' &&
    type !== 'blocklist'
  ) {
    return null
  }
  return {
    outcome,
    note: typeof data.note === 'string' ? data.note : undefined,
    next_action: {
      type,
      due_at: typeof n.due_at === 'string' ? n.due_at : n.due_at === null ? null : undefined,
      title: typeof n.title === 'string' ? n.title : undefined,
      pipeline_stage:
        n.pipeline_stage === 'first_contact' ||
        n.pipeline_stage === 'conversation' ||
        n.pipeline_stage === 'proposal' ||
        n.pipeline_stage === 'deal' ||
        n.pipeline_stage === 'paused'
          ? n.pipeline_stage
          : n.pipeline_stage === null
            ? null
            : undefined,
      open_calendar: n.open_calendar === true,
      include_brief: n.include_brief === true,
    },
  }
}
