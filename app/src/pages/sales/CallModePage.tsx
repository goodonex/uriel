import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  filterPipelineContacts,
  filtersFromSearchParams,
  potenzialKanbanLabel,
} from '../../lib/salesPipelineFilters'
import { generateId } from '../../lib/storage'
import {
  KNOWN_CONTACT_DB_KEYS,
  useContactFieldConfig,
} from '../../hooks/useContactFieldConfig'
import { useContactListItems, useContactLists } from '../../hooks/useContactLists'
import { useContacts } from '../../hooks/useContacts'
import type { Contact, ContactListItem, PipelineStage, SalesFieldItem } from '../../types/db'

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

function formatCallDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

function readFieldValue(c: Contact, f: SalesFieldItem): string | number | boolean {
  if (KNOWN_CONTACT_DB_KEYS.has(f.db_key)) {
    const v = (c as unknown as Record<string, unknown>)[f.db_key]
    if (typeof v === 'boolean') return v
    if (typeof v === 'number') return v
    if (typeof v === 'string') return v
    return ''
  }
  const cf = c.custom_fields[f.id]
  if (typeof cf === 'boolean') return cf
  if (typeof cf === 'number') return cf
  if (typeof cf === 'string') return cf
  return ''
}

type ModeRow =
  | { kind: 'contact'; contact: Contact }
  | { kind: 'list'; item: ContactListItem; contact: Contact | null }

export function CallModePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const source = searchParams.get('source') === 'list' ? 'list' : 'pipeline'
  const listId = searchParams.get('listId') ?? ''

  const contacts = useContacts(slug)
  const { lists } = useContactLists(slug)
  const {
    items: listItems,
    loading: listLoading,
    updateItem,
  } = useContactListItems(source === 'list' ? listId : undefined, slug)

  const { fields: scriptFields } = useContactFieldConfig(slug, 'erstgespraech')

  const pipelineFiltered = useMemo(() => {
    const f = filtersFromSearchParams(searchParams)
    return filterPipelineContacts(contacts.items, f)
  }, [contacts.items, searchParams])

  const rows: ModeRow[] = useMemo(() => {
    if (source === 'list' && listId) {
      return listItems.map((item) => {
        const em = (item.email ?? '').trim().toLowerCase()
        const hit =
          em.length > 0
            ? contacts.items.find((c) => (c.email ?? '').trim().toLowerCase() === em) ?? null
            : null
        return { kind: 'list' as const, item, contact: hit }
      })
    }
    return pipelineFiltered.map((c) => ({ kind: 'contact' as const, contact: c }))
  }, [contacts.items, listId, listItems, pipelineFiltered, source])

  const activeListName = useMemo(
    () => lists.find((l) => l.id === listId)?.name ?? 'Liste',
    [listId, lists],
  )

  const [idx, setIdx] = useState(0)
  const [orphanDraft, setOrphanDraft] = useState<Partial<Contact>>({})
  const startedAtRef = useRef<number>(Date.now())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [idx])

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, rows.length - 1))
  const row = rows[safeIdx] ?? null

  const resolvedContact = row
    ? row.kind === 'contact'
      ? row.contact
      : row.contact
    : null
  const listItem = row?.kind === 'list' ? row.item : null

  useEffect(() => {
    setOrphanDraft({})
  }, [safeIdx, row?.kind, listItem?.id])

  const elapsedSec = useMemo(() => {
    if (!row) return 0
    void tick
    return Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
  }, [row, tick])

  const backTo = slug
    ? source === 'list'
      ? `/brand/${slug}/sales/lists/${listId}`
      : `/brand/${slug}/sales`
    : '/'

  const appendLog = useCallback(
    (contactId: string, text: string) => {
      const c = contacts.items.find((x) => x.id === contactId)
      if (!c) return
      const entry = { id: generateId(), text, at: new Date().toISOString() }
      contacts.update(contactId, { activity_log: [...c.activity_log, entry] })
    },
    [contacts],
  )

  const flushFieldPatches = useCallback(
    (target: Contact, extra?: Partial<Contact>) => {
      const base: Partial<Contact> = { ...extra }
      const cfPatch: Record<string, string | number | boolean> = {
        ...target.custom_fields,
      }
      for (const f of scriptFields) {
        const v = readFieldValue({ ...target, ...orphanDraft }, f)
        if (KNOWN_CONTACT_DB_KEYS.has(f.db_key)) {
          ;(base as unknown as Record<string, unknown>)[f.db_key] = v
        } else {
          cfPatch[f.id] = v
        }
      }
      if (Object.keys(cfPatch).length > 0) {
        base.custom_fields = cfPatch as Contact['custom_fields']
      }
      contacts.update(target.id, base)
    },
    [contacts, orphanDraft, scriptFields],
  )

  const ensureListContact = useCallback(
    (item: ContactListItem): Contact => {
      const existing =
        (item.email ?? '').trim().length > 0
          ? contacts.items.find(
              (c) =>
                (c.email ?? '').trim().toLowerCase() ===
                (item.email ?? '').trim().toLowerCase(),
            )
          : null
      if (existing) return existing
      const r = contacts.create(
        {
          name: item.name || 'Lead',
          email: item.email ?? '',
          phone: item.phone ?? '',
          company: item.company ?? '',
          linkedin: item.linkedin_url ?? '',
          pipeline_stage: 'first_contact',
          notes: item.notes ?? '',
          ...orphanDraft,
        },
        { skipDuplicateCheck: true },
      )
      if (!r.ok) {
        return r.duplicate
      }
      return r.contact
    },
    [contacts, orphanDraft],
  )

  const afterActionNext = useCallback(() => {
    if (rows.length === 0) return
    if (safeIdx >= rows.length - 1) {
      startedAtRef.current = Date.now()
      setIdx(0)
    } else {
      startedAtRef.current = Date.now()
      setIdx((i) => i + 1)
    }
  }, [rows.length, safeIdx])

  const logElapsedFor = useCallback(
    (contactId: string) => {
      const sec = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
      if (sec >= 1) {
        appendLog(contactId, `📞 Call — ${formatCallDuration(sec)} min`)
      }
    },
    [appendLog],
  )

  const onErreicht = useCallback(() => {
    if (!row) return
    if (row.kind === 'contact') {
      logElapsedFor(row.contact.id)
      flushFieldPatches(row.contact, { pipeline_stage: 'conversation' })
    } else {
      const c = ensureListContact(row.item)
      logElapsedFor(c.id)
      flushFieldPatches(c, { pipeline_stage: 'conversation' })
      void updateItem(row.item.id, { status: 'in_pipeline', called_at: new Date().toISOString() })
    }
    afterActionNext()
  }, [afterActionNext, ensureListContact, flushFieldPatches, logElapsedFor, row, updateItem])

  const onNichtErreicht = useCallback(() => {
    if (!row) return
    if (row.kind === 'contact') {
      logElapsedFor(row.contact.id)
      const c = row.contact
      const entry = { id: generateId(), text: 'Kein Anschluss', at: new Date().toISOString() }
      contacts.update(c.id, {
        next_follow_up_at: addDaysIso(2),
        activity_log: [...c.activity_log, entry],
      })
    } else {
      const c = ensureListContact(row.item)
      logElapsedFor(c.id)
      const entry = { id: generateId(), text: 'Kein Anschluss', at: new Date().toISOString() }
      contacts.update(c.id, {
        next_follow_up_at: addDaysIso(2),
        activity_log: [...c.activity_log, entry],
      })
      void updateItem(row.item.id, { called_at: new Date().toISOString() })
    }
    afterActionNext()
  }, [afterActionNext, contacts, ensureListContact, logElapsedFor, row, updateItem])

  const onKeinInteresse = useCallback(() => {
    if (!row) return
    if (row.kind === 'contact') {
      logElapsedFor(row.contact.id)
      flushFieldPatches(row.contact, { pipeline_stage: 'paused' })
    } else {
      const c = ensureListContact(row.item)
      logElapsedFor(c.id)
      flushFieldPatches(c, { pipeline_stage: 'paused' })
      void updateItem(row.item.id, { status: 'kein_interesse' })
    }
    afterActionNext()
  }, [afterActionNext, ensureListContact, flushFieldPatches, logElapsedFor, row, updateItem])

  const onDeal = useCallback(() => {
    if (!row) return
    if (row.kind === 'contact') {
      logElapsedFor(row.contact.id)
      flushFieldPatches(row.contact, { pipeline_stage: 'deal' })
    } else {
      const c = ensureListContact(row.item)
      logElapsedFor(c.id)
      flushFieldPatches(c, { pipeline_stage: 'deal' })
      void updateItem(row.item.id, { status: 'in_pipeline' })
    }
    afterActionNext()
  }, [afterActionNext, ensureListContact, flushFieldPatches, logElapsedFor, row, updateItem])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        navigate(backTo)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [backTo, navigate])

  if (!slug) {
    return null
  }

  const loading =
    contacts.loading || (source === 'list' && listLoading) || (source === 'list' && !listId)

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          borderRadius: 0,
          background: '#050508',
          pointerEvents: 'auto',
        }}
      />
    )
  }

  const displayName =
    resolvedContact?.name?.trim() ||
    listItem?.name?.trim() ||
    resolvedContact?.email?.trim() ||
    listItem?.email?.trim() ||
    'Unbenannt'
  const displayCompany =
    resolvedContact?.company?.trim() || listItem?.company?.trim() || '—'
  const displayPhone = resolvedContact?.phone?.trim() || listItem?.phone?.trim() || ''
  const stage: PipelineStage = resolvedContact?.pipeline_stage ?? 'first_contact'
  const potLabel = resolvedContact ? potenzialKanbanLabel(resolvedContact) : null

  const baseContact: Contact | null = resolvedContact

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: '#050508',
        color: 'var(--text-primary)',
        pointerEvents: 'auto',
        overflow: 'auto',
        fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '20px 20px 48px',
          minHeight: '100%',
        }}
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Kontakt {rows.length === 0 ? 0 : safeIdx + 1} von {rows.length}
            {source === 'list' ? ` — Liste: ${activeListName}` : ' — Pipeline (gefiltert)'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="font-mono"
              onClick={() => navigate(backTo)}
              style={{
                fontSize: 11,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              ESC · Schließen
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="font-mono" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Keine Kontakte für diesen Modus.{' '}
            <Link to={backTo} style={{ color: 'var(--mode-sales)' }}>
              Zurück
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr_1fr]">
              <div
                className="glass-2"
                style={{
                  borderRadius: 16,
                  padding: 16,
                  border: '1px solid var(--glass-border-1)',
                  alignSelf: 'start',
                }}
              >
                <div className="font-mono mb-3" style={{ fontSize: 10, color: 'var(--mode-sales)' }}>
                  Skript / Felder
                </div>
                <div className="flex flex-col gap-3">
                  {scriptFields.map((f) => {
                    const effective = baseContact
                      ? baseContact
                      : ({
                          ...({
                            id: '',
                            brand_id: '',
                            name: listItem?.name ?? '',
                            email: listItem?.email ?? '',
                            phone: listItem?.phone ?? '',
                            company: listItem?.company ?? '',
                            website: '',
                            instagram: '',
                            linkedin: listItem?.linkedin_url ?? '',
                            source_content_piece_id: null,
                            source_campaign_id: null,
                            pipeline_stage: 'first_contact',
                            last_contact_at: null,
                            next_follow_up_at: null,
                            notes: listItem?.notes ?? '',
                            call_notes: '',
                            activity_log: [],
                            bedarf: '',
                            ansprechpartner: '',
                            aktuelle_situation: '',
                            hauptproblem: '',
                            timeline: '',
                            budget: '',
                            ist_entscheider: false,
                            entscheider_name: '',
                            einwaende: '',
                            naechste_schritte: '',
                            abschluss_wahrscheinlichkeit: 0,
                            potenzial_betrag: 0,
                            potenzial_typ: 'einmalig',
                            potenzial_notiz: '',
                            custom_fields: {},
                            updated_at: new Date().toISOString(),
                          } as Contact),
                          ...orphanDraft,
                        } as Contact)
                    const val = readFieldValue(effective, f)
                    const setVal = (next: string | number | boolean) => {
                      if (baseContact) {
                        if (KNOWN_CONTACT_DB_KEYS.has(f.db_key)) {
                          contacts.update(baseContact.id, {
                            [f.db_key]: next,
                          } as Partial<Contact>)
                        } else {
                          contacts.update(baseContact.id, {
                            custom_fields: {
                              ...baseContact.custom_fields,
                              [f.id]: next,
                            },
                          })
                        }
                      } else {
                        if (KNOWN_CONTACT_DB_KEYS.has(f.db_key)) {
                          setOrphanDraft((p) => ({ ...p, [f.db_key]: next as never }))
                        } else {
                          setOrphanDraft((p) => ({
                            ...p,
                            custom_fields: {
                              ...(p.custom_fields ?? {}),
                              [f.id]: next,
                            } as Contact['custom_fields'],
                          }))
                        }
                      }
                    }
                    return (
                      <label key={f.id} className="flex flex-col gap-1">
                        <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                          {f.label}
                          {f.required ? ' *' : ''}
                        </span>
                        {f.type === 'textarea' ? (
                          <textarea
                            value={String(val)}
                            onChange={(e) => setVal(e.target.value)}
                            rows={3}
                            placeholder={f.placeholder}
                            className="font-mono"
                            style={{
                              fontSize: 12,
                              padding: 8,
                              borderRadius: 8,
                              border: '1px solid var(--glass-border-1)',
                              background: 'var(--glass-1)',
                              color: 'var(--text-primary)',
                              resize: 'vertical' as const,
                            }}
                          />
                        ) : f.type === 'toggle' ? (
                          <button
                            type="button"
                            className="font-mono"
                            onClick={() => setVal(!Boolean(val))}
                            style={{
                              alignSelf: 'flex-start',
                              fontSize: 11,
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--glass-border-2)',
                              background: val
                                ? 'color-mix(in srgb, var(--mode-sales) 18%, transparent)'
                                : 'var(--glass-2)',
                              color: val ? 'var(--mode-sales)' : 'var(--text-secondary)',
                            }}
                          >
                            {val ? 'Ja' : 'Nein'}
                          </button>
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={String(val)}
                            onChange={(e) =>
                              setVal(
                                f.type === 'number'
                                  ? Number(e.target.value)
                                  : e.target.value,
                              )
                            }
                            placeholder={f.placeholder}
                            className="font-mono"
                            style={{
                              fontSize: 12,
                              padding: 8,
                              borderRadius: 8,
                              border: '1px solid var(--glass-border-1)',
                              background: 'var(--glass-1)',
                              color: 'var(--text-primary)',
                            }}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              <div
                className="glass-2 flex flex-col items-center text-center"
                style={{
                  borderRadius: 20,
                  padding: 28,
                  border: '1px solid var(--glass-border-1)',
                }}
              >
                <div
                  className="font-display"
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.15,
                  }}
                >
                  {displayName}
                </div>
                <div
                  className="font-mono mt-3"
                  style={{ fontSize: 14, color: 'var(--text-secondary)' }}
                >
                  {displayCompany}
                  {displayPhone ? (
                    <>
                      {' '}
                      ·{' '}
                      <a href={`tel:${displayPhone.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--accent-blue)' }}>
                        {displayPhone}
                      </a>
                    </>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid var(--glass-border-2)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {STAGE_LABEL[stage]}
                  </span>
                  {potLabel ? (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        padding: '6px 12px',
                        borderRadius: 999,
                        color: 'var(--accent-teal)',
                        border: '1px solid color-mix(in srgb, var(--accent-teal) 45%, transparent)',
                        background: 'color-mix(in srgb, var(--accent-teal) 10%, transparent)',
                      }}
                    >
                      {potLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="font-mono" style={{ fontSize: 10, color: 'var(--mode-sales)' }}>
                  Schnell-Aktionen
                </div>
                {(
                  [
                    { label: '✓ Erreicht — weiter', onClick: onErreicht, border: 'var(--accent-teal)' },
                    { label: '📞 Nicht erreicht', onClick: onNichtErreicht, border: 'var(--accent-amber)' },
                    { label: '✗ Kein Interesse', onClick: onKeinInteresse, border: 'var(--accent-coral)' },
                    { label: '⭐ Deal!', onClick: onDeal, border: '#4ade80' },
                  ] as const
                ).map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    className="font-mono"
                    onClick={b.onClick}
                    style={{
                      fontSize: 13,
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: `1px solid ${b.border}`,
                      background: 'var(--glass-2)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left' as const,
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="font-mono"
                  disabled={safeIdx <= 0}
                  onClick={() => {
                    startedAtRef.current = Date.now()
                    setIdx((i) => Math.max(0, i - 1))
                  }}
                  style={{
                    fontSize: 12,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--glass-border-2)',
                    background: 'var(--glass-2)',
                    color: 'var(--text-primary)',
                    opacity: safeIdx <= 0 ? 0.4 : 1,
                  }}
                >
                  ← Vorheriger
                </button>
                <button
                  type="button"
                  className="font-mono"
                  disabled={safeIdx >= rows.length - 1}
                  onClick={() => {
                    startedAtRef.current = Date.now()
                    setIdx((i) => Math.min(rows.length - 1, i + 1))
                  }}
                  style={{
                    fontSize: 12,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--glass-border-2)',
                    background: 'var(--glass-2)',
                    color: 'var(--text-primary)',
                    opacity: safeIdx >= rows.length - 1 ? 0.4 : 1,
                  }}
                >
                  Nächster →
                </button>
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: 20,
                  letterSpacing: '0.04em',
                  color: 'var(--text-secondary)',
                }}
              >
                Call · {formatCallDuration(elapsedSec)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
