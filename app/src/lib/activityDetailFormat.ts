import type { ActivityType } from './activityTypes'
import { CALL_OUTCOME_OPTIONS, parseCallActivityData } from '../types/callOutcomes'

export type ActivityDetailRow = { label: string; value: string }

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v != null && v !== '' ? String(v).trim() : ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function fmtDateTime(v: unknown): string {
  const s = str(v)
  if (!s) return ''
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return s
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

function row(label: string, value: unknown, opts?: { html?: boolean }): ActivityDetailRow | null {
  let text = str(value)
  if (!text && typeof value === 'number') text = String(value)
  if (!text) return null
  if (opts?.html || text.includes('<')) text = stripHtml(text)
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const formatted = fmtDateTime(text)
    if (formatted) text = formatted
  }
  return { label, value: text }
}

const NEXT_ACTION_LABELS: Record<string, string> = {
  call: 'Anruf',
  brief_task: 'Brief',
  task: 'Task',
  reminder: 'Wiedervorlage',
  blocklist: 'Sperrliste',
}

export function formatActivityDetails(
  activityType: ActivityType | string | undefined,
  data: Record<string, unknown>,
): ActivityDetailRow[] {
  const d = data
  const t = activityType ?? ''

  switch (t) {
    case 'presetting':
      return [
        row('Termin vereinbart', d.termin_vereinbart),
        row('Notizen', d.notizen, { html: true }),
        row('Ziel der Investition', d.ziel_investition),
        row('Herausforderungen', d.herausforderungen),
        row('Erneut versuchen ab', d.retry_at),
        row('Grund / Ziel Nachfassen', d.nachfassen_grund),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'setting':
      return [
        row('Termin stattgefunden', d.termin_stattgefunden),
        row('Notizen', d.notizen, { html: true }),
        row('Ziel der Investition', d.ziel_investition),
        row('Nettoeinkommen (€)', d.nettoeinkommen),
        row('Eigenkapital (€)', d.eigenkapital),
        row('Monatliche Rate (€)', d.monatliche_rate),
        row('Interesse an', d.interesse_an),
        row('Closing Termin vereinbart', d.closing_termin_vereinbart),
        row('Closing Termin', d.closing_termin),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'closing':
      return [
        row('Ergebnis', d.ergebnis),
        row('Notizen', d.notizen, { html: true }),
        row('Preis (€)', d.preis),
        row('Grund Kauf', d.grund_kauf),
        row('Grund Nicht-Kauf', d.grund_nicht_kauf),
        row('Follow-up', d.follow_up_datum),
        row('Grund / Ziel Nachfassen', d.nachfassen_grund),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'terminierung':
      return [
        row('Typ', d.typ),
        row('Terminiert von', d.terminiert_von),
        row('Termin mit', d.termin_mit),
        row('Termin', d.termin_datum),
        row('Notiz', d.notiz),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'unqualified':
      return [row('Grund', d.grund)].filter((r): r is ActivityDetailRow => r != null)

    case 'noshow':
      return [
        row('Typ', d.typ),
        row('Mail senden', d.mail_senden),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'followup':
      return [
        row('Follow-up', d.follow_up_datum),
        row('Kontaktweg', d.kontaktweg),
        row('Notizen', d.notizen, { html: true }),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'formular':
      return [row('Gesendet', d.gesendet)].filter((r): r is ActivityDetailRow => r != null)

    case 'notiz':
      return [
        row('Notiz', d.text || d.notizen, { html: true }),
      ].filter((r): r is ActivityDetailRow => r != null)

    case 'call': {
      const parsed = parseCallActivityData(d)
      if (!parsed) return []
      const outcomeLabel =
        CALL_OUTCOME_OPTIONS.find((o) => o.value === parsed.outcome)?.label ?? parsed.outcome
      const rows: ActivityDetailRow[] = [{ label: 'Ergebnis', value: outcomeLabel }]
      if (parsed.note?.trim()) rows.push({ label: 'Notiz', value: parsed.note.trim() })
      const na = parsed.next_action
      rows.push({
        label: 'Nächster Schritt',
        value: NEXT_ACTION_LABELS[na.type] ?? na.type,
      })
      if (na.due_at) rows.push({ label: 'Geplant für', value: fmtDateTime(na.due_at) })
      if (na.title?.trim()) rows.push({ label: 'Titel', value: na.title.trim() })
      return rows
    }

    case 'legacy_call':
      return [
        row('Ergebnis', d.outcome),
        row('Notiz', d.notes),
      ].filter((r): r is ActivityDetailRow => r != null)

    default:
      return Object.entries(d)
        .map(([key, value]) => row(key.replace(/_/g, ' '), value))
        .filter((r): r is ActivityDetailRow => r != null)
  }
}

export function hasActivityDetails(
  activityType: ActivityType | string | undefined,
  data: Record<string, unknown>,
): boolean {
  return formatActivityDetails(activityType, data).length > 0
}
