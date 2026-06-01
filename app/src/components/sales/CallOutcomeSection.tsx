import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useActivityEntries } from '../../hooks/useActivityEntries'
import { useContacts } from '../../hooks/useContacts'
import { useMeetingLinks } from '../../hooks/useSalesPro'
import { useTasks } from '../../hooks/useTasks'
import {
  getSuggestedNextAction,
  suggestedToNextAction,
  type SuggestedNextAction,
} from '../../lib/callSequencer/getSuggestedNextAction'
import {
  CALL_LOG_OUTCOME_OPTIONS,
  CALL_OUTCOME_OPTIONS,
  parseCallActivityData,
  type CallActivityData,
  type CallNextAction,
  type CallOutcome,
} from '../../types/callOutcomes'
import type { Contact } from '../../types/db'
import { useToast } from '../Toast'

const MODAL_BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  background: 'rgba(6, 6, 16, 0.82)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  pointerEvents: 'auto',
}

const MODAL_PANEL: CSSProperties = {
  width: 'min(480px, 100%)',
  maxHeight: 'min(90vh, 720px)',
  overflowY: 'auto',
  borderRadius: 16,
  border: '1px solid var(--glass-border-2)',
  padding: 18,
  background: '#12121f',
  boxShadow: '0 28px 64px rgba(0, 0, 0, 0.72)',
}

const FIELD_SOLID: CSSProperties = {
  border: '1px solid var(--glass-border-2)',
  background: '#1a1a2e',
  color: 'var(--text-primary)',
}

const ACTION_TYPES: Array<{ value: CallNextAction['type']; label: string }> = [
  { value: 'call', label: 'Anruf' },
  { value: 'brief_task', label: 'Brief' },
  { value: 'task', label: 'Task' },
  { value: 'reminder', label: 'Wiedervorlage' },
  { value: 'blocklist', label: 'Sperrliste' },
]

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  } catch {
    return ''
  }
}

function dateInputToIso(ymd: string, hour = 10): string | null {
  if (!ymd.trim()) return null
  const d = new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function atTodayHour(hour: number): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  return d.toISOString()
}

function atDaysFromNow(days: number, hour = 10): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const FOLLOW_UP_PRESETS: ReadonlyArray<{ label: string; due_at: string }> = [
  { label: 'Heute Nachm.', due_at: atTodayHour(14) },
  { label: 'Morgen', due_at: atDaysFromNow(1, 10) },
  { label: 'In 2–3 Tagen', due_at: atDaysFromNow(3, 10) },
]

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

export function CallOutcomeSection({
  brandSlug,
  contact,
  onField,
  onTimelineRefresh,
  open: controlledOpen,
  onOpenChange,
}: {
  brandSlug: string
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  onTimelineRefresh?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const activities = useActivityEntries(brandSlug, { contactId: contact.id })
  const contacts = useContacts(brandSlug)
  const tasks = useTasks(brandSlug)
  const meetingLinks = useMeetingLinks(brandSlug)
  const { show } = useToast()

  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const overlayOpen = isControlled ? controlledOpen : internalOpen
  const setOverlayOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }

  const [outcome, setOutcome] = useState<CallOutcome>('not_reached')
  const [note, setNote] = useState('')
  const [draftAction, setDraftAction] = useState<SuggestedNextAction | null>(null)
  const [busy, setBusy] = useState(false)

  const callCount = useMemo(
    () => activities.items.filter((e) => e.activity_type === 'call').length,
    [activities.items],
  )

  const lastCall = useMemo(() => {
    const entry = activities.items.find((e) => e.activity_type === 'call')
    if (!entry) return null
    return parseCallActivityData(entry.data as Record<string, unknown>)
  }, [activities.items])

  const resetOverlay = () => {
    setOutcome('not_reached')
    setNote('')
    setDraftAction(getSuggestedNextAction('not_reached', callCount))
  }

  useEffect(() => {
    if (!overlayOpen) return
    setDraftAction(getSuggestedNextAction(outcome, callCount))
  }, [overlayOpen, outcome, callCount])

  useEffect(() => {
    if (!overlayOpen) return
    resetOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpen])

  const openOverlay = () => {
    resetOverlay()
    setOverlayOpen(true)
  }

  const applyFollowUpPreset = (due_at: string) => {
    setDraftAction((d) => {
      if (!d) return d
      const when = fmtWhen(due_at)
      return {
        ...d,
        type: d.type === 'blocklist' ? 'call' : d.type,
        due_at,
        label: `Erneut anrufen: ${when}`,
        title: d.title ?? 'Erneut anrufen',
      }
    })
  }

  const showFollowUpPresets =
    outcome !== 'no_interest' &&
    draftAction &&
    (draftAction.type === 'call' || draftAction.type === 'reminder')

  const confirm = async () => {
    if (!draftAction) return
    setBusy(true)
    try {
      const nextAction = suggestedToNextAction(draftAction)
      const data: CallActivityData = {
        outcome,
        note: note.trim() || undefined,
        next_action: nextAction,
      }

      const created = await activities.create({
        contact_id: contact.id,
        activity_type: 'call',
        data: data as unknown as Record<string, unknown>,
      })
      if (!created.entry) {
        show(created.error ?? 'Outcome konnte nicht gespeichert werden', 'error')
        return
      }

      const patch: Partial<Contact> = {
        last_contact_at: new Date().toISOString(),
      }
      if (nextAction.pipeline_stage) patch.pipeline_stage = nextAction.pipeline_stage
      if (nextAction.type === 'call' && nextAction.due_at) {
        patch.next_follow_up_at = nextAction.due_at
        patch.follow_up_type = 'call'
      }
      if (nextAction.type === 'reminder' && nextAction.due_at) {
        patch.next_follow_up_at = nextAction.due_at
        patch.follow_up_type = 'call'
      }
      if (nextAction.type === 'blocklist') {
        patch.contact_status = 'unqualified'
      }
      contacts.update(contact.id, patch)
      onField(patch)

      if (nextAction.type === 'task' || nextAction.type === 'brief_task' || nextAction.type === 'reminder') {
        tasks.create({
          title: nextAction.title ?? draftAction.label,
          due_at: nextAction.due_at ?? null,
          contact_id: contact.id,
          priority: nextAction.type === 'brief_task' ? 1 : 2,
          source: nextAction.type === 'brief_task' ? 'brief_task' : 'system',
        })
      }
      if (draftAction.include_brief) {
        tasks.create({
          title: 'Brief vorbereiten',
          due_at: nextAction.due_at ?? null,
          contact_id: contact.id,
          priority: 1,
          source: 'brief_task',
        })
      }

      if (nextAction.open_calendar) {
        const link = meetingLinks.items.find((l) => l.is_active) ?? meetingLinks.items[0]
        if (link?.slug) {
          const url = `${window.location.origin}/book/${brandSlug}/${link.slug}`
          window.open(url, '_blank', 'noopener,noreferrer')
        } else {
          show('Kein aktiver Buchungslink — unter Sales konfigurieren', 'info')
        }
      }

      show('Anruf-Outcome gespeichert', 'success')
      setOverlayOpen(false)
      onTimelineRefresh?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section
        style={{
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-1)',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            color: 'var(--text-tertiary)',
            marginBottom: 8,
          }}
        >
          LETZTER ANRUF
        </div>
        {lastCall ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            {CALL_OUTCOME_OPTIONS.find((o) => o.value === lastCall.outcome)?.label ?? lastCall.outcome}
            {lastCall.note ? ` · ${lastCall.note}` : ''}
          </p>
        ) : (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
            Noch kein Outcome erfasst ({callCount} Anrufe in Timeline)
          </p>
        )}
        <button
          type="button"
          onClick={openOverlay}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--mode-sales)',
            background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
            fontWeight: 600,
            width: '100%',
          }}
        >
          Anruf protokollieren
        </button>
      </section>

      {overlayOpen && draftAction
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="call-outcome-dialog-title"
              style={MODAL_BACKDROP}
              onClick={() => !busy && setOverlayOpen(false)}
            >
              <div className="font-mono" style={MODAL_PANEL} onClick={(e) => e.stopPropagation()}>
            <h3
              id="call-outcome-dialog-title"
              className="font-display"
              style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--text-primary)' }}
            >
              Anruf protokollieren
            </h3>
            <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '0 0 14px' }}>
              Für Anrufe ohne Gespräch. Gespräch mit Kontakt → Presetting oder Closing unter Aktivität.
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                ERGEBNIS
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 6,
                }}
              >
                {CALL_LOG_OUTCOME_OPTIONS.map((o) => {
                  const on = outcome === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setOutcome(o.value)}
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: on
                          ? '1px solid var(--mode-sales)'
                          : '1px solid var(--glass-border-2)',
                        background: on
                          ? 'color-mix(in srgb, var(--mode-sales) 22%, #1a1a2e)'
                          : '#1a1a2e',
                        color: on ? 'var(--mode-sales)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                NOTIZ (OPTIONAL)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Kurznotiz …"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  fontSize: 12,
                  borderRadius: 8,
                  ...FIELD_SOLID,
                  resize: 'vertical',
                }}
              />
            </div>

            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--mode-sales) 35%, var(--glass-border-2))',
                background: 'color-mix(in srgb, var(--mode-sales) 12%, #1a1a2e)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--mode-sales)', marginBottom: 10, fontWeight: 600 }}>
                {draftAction.label}
              </div>
              {showFollowUpPresets ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                    WANN NOCHMAL?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {FOLLOW_UP_PRESETS.map((p) => {
                      const active = draftAction.due_at === p.due_at
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => applyFollowUpPreset(p.due_at)}
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            padding: '6px 10px',
                            borderRadius: 999,
                            border: active
                              ? '1px solid var(--mode-sales)'
                              : '1px solid var(--glass-border-2)',
                            background: active
                              ? 'color-mix(in srgb, var(--mode-sales) 22%, #1a1a2e)'
                              : '#1a1a2e',
                            color: active ? 'var(--mode-sales)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  Aktion
                  <select
                    value={draftAction.type}
                    onChange={(e) =>
                      setDraftAction((d) =>
                        d
                          ? {
                              ...d,
                              type: e.target.value as CallNextAction['type'],
                              label:
                                ACTION_TYPES.find((t) => t.value === e.target.value)?.label ??
                                d.label,
                            }
                          : d,
                      )
                    }
                    style={{
                      display: 'block',
                      width: '100%',
                      marginTop: 4,
                      padding: '6px 8px',
                      fontSize: 12,
                      borderRadius: 8,
                      ...FIELD_SOLID,
                    }}
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {(draftAction.type === 'call' ||
                  draftAction.type === 'task' ||
                  draftAction.type === 'brief_task' ||
                  draftAction.type === 'reminder') && (
                  <label style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                    Datum
                    <input
                      type="date"
                      value={toDateInput(draftAction.due_at)}
                      onChange={(e) =>
                        setDraftAction((d) =>
                          d
                            ? {
                                ...d,
                                due_at: dateInputToIso(e.target.value),
                                label: d.label.replace(
                                  /\d{1,2}\.\s?\w{3,}/,
                                  new Date(e.target.value).toLocaleDateString('de-DE', {
                                    day: '2-digit',
                                    month: 'short',
                                  }),
                                ),
                              }
                            : d,
                        )
                      }
                      style={{
                        display: 'block',
                        width: '100%',
                        marginTop: 4,
                        padding: '6px 8px',
                        fontSize: 12,
                        borderRadius: 8,
                        ...FIELD_SOLID,
                      }}
                    />
                  </label>
                )}
                {draftAction.due_at ? (
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    Geplant: {fmtWhen(draftAction.due_at)}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOverlayOpen(false)}
                style={{
                  fontSize: 12,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: '#1a1a2e',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                style={{
                  fontSize: 12,
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 28%, #1a1a2e)',
                  color: 'var(--mode-sales)',
                  fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer',
                }}
              >
                {busy ? 'Speichert …' : 'Bestätigen'}
              </button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
