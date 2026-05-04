import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { generateId } from '../../lib/storage'
import { useCampaigns } from '../../hooks/useCampaigns'
import { readContactsLocal, useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { Contact, PipelineStage } from '../../types/db'

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

export function ContactPage() {
  const { slug, contactId } = useParams<{ slug: string; contactId: string }>()
  const navigate = useNavigate()
  const contacts = useContacts(slug)
  const pieces = useContentPieces(slug)
  const campaigns = useCampaigns(slug)

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
  const previewUrl = d ? normalizeWebsiteUrl(d.website) : ''
  const mailto = d?.email?.trim() ? `mailto:${d.email.trim()}` : ''
  const phoneHref = d ? telHref(d.phone) : ''

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
        className="font-display mb-6"
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}
      >
        {d.name || 'Kontakt'}
      </h1>

      {contacts.error ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {contacts.error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
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
              className="flex max-h-[280px] flex-col gap-2 overflow-y-auto pr-1"
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
    </motion.div>
  )
}
