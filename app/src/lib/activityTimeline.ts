import type { ActivityType } from './activityTypes'
import { CALL_OUTCOME_OPTIONS, parseCallActivityData } from '../types/callOutcomes'
import type { ActivityEntry, SalesCallLog, SalesCallOutcome } from '../types/db'

export type MergedTimelineEntry = {
  id: string
  type: string
  timestamp: string
  performedBy?: string | null
  performerLabel?: string
  summary: string
  data: Record<string, unknown>
  source: 'legacy' | 'new' | 'email' | 'note'
  /** legacy call outcome label */
  meta?: string
  bodyPreview?: string
  readOnly: boolean
  activityType?: ActivityType
  mailLogId?: string
}

const CALL_OUTCOME_LABELS: Record<SalesCallOutcome, string> = {
  connected: 'Gesprochen',
  no_pickup: 'Nicht erreicht',
  voicemail: 'Mailbox',
  callback_requested: 'Rückruf gewünscht',
  wrong_number: 'Falsche Nummer',
}

function fmtDe(iso: string | undefined | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v != null ? String(v) : ''
}

export function summarizeActivity(entry: ActivityEntry): string {
  const d = entry.data ?? {}
  const t = entry.activity_type
  switch (t) {
    case 'presetting': {
      const termin = str(d.termin_vereinbart) || '—'
      const rawNote = str(d.notizen).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const noteBit = rawNote
        ? ` · ${rawNote.length > 100 ? `${rawNote.slice(0, 100)}…` : rawNote}`
        : ''
      return `Presetting: Termin ${termin}${noteBit}`
    }
    case 'setting':
      return `Setting: ${str(d.termin_stattgefunden) || '—'}${d.closing_termin_vereinbart === 'Ja' && d.closing_termin ? ` · Closing ${fmtDe(str(d.closing_termin))}` : ''}`
    case 'closing':
      return `Closing: ${str(d.ergebnis) || '—'}${d.preis ? ` · ${d.preis} €` : ''}`
    case 'terminierung':
      return `Terminierung: ${str(d.typ) || 'Termin'} ${fmtDe(str(d.termin_datum))}`
    case 'unqualified':
      return `Unqualified: ${str(d.grund) || '—'}`
    case 'noshow':
      return `NoShow/Absage: ${str(d.typ) || '—'}`
    case 'followup':
      return `Follow Up: ${fmtDe(str(d.follow_up_datum))} · ${str(d.kontaktweg) || ''}`
    case 'formular':
      return `Formular: ${str(d.gesendet) || '—'}`
    case 'notiz':
      return str(d.text) || str(d.notizen) || 'Notiz'
    case 'call': {
      const parsed = parseCallActivityData(d as Record<string, unknown>)
      if (!parsed) return 'Anruf'
      const label =
        CALL_OUTCOME_OPTIONS.find((o) => o.value === parsed.outcome)?.label ?? parsed.outcome
      const parts = [`Anruf: ${label}`]
      if (parsed.note?.trim()) parts.push(parsed.note.trim())
      return parts.join(' · ')
    }
    default:
      return String(t)
  }
}

export function normalizeLegacyCall(log: SalesCallLog): MergedTimelineEntry {
  const outcome = CALL_OUTCOME_LABELS[log.outcome] ?? log.outcome
  return {
    id: `legacy:call:${log.id}`,
    type: 'legacy_call',
    timestamp: log.called_at,
    summary: log.notes?.trim() || 'Anruf protokolliert',
    data: { outcome: log.outcome, notes: log.notes },
    source: 'legacy',
    meta: outcome,
    readOnly: true,
  }
}

export function normalizeActivityEntry(
  entry: ActivityEntry,
  performerLabel?: string,
): MergedTimelineEntry {
  return {
    id: `activity:${entry.id}`,
    type: entry.activity_type,
    timestamp: entry.created_at,
    performedBy: entry.performed_by,
    performerLabel,
    summary: summarizeActivity(entry),
    data: (entry.data ?? {}) as Record<string, unknown>,
    source: 'new',
    activityType: entry.activity_type,
    readOnly: false,
  }
}

export function mergeTimelineEntries(
  legacy: SalesCallLog[],
  activities: ActivityEntry[],
  performerMap: Record<string, string>,
  extras: MergedTimelineEntry[] = [],
): MergedTimelineEntry[] {
  const merged = [
    ...legacy.map(normalizeLegacyCall),
    ...activities.map((a) =>
      normalizeActivityEntry(a, a.performed_by ? performerMap[a.performed_by] : undefined),
    ),
    ...extras,
  ]
  return merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export function filterTimeline(
  items: MergedTimelineEntry[],
  filter: import('./activityTypes').TimelineFilter,
): MergedTimelineEntry[] {
  if (filter === 'all') return items
  if (filter === 'wichtig') {
    return items.filter(
      (e) =>
        e.source === 'legacy' ||
        ['closing', 'unqualified', 'noshow', 'terminierung'].includes(e.type) ||
        e.activityType === 'closing' ||
        e.activityType === 'unqualified' ||
        e.activityType === 'noshow' ||
        e.activityType === 'terminierung',
    )
  }
  if (filter === 'gespraeche') {
    return items.filter(
      (e) =>
        e.source === 'legacy' ||
        ['presetting', 'setting', 'closing', 'call'].includes(e.type) ||
        e.activityType === 'presetting' ||
        e.activityType === 'setting' ||
        e.activityType === 'closing' ||
        e.activityType === 'call',
    )
  }
  if (filter === 'notizen') {
    return items.filter(
      (e) =>
        e.type === 'notiz' ||
        e.type === 'legacy_note' ||
        e.activityType === 'notiz' ||
        e.source === 'note' ||
        (e.source === 'legacy' && e.summary.toLowerCase().includes('notiz')),
    )
  }
  return items
}

export function fmtRel(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Date.now() - t
    if (diff < 60_000) return 'gerade eben'
    if (diff < 3_600_000) return `vor ${Math.floor(diff / 60_000)} Min`
    if (diff < 86_400_000) return `vor ${Math.floor(diff / 3_600_000)} h`
    if (diff < 7 * 86_400_000) return `vor ${Math.floor(diff / 86_400_000)} d`
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
