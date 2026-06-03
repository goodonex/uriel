import type { Contact, FollowUpType, PipelineStage, SalesCallOutcome } from '../types/db'

export type PostCallResult =
  | 'not_reached'
  | 'no_interest'
  | 'conversation'
  | 'meeting'
  | 'offer_requested'

export function followUpIsoDaysFromNow(days: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export function ymdDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Pipeline-Stage nach PostCallModal-Ergebnis. */
export function pipelineStageAfterPostCall(
  result: PostCallResult,
  current: PipelineStage,
): PipelineStage | null {
  if (result === 'meeting') {
    return current === 'first_contact' ? 'conversation' : current === 'conversation' ? current : 'conversation'
  }
  if (result === 'offer_requested') return 'proposal'
  if (result === 'conversation' && current === 'first_contact') return 'conversation'
  return null
}

/** Default Follow-up nach PostCallModal-Ergebnis (wenn Nutzer Datum nicht leert). */
export function defaultFollowUpAfterPostCall(result: PostCallResult): {
  dateYmd: string
  time: string
  type: FollowUpType
} {
  switch (result) {
    case 'not_reached':
      return { dateYmd: ymdDaysFromNow(2), time: '10:00', type: 'call' }
    case 'no_interest':
      return { dateYmd: ymdDaysFromNow(90), time: '10:00', type: 'call' }
    case 'meeting':
      return { dateYmd: ymdDaysFromNow(3), time: '10:00', type: 'meeting' }
    case 'offer_requested':
      return { dateYmd: ymdDaysFromNow(5), time: '10:00', type: 'email' }
    case 'conversation':
    default:
      return { dateYmd: ymdDaysFromNow(3), time: '10:00', type: 'call' }
  }
}

export function mapPostCallToSalesOutcome(result: PostCallResult): SalesCallOutcome {
  if (result === 'not_reached') return 'no_pickup'
  return 'connected'
}

/** Automatische Kontakt-Updates nach Call-Mode-Outcome. */
export function contactPatchAfterCallOutcome(
  contact: Contact,
  outcome: SalesCallOutcome,
): Partial<Omit<Contact, 'id' | 'brand_id'>> {
  const now = new Date().toISOString()
  const patch: Partial<Omit<Contact, 'id' | 'brand_id'>> = {
    last_contact_at: now,
  }

  switch (outcome) {
    case 'connected':
      if (contact.pipeline_stage === 'first_contact') {
        patch.pipeline_stage = 'conversation'
      }
      if (!contact.next_follow_up_at?.trim()) {
        patch.next_follow_up_at = followUpIsoDaysFromNow(3)
        patch.follow_up_type = 'call'
      }
      break
    case 'callback_requested':
      patch.next_follow_up_at = followUpIsoDaysFromNow(1)
      patch.follow_up_type = 'call'
      break
    case 'voicemail':
      patch.next_follow_up_at = followUpIsoDaysFromNow(2)
      patch.follow_up_type = 'call'
      break
    case 'no_pickup':
      patch.next_follow_up_at = followUpIsoDaysFromNow(2)
      patch.follow_up_type = 'call'
      break
    case 'wrong_number':
      break
    default:
      break
  }

  return patch
}

export function activityTextForCallOutcome(
  outcome: SalesCallOutcome,
  notes: string,
): string {
  const labels: Record<SalesCallOutcome, string> = {
    connected: 'Gesprochen',
    callback_requested: 'Rückruf vereinbart',
    voicemail: 'Mailbox',
    no_pickup: 'Nicht erreicht',
    wrong_number: 'Falsche Nummer',
  }
  let text = `☎ ${labels[outcome] ?? outcome}`
  if (notes.trim()) text += ` · ${notes.trim()}`
  return text
}
