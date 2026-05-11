import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { ModeContextStrip } from '../../components/ModeContextStrip'
import { generateId } from '../../lib/storage'
import { annualEuroForPotenzial, formatEuroDe } from '../../lib/salesPipelineFilters'
import { useCampaigns } from '../../hooks/useCampaigns'
import {
  getDefaultFieldsForTab,
  KNOWN_CONTACT_DB_KEYS,
  useContactFieldConfig,
} from '../../hooks/useContactFieldConfig'
import { readContactsLocal, useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import type { Contact, PipelineStage, PotenzialTyp, SalesFieldItem } from '../../types/db'

const STAGES: PipelineStage[] = [
  'first_contact',
  'conversation',
  'proposal',
  'deal',
  'paused',
]

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

function normalizeWebsiteUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
} as const

function readCfgField(d: Contact, f: SalesFieldItem): string | number | boolean {
  if (KNOWN_CONTACT_DB_KEYS.has(f.db_key)) {
    const v = (d as unknown as Record<string, unknown>)[f.db_key]
    if (typeof v === 'boolean') return v
    if (typeof v === 'number') return v
    if (typeof v === 'string') return v
    return ''
  }
  const cf = d.custom_fields[f.id]
  if (typeof cf === 'boolean') return cf
  if (typeof cf === 'number') return cf
  if (typeof cf === 'string') return cf
  return ''
}

function patchCfgField(
  d: Contact,
  f: SalesFieldItem,
  next: string | number | boolean,
): Partial<Omit<Contact, 'id' | 'brand_id'>> {
  if (KNOWN_CONTACT_DB_KEYS.has(f.db_key)) {
    if (f.db_key === 'abschluss_wahrscheinlichkeit') {
      const n = typeof next === 'number' ? next : Number(next)
      const v = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
      return { abschluss_wahrscheinlichkeit: v }
    }
    return { [f.db_key]: next } as Partial<Omit<Contact, 'id' | 'brand_id'>>
  }
  return {
    custom_fields: {
      ...d.custom_fields,
      [f.id]: next,
    } as Contact['custom_fields'],
  }
}

export function ContactPage() {
  const { slug, contactId } = useParams<{ slug: string; contactId: string }>()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const deliver = useDeliverProjects(slug)
  const pieces = useContentPieces(slug)
  const campaigns = useCampaigns(slug)
  const fieldCfgErst = useContactFieldConfig(slug, 'erstgespraech')
  const fieldCfgQual = useContactFieldConfig(slug, 'qualifikation')
  const [fieldDrawer, setFieldDrawer] = useState<
    null | 'erstgespraech' | 'qualifikation'
  >(null)
  const [editFields, setEditFields] = useState<SalesFieldItem[]>([])

  useEffect(() => {
    if (fieldDrawer === 'erstgespraech') setEditFields([...fieldCfgErst.fields])
    if (fieldDrawer === 'qualifikation') setEditFields([...fieldCfgQual.fields])
  }, [fieldDrawer, fieldCfgErst.fields, fieldCfgQual.fields])

  const activeFieldCfg =
    fieldDrawer === 'erstgespraech'
      ? fieldCfgErst
      : fieldDrawer === 'qualifikation'
        ? fieldCfgQual
        : null

  const contact = useMemo(() => {
    const fromList = contacts.items.find((c) => c.id === contactId) ?? null
    if (fromList) return fromList
    if (!slug || !contactId) return null
    return readContactsLocal(slug).find((c) => c.id === contactId) ?? null
  }, [contacts.items, contactId, slug])

  const [draft, setDraft] = useState<Contact | null>(null)

  useEffect(() => {
    if (contact) setDraft(contact)
  }, [contact])

  const pushPatch = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!contactId || !slug) return
      contacts.update(contactId, patch)
    },
    [contactId, contacts, slug],
  )

  const debouncedPush = useDebouncedCallback(pushPatch, 450)

  const lastCallNotes = useRef('')

  useEffect(() => {
    if (contact) lastCallNotes.current = contact.call_notes ?? ''
  }, [contact?.id, contact?.call_notes])

  const onField = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      setDraft((prev) => {
        const base = prev ?? contact
        if (!base) return null
        return { ...base, ...patch }
      })
      debouncedPush(patch)
    },
    [debouncedPush, contact],
  )

  const [newNote, setNewNote] = useState('')

  const addActivity = useCallback(() => {
    const base = draft ?? contact
    if (!base || !newNote.trim()) return
    const entry = {
      id: generateId(),
      text: newNote.trim(),
      at: new Date().toISOString(),
    }
    const activity_log = [...base.activity_log, entry]
    setNewNote('')
    setDraft({ ...base, activity_log })
    pushPatch({ activity_log })
  }, [contact, draft, newNote, pushPatch])

  const d = draft ?? contact
  const [contactTab, setContactTab] = useState<
    'overview' | 'erstgespraech' | 'qualifikation' | 'notes'
  >('overview')

  const emailKey = useMemo(() => (d?.email ?? '').trim().toLowerCase(), [d?.email])
  const duplicateProject = useMemo(() => {
    if (!emailKey) return null
    return (
      deliver.items.find((p) => (p.client_email ?? '').trim().toLowerCase() === emailKey) ??
      null
    )
  }, [deliver.items, emailKey])
  const previewUrl = d ? normalizeWebsiteUrl(d.website) : ''
  const mailto = d?.email?.trim() ? `mailto:${d.email.trim()}` : ''
  const phoneHref = d ? telHref(d.phone) : ''

  const potenzialAnnualHint = useMemo(() => {
    if (!d) return ''
    const b = d.potenzial_betrag ?? 0
    if (b <= 0) return ''
    const typ = d.potenzial_typ ?? 'einmalig'
    if (typ === 'einmalig') return ''
    const y = annualEuroForPotenzial(b, typ)
    return `= ${formatEuroDe(y)} / Jahr`
  }, [d])

  if (!slug || !contactId) {
    return <Navigate to="/" replace />
  }

  if (!contacts.loading && !contacts.error && !contact) {
    return <Navigate to={`/brand/${slug}/sales`} replace />
  }

  if (contacts.loading && !d) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 400,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (!d) {
    return null
  }

  return (
    <motion.div
      key={contactId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    >
      {slug ? <ModeContextStrip slug={slug} /> : null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={`/brand/${slug}/sales`}
          className="font-mono"
          style={{
            fontSize: 12,
            color: 'var(--mode-sales)',
            textDecoration: 'none',
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-2)',
          }}
        >
          ← Zurück zur Pipeline
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={mailto || undefined}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: mailto ? 'var(--text-primary)' : 'var(--text-tertiary)',
              pointerEvents: mailto ? 'auto' : 'none',
              opacity: mailto ? 1 : 0.45,
            }}
          >
            E-Mail schreiben
          </a>
          <a
            href={phoneHref || undefined}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: phoneHref ? 'var(--text-primary)' : 'var(--text-tertiary)',
              pointerEvents: phoneHref ? 'auto' : 'none',
              opacity: phoneHref ? 1 : 0.45,
            }}
          >
            Anrufen
          </a>
          <a
            href={previewUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: previewUrl ? 'var(--text-primary)' : 'var(--text-tertiary)',
              pointerEvents: previewUrl ? 'auto' : 'none',
              opacity: previewUrl ? 1 : 0.45,
            }}
          >
            Website öffnen
          </a>
        </div>
      </div>

      <div
        className="font-mono mb-2"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--mode-sales)',
        }}
      >
        Sales · Kontakt
      </div>
      <h1
        className="font-display mb-4"
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}
      >
        {d.name || 'Kontakt'}
      </h1>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'overview', label: 'Übersicht' },
            { key: 'erstgespraech', label: 'Erstgespräch', gear: true },
            { key: 'qualifikation', label: 'Qualifikation', gear: true },
            { key: 'notes', label: 'Notes & Log' },
          ] as const
        ).map((t) => {
          const on = contactTab === t.key
          return (
            <div key={t.key} className="flex items-center gap-0.5">
              <button
                type="button"
                className="font-mono"
                onClick={() => setContactTab(t.key)}
                style={{
                  fontSize: 11,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
                  background: on
                    ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
                    : 'var(--glass-2)',
                  color: on ? 'var(--mode-sales)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
              {'gear' in t && t.gear ? (
                <button
                  type="button"
                  className="font-mono"
                  title="Felder anpassen"
                  aria-label="Felder anpassen"
                  onClick={() =>
                    setFieldDrawer(t.key as 'erstgespraech' | 'qualifikation')
                  }
                  style={{
                    fontSize: 14,
                    lineHeight: 1,
                    padding: '4px 6px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  ⚙
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      {contacts.error ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {contacts.error}
        </p>
      ) : null}

      {contactTab === 'overview' ? (
        <div className="flex max-w-4xl flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={d.name}
                  onChange={(e) => onField({ name: e.target.value })}
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  E-Mail
                </label>
                <input
                  type="email"
                  value={d.email}
                  onChange={(e) => onField({ email: e.target.value })}
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Telefon
                </label>
                <input
                  type="tel"
                  value={d.phone}
                  onChange={(e) => onField({ phone: e.target.value })}
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Firma
                </label>
                <input
                  type="text"
                  value={d.company}
                  onChange={(e) => onField({ company: e.target.value })}
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Website
                </label>
                <input
                  type="text"
                  value={d.website}
                  onChange={(e) => onField({ website: e.target.value })}
                  placeholder="https://…"
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Instagram
                </label>
                <input
                  type="text"
                  value={d.instagram}
                  onChange={(e) => onField({ instagram: e.target.value })}
                  placeholder="@handle oder URL"
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  LinkedIn
                </label>
                <input
                  type="text"
                  value={d.linkedin}
                  onChange={(e) => onField({ linkedin: e.target.value })}
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Pipeline-Stage
                </label>
                <select
                  value={d.pipeline_stage}
                  onChange={(e) => onField({ pipeline_stage: e.target.value as PipelineStage })}
                  style={FIELD}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Letzter Kontakt
                </label>
                <input
                  type="date"
                  value={d.last_contact_at ? d.last_contact_at.slice(0, 10) : ''}
                  onChange={(e) =>
                    onField({
                      last_contact_at:
                        e.target.value === '' ? null : new Date(e.target.value).toISOString(),
                    })
                  }
                  style={FIELD}
                />
              </div>
              <div>
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Nächster Follow-up
                </label>
                <input
                  type="date"
                  value={d.next_follow_up_at ? d.next_follow_up_at.slice(0, 10) : ''}
                  onChange={(e) =>
                    onField({
                      next_follow_up_at:
                        e.target.value === '' ? null : new Date(e.target.value).toISOString(),
                    })
                  }
                  style={FIELD}
                />
              </div>
            </div>

            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Quelle — Content-Piece
              </label>
              <select
                value={d.source_content_piece_id ?? ''}
                onChange={(e) =>
                  onField({
                    source_content_piece_id: e.target.value === '' ? null : e.target.value,
                  })
                }
                style={FIELD}
              >
                <option value="">— keine —</option>
                {pieces.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Quelle — Kampagne
              </label>
              <select
                value={d.source_campaign_id ?? ''}
                onChange={(e) =>
                  onField({
                    source_campaign_id: e.target.value === '' ? null : e.target.value,
                  })
                }
                style={FIELD}
              >
                <option value="">— keine —</option>
                {campaigns.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Notizen
              </label>
              <textarea
                value={d.notes}
                onChange={(e) => onField({ notes: e.target.value })}
                rows={5}
                style={{ ...FIELD, resize: 'vertical' }}
              />
            </div>

            {d.pipeline_stage === 'deal' ? (
              <div
                className="rounded-2xl p-4"
                style={{
                  border: '1px solid color-mix(in srgb, var(--accent-teal) 35%, var(--glass-border-2))',
                  background: 'color-mix(in srgb, var(--accent-teal) 8%, var(--glass-1))',
                }}
              >
                <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--accent-teal)' }}>
                  Deliver
                </div>
                {duplicateProject ? (
                  <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Projekt bereits vorhanden.{' '}
                    <Link
                      to={`/brand/${slug}/deliver/${duplicateProject.id}`}
                      style={{ color: 'var(--accent-teal)' }}
                    >
                      Zum Projekt
                    </Link>
                  </p>
                ) : (
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => {
                      if (!slug) return
                      const proj = deliver.create({
                        name: `${d.name || 'Kontakt'} — Projekt`,
                        client_name: d.name || '',
                        client_email: d.email?.trim() ?? '',
                        client_contact_id: d.id,
                        internal_stage: 'onboarding',
                        client_stage: 'onboarding',
                        status: 'active',
                      })
                      navigate(`/brand/${slug}/deliver/${proj.id}`)
                    }}
                    style={{
                      fontSize: 12,
                      padding: '12px 18px',
                      borderRadius: 12,
                      border: 'none',
                      background: 'var(--accent-teal)',
                      color: '#0a0a12',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Projekt erstellen
                  </button>
                )}
              </div>
            ) : null}

            {previewUrl ? (
              <div>
                <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Website-Vorschau
                </div>
                <div
                  className="glass-2 overflow-hidden"
                  style={{
                    borderRadius: 14,
                    border: '1px solid var(--glass-border-1)',
                    height: 320,
                  }}
                >
                  <iframe
                    title="Website preview"
                    src={previewUrl}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="font-mono"
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                fontSize: 11,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--accent-coral)',
                color: 'var(--accent-coral)',
                background: 'transparent',
              }}
              onClick={() => {
                if (!contactId || !slug) return
                contacts.remove(contactId)
                navigate(`/brand/${slug}/sales`)
              }}
            >
              Kontakt löschen
            </button>
        </div>
      ) : contactTab === 'erstgespraech' ? (
        <div className="flex max-w-4xl flex-col gap-4">
          {fieldCfgErst.fields.map((f) => {
            const val = readCfgField(d, f)
            const apply = (next: string | number | boolean) =>
              onField(patchCfgField(d, f, next))
            return (
              <div key={f.id}>
                <label
                  className="font-mono mb-1 block"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  {f.label}
                  {f.required ? ' *' : ''}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={String(val)}
                    onChange={(e) => apply(e.target.value)}
                    rows={6}
                    placeholder={f.placeholder}
                    style={{ ...FIELD, resize: 'vertical', minHeight: 120 }}
                  />
                ) : f.type === 'toggle' ? (
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => apply(!Boolean(val))}
                    style={{
                      fontSize: 11,
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--glass-border-2)',
                      background: val
                        ? 'color-mix(in srgb, var(--mode-sales) 18%, transparent)'
                        : 'var(--glass-2)',
                      color: val ? 'var(--mode-sales)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {val ? 'Ja' : 'Nein'}
                  </button>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={String(val)}
                    onChange={(e) =>
                      apply(
                        f.type === 'number' ? Number(e.target.value) : e.target.value,
                      )
                    }
                    placeholder={f.placeholder}
                    style={FIELD}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : contactTab === 'qualifikation' ? (
        <div className="flex max-w-4xl flex-col gap-4">
          {fieldCfgQual.fields.map((f) => {
            if (f.db_key === 'entscheider_name' && d.ist_entscheider) return null
            const val = readCfgField(d, f)
            const apply = (next: string | number | boolean) =>
              onField(patchCfgField(d, f, next))
            return (
              <div key={f.id}>
                <label
                  className="font-mono mb-1 block"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  {f.label}
                  {f.required ? ' *' : ''}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={String(val)}
                    onChange={(e) => apply(e.target.value)}
                    rows={5}
                    placeholder={f.placeholder}
                    style={{ ...FIELD, resize: 'vertical' }}
                  />
                ) : f.type === 'toggle' ? (
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() => apply(!Boolean(val))}
                    style={{
                      fontSize: 11,
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--glass-border-2)',
                      background: val
                        ? 'color-mix(in srgb, var(--mode-sales) 18%, transparent)'
                        : 'var(--glass-2)',
                      color: val ? 'var(--mode-sales)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {val ? 'Ja' : 'Nein'}
                  </button>
                ) : f.type === 'number' && f.db_key === 'abschluss_wahrscheinlichkeit' ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Number(val)}
                      onChange={(e) => apply(Number(e.target.value))}
                      style={{
                        flex: '1 1 200px',
                        maxWidth: 360,
                        accentColor:
                          Number(val) <= 30
                            ? 'var(--accent-coral)'
                            : Number(val) <= 60
                              ? 'var(--accent-amber)'
                              : '#4ade80',
                      }}
                    />
                    <span
                      className="font-display"
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color:
                          Number(val) <= 30
                            ? 'var(--accent-coral)'
                            : Number(val) <= 60
                              ? 'var(--accent-amber)'
                              : '#4ade80',
                        minWidth: 48,
                      }}
                    >
                      {Number(val)}%
                    </span>
                  </div>
                ) : (
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={String(val)}
                    onChange={(e) =>
                      apply(
                        f.type === 'number' ? Number(e.target.value) : e.target.value,
                      )
                    }
                    placeholder={f.placeholder}
                    style={FIELD}
                  />
                )}
              </div>
            )
          })}
          <div
            className="rounded-2xl p-4"
            style={{
              border: '1px solid color-mix(in srgb, var(--accent-teal) 30%, var(--glass-border-2))',
              background: 'color-mix(in srgb, var(--accent-teal) 6%, var(--glass-1))',
            }}
          >
            <div className="font-mono mb-3" style={{ fontSize: 11, color: 'var(--accent-teal)' }}>
              Potenzial &amp; Umsatz
            </div>
            <div className="mb-3">
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Betrag
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  €
                </span>
                <input
                  type="number"
                  min={0}
                  value={d.potenzial_betrag === 0 ? '' : d.potenzial_betrag}
                  onChange={(e) => {
                    const raw = e.target.value
                    onField({
                      potenzial_betrag:
                        raw === '' ? 0 : Math.max(0, Math.round(Number(raw))),
                    })
                  }}
                  placeholder="0"
                  style={{ ...FIELD, flex: 1 }}
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Typ
              </label>
              <div className="flex flex-wrap gap-2">
                {(['einmalig', 'monatlich', 'jährlich'] as PotenzialTyp[]).map((typ) => {
                  const on = d.potenzial_typ === typ
                  return (
                    <button
                      key={typ}
                      type="button"
                      className="font-mono"
                      onClick={() => onField({ potenzial_typ: typ })}
                      style={{
                        fontSize: 10,
                        padding: '7px 12px',
                        borderRadius: 999,
                        border: on
                          ? '1px solid var(--accent-teal)'
                          : '1px solid var(--glass-border-2)',
                        background: on
                          ? 'color-mix(in srgb, var(--accent-teal) 14%, transparent)'
                          : 'var(--glass-2)',
                        color: on ? 'var(--accent-teal)' : 'var(--text-tertiary)',
                        cursor: 'pointer',
                      }}
                    >
                      {typ === 'einmalig'
                        ? 'Einmalig'
                        : typ === 'monatlich'
                          ? 'Monatlich'
                          : 'Jährlich'}
                    </button>
                  )
                })}
              </div>
            </div>
            {potenzialAnnualHint ? (
              <div
                className="font-mono mb-3"
                style={{ fontSize: 12, color: 'var(--text-secondary)' }}
              >
                {potenzialAnnualHint}
              </div>
            ) : null}
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Notiz
            </label>
            <textarea
              value={d.potenzial_notiz}
              onChange={(e) => onField({ potenzial_notiz: e.target.value })}
              rows={3}
              placeholder="Wie kommt dieser Wert zustande?"
              style={{ ...FIELD, resize: 'vertical' }}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-3">
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Call Notes
            </label>
            <textarea
              value={d.call_notes}
              onChange={(e) => onField({ call_notes: e.target.value })}
              onBlur={() => {
                const v = d.call_notes ?? ''
                if (v === lastCallNotes.current) return
                lastCallNotes.current = v
                const base = draft ?? contact
                if (!base || !contactId) return
                const entry = {
                  id: generateId(),
                  text: 'Call Notes aktualisiert',
                  at: new Date().toISOString(),
                }
                pushPatch({
                  call_notes: v,
                  activity_log: [...base.activity_log, entry],
                })
              }}
              rows={14}
              placeholder="Datum, Themen, Einwände, nächste Schritte..."
              style={{ ...FIELD, resize: 'vertical' }}
            />
          </div>

          <div
            className="glass-2 flex flex-col gap-3"
            style={{
              borderRadius: 16,
              padding: 18,
              border: '1px solid var(--glass-border-1)',
              backdropFilter: 'var(--blur-md)',
              WebkitBackdropFilter: 'var(--blur-md)',
              alignSelf: 'start',
            }}
          >
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Aktivitäts-Log
            </div>
            <div
              className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1"
              style={{ fontSize: 12 }}
            >
              {[...d.activity_log]
                .slice()
                .reverse()
                .map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg p-2"
                    style={{ background: 'var(--glass-1)', border: '1px solid var(--glass-border-2)' }}
                  >
                    <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {new Date(a.at).toLocaleString('de-DE')}
                    </div>
                    <div style={{ color: 'var(--text-primary)', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {a.text}
                    </div>
                  </div>
                ))}
              {d.activity_log.length === 0 ? (
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Noch keine Einträge.
                </span>
              ) : null}
            </div>
            <label className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Neue Notiz hinzufügen
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              placeholder="Notiz…"
              style={{ ...FIELD, resize: 'vertical' }}
            />
            <button
              type="button"
              className="font-mono"
              style={{
                fontSize: 11,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-4)',
                color: 'var(--mode-sales)',
              }}
              onClick={addActivity}
            >
              Notiz speichern
            </button>
          </div>
        </div>
      )}
      <Drawer
        open={fieldDrawer !== null}
        onClose={() => setFieldDrawer(null)}
        title="Felder anpassen"
        width={420}
      >
        {activeFieldCfg ? (
          <div className="flex flex-col gap-3" style={{ pointerEvents: 'auto' }}>
            {editFields.map((f, i) => (
              <div
                key={f.id}
                className="rounded-xl p-3"
                style={{
                  border: '1px solid var(--glass-border-1)',
                  background: 'var(--glass-1)',
                }}
              >
                <div className="mb-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="font-mono"
                    disabled={i === 0}
                    onClick={() => {
                      setEditFields((prev) => {
                        if (i <= 0) return prev
                        const next = [...prev]
                        const a = next[i - 1]!
                        const b = next[i]!
                        next[i - 1] = b
                        next[i] = a
                        return next.map((x, ord) => ({ ...x, order: ord }))
                      })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      opacity: i === 0 ? 0.4 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="font-mono"
                    disabled={i >= editFields.length - 1}
                    onClick={() => {
                      setEditFields((prev) => {
                        if (i >= prev.length - 1) return prev
                        const next = [...prev]
                        const a = next[i]!
                        const b = next[i + 1]!
                        next[i] = b
                        next[i + 1] = a
                        return next.map((x, ord) => ({ ...x, order: ord }))
                      })
                    }}
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--glass-border-2)',
                      opacity: i >= editFields.length - 1 ? 0.4 : 1,
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="font-mono"
                    onClick={() =>
                      setEditFields((prev) =>
                        prev.filter((x) => x.id !== f.id).map((x, ord) => ({ ...x, order: ord })),
                      )
                    }
                    style={{
                      fontSize: 11,
                      marginLeft: 'auto',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--accent-coral)',
                      color: 'var(--accent-coral)',
                      background: 'transparent',
                    }}
                  >
                    Löschen
                  </button>
                </div>
                <label className="font-mono mb-1 block" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  Label
                </label>
                <input
                  value={f.label}
                  onChange={(e) =>
                    setEditFields((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  style={{ ...FIELD, marginBottom: 8 }}
                />
                <label className="font-mono mb-1 block" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  Placeholder
                </label>
                <input
                  value={f.placeholder}
                  onChange={(e) =>
                    setEditFields((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, placeholder: e.target.value } : x)),
                    )
                  }
                  style={{ ...FIELD, marginBottom: 8 }}
                />
                <label className="font-mono mb-1 block" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  Typ
                </label>
                <select
                  value={f.type}
                  onChange={(e) =>
                    setEditFields((prev) =>
                      prev.map((x) =>
                        x.id === f.id
                          ? { ...x, type: e.target.value as SalesFieldItem['type'] }
                          : x,
                      ),
                    )
                  }
                  style={{ ...FIELD, marginBottom: 8 }}
                >
                  <option value="textarea">Text (mehrzeilig)</option>
                  <option value="text">Text</option>
                  <option value="number">Zahl</option>
                  <option value="toggle">Ja / Nein</option>
                </select>
                <label className="font-mono mb-1 block" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                  DB-Schlüssel / Mapping
                </label>
                <input
                  value={f.db_key}
                  onChange={(e) =>
                    setEditFields((prev) =>
                      prev.map((x) => (x.id === f.id ? { ...x, db_key: e.target.value } : x)),
                    )
                  }
                  style={FIELD}
                />
              </div>
            ))}
            <button
              type="button"
              className="font-mono"
              onClick={() =>
                setEditFields((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    label: 'Neues Feld',
                    placeholder: '',
                    type: 'text',
                    required: false,
                    order: prev.length,
                    db_key: `custom_${generateId().slice(0, 8)}`,
                  },
                ])
              }
              style={{
                fontSize: 11,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px dashed var(--mode-sales)',
                color: 'var(--mode-sales)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              + Neues Feld
            </button>
            {activeFieldCfg.error ? (
              <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
                {activeFieldCfg.error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="font-mono"
                onClick={() => {
                  activeFieldCfg.resetToDefaults()
                  if (fieldDrawer) {
                    setEditFields(getDefaultFieldsForTab(fieldDrawer))
                  }
                }}
                style={{
                  fontSize: 11,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-2)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Zurücksetzen
              </button>
              <button
                type="button"
                className="font-mono"
                onClick={() => {
                  void activeFieldCfg.saveFields(editFields)
                  setFieldDrawer(null)
                }}
                style={{
                  fontSize: 11,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </motion.div>
  )
}
