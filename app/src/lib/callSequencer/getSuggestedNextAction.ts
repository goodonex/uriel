import type { CallNextAction, CallOutcome } from '../../types/callOutcomes'
import type { PipelineStage } from '../../types/db'

export interface SuggestedNextAction {
  /** Anzeige für den Nutzer */
  label: string
  /** Editierbare Felder → werden zu CallNextAction beim Speichern */
  type: CallNextAction['type']
  due_at: string | null
  title?: string
  pipeline_stage?: PipelineStage | null
  open_calendar?: boolean
  include_brief?: boolean
}

function atHour(daysFromNow: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function fmtDeDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

/**
 * Schlägt den nächsten Schritt nach Anruf-Outcome vor (pure, keine Side Effects).
 */
export function getSuggestedNextAction(
  outcome: CallOutcome,
  callCount: number,
): SuggestedNextAction {
  switch (outcome) {
    case 'not_reached': {
      if (callCount < 3) {
        const due = atHour(2)
        return {
          label: `Empfehlung: Anruf am ${fmtDeDate(due)}`,
          type: 'call',
          due_at: due,
          title: 'Erneut anrufen',
        }
      }
      return {
        label: 'Empfehlung: Brief vorbereiten',
        type: 'brief_task',
        due_at: atHour(1),
        title: 'Brief vorbereiten',
      }
    }
    case 'voicemail': {
      if (callCount < 2) {
        const due = atHour(3)
        return {
          label: `Empfehlung: Anruf am ${fmtDeDate(due)}`,
          type: 'call',
          due_at: due,
          title: 'Nach AB erneut anrufen',
        }
      }
      return {
        label: 'Empfehlung: Brief vorbereiten',
        type: 'brief_task',
        due_at: atHour(1),
        title: 'Brief vorbereiten',
      }
    }
    case 'no_interest':
      return {
        label: 'Empfehlung: Wiedervorlage in 90 Tagen (oder Sperrliste)',
        type: 'reminder',
        due_at: atHour(90),
        title: 'Wiedervorlage prüfen',
      }
    case 'later': {
      const due = atHour(7)
      return {
        label: `Empfehlung: Follow-up Anruf am ${fmtDeDate(due)} (optional Brief parallel)`,
        type: 'call',
        due_at: due,
        title: 'Follow-up Anruf',
        include_brief: true,
      }
    }
    case 'follow_up':
      return {
        label: 'Empfehlung: Stage Discovery · Task „Vorbereitung“',
        type: 'task',
        due_at: atHour(1),
        title: 'Vorbereitung Folgetermin',
        pipeline_stage: 'conversation',
      }
    case 'meeting':
      return {
        label: 'Empfehlung: Stage Discovery · Kalender öffnen',
        type: 'task',
        due_at: atHour(0),
        title: 'Termin vorbereiten',
        pipeline_stage: 'conversation',
        open_calendar: true,
      }
    case 'direct_yes':
      return {
        label: 'Empfehlung: Stage → Angebot',
        type: 'task',
        due_at: atHour(1),
        title: 'Angebot vorbereiten',
        pipeline_stage: 'proposal',
      }
    default: {
      const _exhaustive: never = outcome
      return _exhaustive
    }
  }
}

export function suggestedToNextAction(s: SuggestedNextAction): CallNextAction {
  return {
    type: s.type,
    due_at: s.due_at,
    title: s.title,
    pipeline_stage: s.pipeline_stage ?? undefined,
    open_calendar: s.open_calendar,
    include_brief: s.include_brief,
  }
}
