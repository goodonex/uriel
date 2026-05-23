/**
 * Komplettes Übersichts-Panel für einen Lead:
 * - Links: Identity-Card (Kontaktdaten + Pipeline + Wert)
 * - Rechts: Dokumentier-Picker + chronologische Activity-Timeline
 *
 * Vereint Notizen, Mails, Calls, Stage-Wechsel + Tasks zu einem Feed.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type CSSProperties } from 'react'
import { useCallLogs, useEmailLogs } from '../../hooks/useSalesPro'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useTasks } from '../../hooks/useTasks'
import { useBrandId } from '../../hooks/useBrandId'
import { useViewport } from '../../hooks/useViewport'
import { logActivity } from '../../lib/activityLog'
import { generateId } from '../../lib/storage'
import type {
  Contact,
  ContactActivityEntry,
  PipelineStage,
  SalesCallLog,
  SalesCallOutcome,
  SalesEmailLog,
  Task,
} from '../../types/db'
import { useToast } from '../Toast'
import { ContactDeliverCard } from './ContactDeliverCard'
import { ContactListPicker } from './ContactListPicker'
import { CompanyPersonSection } from './CompanyPersonSection'
import { isCompany } from '../../lib/crmContacts'
import type { FollowUpType } from '../../types/db'
import { EmailComposeDialog } from './EmailComposeDialog'
import { usePostCallFlowOptional } from '../../hooks/usePostCallFlow'
import { ContactPresenceEmbeds } from './ContactPresenceEmbeds'
import { LeadQualityField } from './LeadQualityBadge'

interface ContactOverviewPanelProps {
  brandSlug: string
  brandName?: string
  contact: Contact
  onField: (
    patch: Partial<Omit<Contact, 'id' | 'brand_id'>>,
    fieldKey?: string,
  ) => void
  layout?: 'page' | 'narrow'
}

const STAGES: Array<{ key: PipelineStage; label: string; color: string }> = [
  { key: 'first_contact', label: 'Erstkontakt', color: 'var(--text-tertiary)' },
  { key: 'conversation', label: 'Gespräch', color: 'var(--accent-blue)' },
  { key: 'proposal', label: 'Angebot', color: 'var(--mode-sales)' },
  { key: 'deal', label: 'Deal', color: 'var(--accent-teal)' },
  { key: 'paused', label: 'Pause', color: 'var(--text-tertiary)' },
]

type ActionType = 'note' | 'call' | 'email' | 'meeting' | 'linkedin' | 'stage'

const PRIMARY_ACTIONS: Array<{ key: ActionType; label: string; icon: string; accent: string }> = [
  { key: 'meeting', label: 'Termin', icon: '◷', accent: 'var(--accent-teal)' },
  { key: 'note', label: 'Notiz', icon: '✎', accent: 'var(--text-secondary)' },
  { key: 'call', label: 'Anruf', icon: '☎', accent: 'var(--mode-sales)' },
]

const MORE_ACTIONS: Array<{ key: ActionType; label: string; icon: string; accent: string }> = [
  { key: 'email', label: 'E-Mail', icon: '✉', accent: 'var(--accent-blue)' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in', accent: '#0A66C2' },
  { key: 'stage', label: 'Stage-Wechsel', icon: '→', accent: 'var(--mode-sales)' },
]

const CALL_OUTCOMES: Array<{ key: SalesCallOutcome; label: string }> = [
  { key: 'connected', label: 'Gesprochen' },
  { key: 'no_pickup', label: 'Nicht erreicht' },
  { key: 'voicemail', label: 'Mailbox' },
  { key: 'callback_requested', label: 'Rückruf gewünscht' },
  { key: 'wrong_number', label: 'Falsche Nummer' },
]

function fmtRel(iso: string): string {
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
    })
  } catch {
    return ''
  }
}

function initialsOf(name: string): string {
  return (name || 'L')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export function ContactOverviewPanel({
  brandSlug,
  brandName,
  contact,
  onField,
  layout = 'page',
}: ContactOverviewPanelProps) {
  const contacts = useContacts(brandSlug)
  const brandId = useBrandId(brandSlug)
  const tasks = useTasks(brandSlug)
  const calls = useCallLogs(brandSlug, { contactId: contact.id })
  const mails = useEmailLogs(brandSlug, { contactId: contact.id })
  const pieces = useContentPieces(brandSlug)
  const sourcePiece = useMemo(
    () =>
      contact.source_content_piece_id
        ? pieces.items.find((p) => p.id === contact.source_content_piece_id) ?? null
        : null,
    [pieces.items, contact.source_content_piece_id],
  )
  const { show } = useToast()
  const { isMobile } = useViewport()
  const postCallFlow = usePostCallFlowOptional()

  const [action, setAction] = useState<ActionType | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Timeline kombiniert: Aktivitäts-Notizen, Calls, Mails, Stage-Wechsel, abgeschlossene Tasks
  const timeline = useMemo<TimelineEntry[]>(() => {
    const items: TimelineEntry[] = []

    for (const a of contact.activity_log ?? []) {
      items.push({
        id: `note:${a.id}`,
        at: a.at,
        kind: 'note',
        title: a.text,
        meta: '',
      })
    }
    for (const c of calls.items) {
      const meta = CALL_OUTCOMES.find((o) => o.key === c.outcome)?.label ?? c.outcome
      items.push({
        id: `call:${c.id}`,
        at: c.called_at,
        kind: 'call',
        title: c.notes || 'Anruf protokolliert',
        meta,
      })
    }
    for (const m of mails.items) {
      items.push({
        id: `mail:${m.id}`,
        at: m.sent_at,
        kind: 'email',
        title: m.subject || '(Kein Betreff)',
        meta: m.replied_at
          ? 'geantwortet'
          : m.opened_at
            ? 'geöffnet'
            : m.direction,
        bodyPreview: m.body_preview,
      })
    }
    if (contact.stage_changed_at) {
      items.push({
        id: `stage:${contact.stage_changed_at}`,
        at: contact.stage_changed_at,
        kind: 'stage',
        title: `Stage: ${STAGES.find((s) => s.key === contact.pipeline_stage)?.label}`,
        meta: '',
      })
    }
    for (const t of tasks.items) {
      if (t.contact_id !== contact.id) continue
      if (t.status === 'done' && t.completed_at) {
        items.push({
          id: `task:${t.id}`,
          at: t.completed_at,
          kind: 'task',
          title: `Task erledigt: ${t.title}`,
          meta: '',
        })
      }
    }

    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [contact, calls.items, mails.items, tasks.items])

  // Aktions-Handler
  const addNote = (text: string) => {
    if (!text.trim()) return
    const entry: ContactActivityEntry = {
      id: generateId(),
      text: text.trim(),
      at: new Date().toISOString(),
    }
    onField({ activity_log: [entry, ...(contact.activity_log ?? [])] })
    show('Notiz hinzugefügt', 'success')
    setAction(null)
  }

  const startCallFlow = () => {
    const phone = contact.phone?.trim()
    if (phone) {
      const digits = phone.replace(/[^\d+]/g, '')
      if (digits) window.location.href = `tel:${digits}`
    }
    postCallFlow?.openPostCall({
      contactId: contact.id,
      source: 'contact',
    })
    setAction(null)
    setMoreOpen(false)
  }

  const logLinkedInMessage = (text: string) => {
    if (!brandId) {
      show('Brand-ID fehlt', 'info')
      return
    }
    logActivity({
      brand_id: brandId,
      entity_type: 'contact',
      entity_id: contact.id,
      action: 'linkedin_sent',
      summary: text.trim() || 'LinkedIn-Nachricht gesendet',
      metadata: { contact_name: contact.name },
    })
    // Auch als Activity-Note in den Lead
    const entry: ContactActivityEntry = {
      id: generateId(),
      text: `LinkedIn: ${text.trim() || 'Nachricht gesendet'}`,
      at: new Date().toISOString(),
    }
    onField({
      activity_log: [entry, ...(contact.activity_log ?? [])],
      last_contact_at: new Date().toISOString(),
    })
    show('LinkedIn-Nachricht geloggt', 'success')
    setAction(null)
  }

  const setMeeting = (when: string, type: FollowUpType, note: string) => {
    if (!when) {
      show('Datum nötig', 'info')
      return
    }
    const iso = new Date(when).toISOString()
    onField({ next_follow_up_at: iso, follow_up_type: type })
    const entry: ContactActivityEntry = {
      id: generateId(),
      text: `Termin geplant: ${new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${note ? ` · ${note}` : ''}`,
      at: new Date().toISOString(),
    }
    onField({ activity_log: [entry, ...(contact.activity_log ?? [])] })
    show('Termin gesetzt', 'success')
    setAction(null)
  }

  const changeStage = (next: PipelineStage, note: string) => {
    if (next === contact.pipeline_stage) {
      setAction(null)
      return
    }
    onField({ pipeline_stage: next })
    if (note.trim()) {
      const entry: ContactActivityEntry = {
        id: generateId(),
        text: `Stage → ${STAGES.find((s) => s.key === next)?.label}: ${note.trim()}`,
        at: new Date().toISOString(),
      }
      onField({ activity_log: [entry, ...(contact.activity_log ?? [])] })
    }
    show('Stage gewechselt', 'success')
    setAction(null)
  }

  const handleDelete = () => {
    if (!window.confirm(`Kontakt „${contact.name || contact.email}" wirklich löschen?`)) return
    contacts.remove(contact.id)
  }

  const wide = layout === 'page' && !isMobile

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: isMobile || !wide ? '1fr' : 'minmax(300px, 380px) minmax(0, 1fr)',
      }}
    >
      <IdentityCard
        contact={contact}
        onField={onField}
        onDelete={handleDelete}
        compact={isMobile || layout === 'narrow'}
        showEmbeds={layout === 'page'}
        sourcePiece={sourcePiece ? { id: sourcePiece.id, title: sourcePiece.title } : null}
        brandSlug={brandSlug}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <ContactDeliverCard brandSlug={brandSlug} contact={contact} />
        <ContactListPicker brandSlug={brandSlug} contact={contact} />
        <DocumenterCard
          contact={contact}
          action={action}
          setAction={setAction}
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
          onNote={addNote}
          onCall={startCallFlow}
          onLinkedIn={logLinkedInMessage}
          onMeeting={setMeeting}
          onStage={changeStage}
          onOpenEmail={() => {
            setComposeOpen(true)
            setAction(null)
            setMoreOpen(false)
          }}
        />
        <TimelineCard
          items={timeline}
          mails={mails.items}
          calls={calls.items}
          onUpdateMail={(id, patch) => mails.update(id, patch)}
        />
      </div>

      <EmailComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        brandSlug={brandSlug}
        brandName={brandName}
        contact={contact}
        onLogged={() => {
          onField({ last_contact_at: new Date().toISOString() })
        }}
      />
    </div>
  )
}

// ============================================================
// IdentityCard
// ============================================================

function IdentityCard({
  contact,
  onField,
  onDelete,
  compact = false,
  showEmbeds = false,
  sourcePiece,
  brandSlug,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  onDelete: () => void
  compact?: boolean
  showEmbeds?: boolean
  sourcePiece?: { id: string; title: string } | null
  brandSlug?: string
}) {
  const c = contact
  const initials = initialsOf(c.name)

  const QuickIcon = ({
    href,
    label,
    children,
    accent,
  }: {
    href: string | null
    label: string
    children: React.ReactNode
    accent: string
  }) => (
    <a
      href={href ?? '#'}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noopener noreferrer"
      title={label}
      onClick={(e) => {
        if (!href) {
          e.preventDefault()
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 10,
        border: '1px solid var(--glass-border-2)',
        background: href ? `color-mix(in srgb, ${accent} 10%, var(--glass-1))` : 'var(--glass-1)',
        color: href ? accent : 'var(--text-tertiary)',
        textDecoration: 'none',
        cursor: href ? 'pointer' : 'not-allowed',
        opacity: href ? 1 : 0.4,
        transition: 'transform 0.15s ease',
      }}
      onMouseDown={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.transform = 'scale(0.96)'
      }}
      onMouseUp={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.transform = ''
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLAnchorElement).style.transform = ''
      }}
    >
      {children}
    </a>
  )

  return (
    <aside
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: compact ? 14 : 18,
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 12 : 16,
        height: 'fit-content',
        position: compact ? 'static' : 'sticky',
        top: compact ? undefined : 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          className="font-display"
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--mode-sales), color-mix(in srgb, var(--mode-sales) 50%, var(--accent-teal)))',
            color: '#0e0e10',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <input
            type="text"
            value={c.name}
            onChange={(e) => onField({ name: e.target.value })}
            placeholder="Name"
            className="font-display"
            style={{
              width: '100%',
              fontSize: 18,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              outline: 'none',
              padding: 0,
              letterSpacing: '-0.3px',
            }}
          />
          {!isCompany(c) ? (
            <input
              type="text"
              value={c.company}
              onChange={(e) => onField({ company: e.target.value })}
              placeholder="Firma"
              className="font-mono"
              style={{
                width: '100%',
                fontSize: 11,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                outline: 'none',
                padding: 0,
                marginTop: 2,
              }}
            />
          ) : null}
        </div>
      </div>

      {brandSlug && isCompany(c) ? (
        <CompanyPersonSection brandSlug={brandSlug} company={c} onField={onField} />
      ) : null}

      {sourcePiece && brandSlug ? (
        <a
          href={`/brand/${brandSlug}/promo`}
          className="font-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--mode-promo) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--mode-promo) 35%, transparent)',
            color: 'var(--mode-promo)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textDecoration: 'none',
            width: 'fit-content',
            maxWidth: '100%',
          }}
          title={`Kam über ${sourcePiece.title}`}
        >
          <span style={{ opacity: 0.7 }}>↩</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            kam über · {sourcePiece.title}
          </span>
        </a>
      ) : null}

      {/* Quick-Action-Icons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <QuickIcon
          href={c.phone ? `tel:${c.phone}` : null}
          label={`Anrufen: ${c.phone || 'keine Nummer'}`}
          accent="var(--mode-sales)"
        >
          <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M3 3 L5 3 L6 6 L4.5 7 a8 8 0 0 0 4.5 4.5 L10 10 L13 11 L13 13 a1 1 0 0 1 -1 1 a11 11 0 0 1 -11 -11 a1 1 0 0 1 1 -1 Z" />
          </svg>
        </QuickIcon>
        <QuickIcon
          href={c.email ? `mailto:${c.email}` : null}
          label={`E-Mail: ${c.email || 'keine'}`}
          accent="var(--accent-blue)"
        >
          <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M2 4 L8 9 L14 4" />
          </svg>
        </QuickIcon>
        <QuickIcon
          href={c.website || null}
          label={`Website: ${c.website || 'keine'}`}
          accent="var(--accent-teal)"
        >
          <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="8" cy="8" r="6" />
            <path d="M2 8 H14 M8 2 a8 8 0 0 1 0 12 M8 2 a8 8 0 0 0 0 12" />
          </svg>
        </QuickIcon>
        <QuickIcon
          href={c.instagram || null}
          label={`Instagram: ${c.instagram || 'keine'}`}
          accent="#E1306C"
        >
          <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="2" y="2" width="12" height="12" rx="3" />
            <circle cx="8" cy="8" r="3" />
            <circle cx="11.5" cy="4.5" r="0.7" fill="currentColor" />
          </svg>
        </QuickIcon>
        <QuickIcon
          href={c.linkedin || null}
          label={`LinkedIn: ${c.linkedin || 'keine'}`}
          accent="#0A66C2"
        >
          <svg width={15} height={15} viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6h2v8H4zM5 3.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM7.5 6h2v1.2c.3-.5 1-1.2 2-1.2 2 0 2.5 1.3 2.5 3V14h-2V9.4c0-1-.4-1.6-1.3-1.6-.8 0-1.2.5-1.2 1.6V14h-2z" />
          </svg>
        </QuickIcon>
      </div>

      <StageStepper
        current={c.pipeline_stage}
        onChange={(s) => onField({ pipeline_stage: s })}
      />

      <FieldGroup label="Kontakt">
        <EditField
          label="E-Mail"
          value={c.email}
          onChange={(v) => onField({ email: v })}
          type="email"
        />
        <EditField
          label="Telefon"
          value={c.phone}
          onChange={(v) => onField({ phone: v })}
          type="tel"
        />
        <EditField
          label="Website"
          value={c.website}
          onChange={(v) => onField({ website: v })}
          type="url"
        />
        <LeadQualityField
          quality={c.lead_quality}
          onChange={(q) => onField({ lead_quality: q })}
        />
        <EditField
          label="Instagram"
          value={c.instagram}
          onChange={(v) => onField({ instagram: v })}
        />
        <EditField
          label="LinkedIn"
          value={c.linkedin}
          onChange={(v) => onField({ linkedin: v })}
        />
        <EditField
          label="Ansprechpartner"
          value={c.ansprechpartner}
          onChange={(v) => onField({ ansprechpartner: v })}
        />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            className="font-mono"
            style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
          >
            Notizen
          </span>
          <textarea
            value={c.notes}
            onChange={(e) => onField({ notes: e.target.value })}
            rows={4}
            placeholder="Kontext, Gesprächsnotizen, nächste Schritte…"
            className="font-mono"
            style={{
              width: '100%',
              padding: '7px 9px',
              fontSize: 12,
              borderRadius: 7,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'vertical',
              minHeight: 88,
            }}
          />
        </label>
      </FieldGroup>

      {showEmbeds ? (
        <ContactPresenceEmbeds
          website={c.website}
          instagram={c.instagram}
          linkedin={c.linkedin}
        />
      ) : null}

      <FieldGroup label="Pipeline">
        <EditField
          label="Letzter Kontakt"
          value={c.last_contact_at?.slice(0, 10) ?? ''}
          onChange={(v) => onField({ last_contact_at: v ? new Date(v).toISOString() : null })}
          type="date"
        />
        <input
          type="hidden"
          aria-hidden
          value={c.next_follow_up_at ?? ''}
          readOnly
        />
      </FieldGroup>

      <FieldGroup label="Wert">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <EditField
            label="Potenzial €"
            value={String(c.potenzial_betrag || '')}
            onChange={(v) =>
              onField({ potenzial_betrag: Math.max(0, parseInt(v.replace(/[^\d]/g, '') || '0', 10)) })
            }
            type="number"
            compact
          />
          <EditField
            label="Wahrscheinl. %"
            value={String(c.abschluss_wahrscheinlichkeit || '')}
            onChange={(v) =>
              onField({
                abschluss_wahrscheinlichkeit: Math.max(
                  0,
                  Math.min(100, parseInt(v.replace(/[^\d]/g, '') || '0', 10)),
                ),
              })
            }
            type="number"
            compact
          />
        </div>
      </FieldGroup>

      <button
        type="button"
        onClick={onDelete}
        className="font-mono"
        style={{
          alignSelf: 'flex-start',
          fontSize: 10,
          padding: '6px 10px',
          borderRadius: 7,
          border: '1px solid color-mix(in srgb, var(--accent-coral) 50%, transparent)',
          background: 'transparent',
          color: 'var(--accent-coral)',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        Kontakt löschen
      </button>
    </aside>
  )
}

function StageStepper({
  current,
  onChange,
}: {
  current: PipelineStage
  onChange: (s: PipelineStage) => void
}) {
  const progression: PipelineStage[] = ['first_contact', 'conversation', 'proposal', 'deal']
  const currentIdx = progression.indexOf(current)
  const isPaused = current === 'paused'

  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        PHASE
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {progression.map((stage, idx) => {
          const stageMeta = STAGES.find((s) => s.key === stage)!
          const reached = !isPaused && idx <= currentIdx
          const isCurrent = !isPaused && idx === currentIdx
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onChange(stage)}
              className="font-mono"
              title={stageMeta.label}
              style={{
                flex: 1,
                fontSize: 9,
                padding: '7px 4px',
                borderRadius: 6,
                border: isCurrent
                  ? `1px solid ${stageMeta.color}`
                  : '1px solid var(--glass-border-2)',
                background: isCurrent
                  ? `color-mix(in srgb, ${stageMeta.color} 22%, transparent)`
                  : reached
                    ? `color-mix(in srgb, ${stageMeta.color} 10%, var(--glass-2))`
                    : 'var(--glass-2)',
                color: isCurrent || reached ? stageMeta.color : 'var(--text-tertiary)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: isCurrent ? 700 : 500,
              }}
            >
              {stageMeta.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(isPaused ? 'first_contact' : 'paused')}
          className="font-mono"
          title="Pause / Wieder aktivieren"
          style={{
            fontSize: 9,
            padding: '7px 8px',
            borderRadius: 6,
            border: isPaused
              ? '1px solid var(--text-tertiary)'
              : '1px solid var(--glass-border-2)',
            background: isPaused ? 'var(--glass-3)' : 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
        >
          ⏸
        </button>
      </div>
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-tertiary)',
          marginBottom: 8,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  type = 'text',
  compact = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  compact?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        className="font-mono"
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={compact ? '' : `${label} …`}
        className="font-mono"
        style={{
          width: '100%',
          padding: compact ? '6px 8px' : '7px 9px',
          fontSize: 12,
          borderRadius: 7,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />
    </label>
  )
}

// ============================================================
// DocumenterCard
// ============================================================

function DocumenterCard({
  contact,
  action,
  setAction,
  onNote,
  onCall,
  onLinkedIn,
  onMeeting,
  onStage,
  onOpenEmail,
  moreOpen,
  setMoreOpen,
}: {
  contact: Contact
  action: ActionType | null
  setAction: (a: ActionType | null) => void
  onNote: (text: string) => void
  onCall: () => void
  moreOpen: boolean
  setMoreOpen: (open: boolean) => void
  onLinkedIn: (text: string) => void
  onMeeting: (when: string, type: FollowUpType, note: string) => void
  onStage: (next: PipelineStage, note: string) => void
  onOpenEmail: () => void
}) {
  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-tertiary)',
          marginBottom: 10,
        }}
      >
        DOKUMENTIEREN
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {PRIMARY_ACTIONS.map((a) => {
          const on = action === a.key
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                if (a.key === 'call') {
                  onCall()
                  return
                }
                setAction(on ? null : a.key)
              }}
              className="font-mono inline-flex items-center"
              style={{
                fontSize: 11,
                padding: '8px 12px',
                borderRadius: 999,
                border: on
                  ? `1px solid ${a.accent}`
                  : '1px solid var(--glass-border-2)',
                background: on
                  ? `color-mix(in srgb, ${a.accent} 18%, transparent)`
                  : 'var(--glass-2)',
                color: on ? a.accent : 'var(--text-secondary)',
                cursor: 'pointer',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 12, fontFamily: 'system-ui' }}>{a.icon}</span>
              {a.label}
            </button>
          )
        })}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            className="font-mono"
            style={{
              fontSize: 14,
              padding: '8px 12px',
              borderRadius: 999,
              border: '1px solid var(--glass-border-2)',
              background: moreOpen ? 'var(--glass-3)' : 'var(--glass-2)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Weitere Aktionen"
          >
            •••
          </button>
          {moreOpen ? (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 6,
                zIndex: 20,
                minWidth: 160,
                padding: 6,
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              }}
            >
              {MORE_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    if (a.key === 'email') {
                      onOpenEmail()
                      return
                    }
                    setMoreOpen(false)
                    setAction(action === a.key ? null : a.key)
                  }}
                  className="font-mono"
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: 11,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {action && action !== 'call' ? (
          <motion.div
            key={action}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            style={{ marginTop: 12, overflow: 'hidden' }}
          >
            {action === 'note' ? (
              <InlineNoteForm onSave={onNote} onCancel={() => setAction(null)} />
            ) : action === 'linkedin' ? (
              <InlineLinkedInForm onSave={onLinkedIn} onCancel={() => setAction(null)} />
            ) : action === 'meeting' ? (
              <InlineMeetingForm
                defaultWhen={contact.next_follow_up_at}
                onSave={onMeeting}
                onCancel={() => setAction(null)}
              />
            ) : action === 'stage' ? (
              <InlineStageForm
                current={contact.pipeline_stage}
                onSave={onStage}
                onCancel={() => setAction(null)}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

// ============================================================
// Inline-Forms
// ============================================================

function InlineNoteForm({
  onSave,
  onCancel,
}: {
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  return (
    <div style={inlineFormBox}>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Was hast du erfahren / besprochen?"
        rows={3}
        style={textareaStyle}
      />
      <InlineActions
        onSave={() => onSave(text)}
        onCancel={onCancel}
        disabled={!text.trim()}
        label="Notiz speichern"
      />
    </div>
  )
}


function InlineLinkedInForm({
  onSave,
  onCancel,
}: {
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  return (
    <div style={inlineFormBox}>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Welche Nachricht hast du gesendet?"
        rows={3}
        style={textareaStyle}
      />
      <InlineActions
        onSave={() => onSave(text)}
        onCancel={onCancel}
        label="LinkedIn speichern"
      />
    </div>
  )
}

function InlineMeetingForm({
  defaultWhen,
  onSave,
  onCancel,
}: {
  defaultWhen: string | null
  onSave: (when: string, type: FollowUpType, note: string) => void
  onCancel: () => void
}) {
  const base = defaultWhen ? new Date(defaultWhen) : new Date()
  const [date, setDate] = useState(base.toISOString().slice(0, 10))
  const [time, setTime] = useState(
    `${String(base.getHours()).padStart(2, '0')}:${String(Math.floor(base.getMinutes() / 15) * 15).padStart(2, '0')}`,
  )
  const [fuType, setFuType] = useState<FollowUpType>('call')
  const [note, setNote] = useState('')

  const timeOptions = useMemo(() => {
    const out: string[] = []
    for (let h = 7; h <= 20; h++) {
      for (const m of [0, 15, 30, 45]) {
        out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
    }
    return out
  }, [])

  const whenIso = date && time ? new Date(`${date}T${time}:00`).toISOString() : ''

  return (
    <div style={inlineFormBox}>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span className="font-mono" style={labelStyle}>
          DATUM
        </span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span className="font-mono" style={labelStyle}>
          UHRZEIT
        </span>
        <select value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle}>
          {timeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span className="font-mono" style={labelStyle}>
          TYP
        </span>
        <select value={fuType} onChange={(e) => setFuType(e.target.value as FollowUpType)} style={inputStyle}>
          <option value="call">Anruf</option>
          <option value="meeting">Meeting</option>
          <option value="email">E-Mail</option>
          <option value="other">Sonstiges</option>
        </select>
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Kurze Notiz (optional)"
        rows={2}
        style={textareaStyle}
      />
      <InlineActions
        onSave={() => onSave(whenIso, fuType, note)}
        onCancel={onCancel}
        disabled={!whenIso}
        label="Follow-up speichern"
      />
    </div>
  )
}

function InlineStageForm({
  current,
  onSave,
  onCancel,
}: {
  current: PipelineStage
  onSave: (next: PipelineStage, note: string) => void
  onCancel: () => void
}) {
  const [next, setNext] = useState<PipelineStage>(current)
  const [note, setNote] = useState('')
  return (
    <div style={inlineFormBox}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {STAGES.map((s) => {
          const on = next === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setNext(s.key)}
              className="font-mono"
              style={{
                fontSize: 10,
                padding: '5px 9px',
                borderRadius: 999,
                border: on
                  ? `1px solid ${s.color}`
                  : '1px solid var(--glass-border-2)',
                background: on
                  ? `color-mix(in srgb, ${s.color} 18%, transparent)`
                  : 'var(--glass-2)',
                color: on ? s.color : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Warum dieser Wechsel? (optional)"
        rows={2}
        style={textareaStyle}
      />
      <InlineActions
        onSave={() => onSave(next, note)}
        onCancel={onCancel}
        label="Stage wechseln"
      />
    </div>
  )
}

function InlineActions({
  onSave,
  onCancel,
  disabled,
  label,
}: {
  onSave: () => void
  onCancel: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
      <button
        type="button"
        onClick={onCancel}
        className="font-mono"
        style={{
          fontSize: 10,
          padding: '6px 10px',
          borderRadius: 8,
          border: '1px solid var(--glass-border-2)',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
        }}
      >
        Abbrechen
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="font-mono"
        style={{
          fontSize: 10,
          padding: '6px 12px',
          borderRadius: 8,
          border: '1px solid var(--mode-sales)',
          background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
          color: 'var(--mode-sales)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        ✓ {label}
      </button>
    </div>
  )
}

const inlineFormBox: CSSProperties = {
  padding: 12,
  background: 'var(--glass-2)',
  border: '1px solid var(--glass-border-2)',
  borderRadius: 10,
}

const textareaStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'inherit',
  resize: 'vertical',
  marginBottom: 8,
  outline: 'none',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  marginTop: 3,
}

const labelStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.12em',
  color: 'var(--text-tertiary)',
}

// ============================================================
// Timeline
// ============================================================

interface TimelineEntry {
  id: string
  at: string
  kind: 'note' | 'call' | 'email' | 'stage' | 'task'
  title: string
  meta: string
  bodyPreview?: string
  inbound?: boolean
}

const KIND_META: Record<
  TimelineEntry['kind'],
  { label: string; icon: string; color: string }
> = {
  note: { label: 'Notiz', icon: '✎', color: 'var(--text-secondary)' },
  call: { label: 'Anruf', icon: '☎', color: 'var(--mode-sales)' },
  email: { label: 'E-Mail', icon: '✉', color: 'var(--accent-blue)' },
  stage: { label: 'Stage', icon: '→', color: 'var(--mode-sales)' },
  task: { label: 'Task', icon: '✓', color: 'var(--accent-teal)' },
}

function TimelineCard({
  items,
  mails,
  calls,
  onUpdateMail,
}: {
  items: TimelineEntry[]
  mails: SalesEmailLog[]
  calls: SalesCallLog[]
  onUpdateMail: (id: string, patch: Partial<SalesEmailLog>) => void
}) {
  void calls
  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--text-tertiary)',
          }}
        >
          VERLAUF · {items.length} EINTRÄGE
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            background: 'var(--glass-2)',
            border: '1px dashed var(--glass-border-1)',
            borderRadius: 10,
          }}
        >
          Noch nichts dokumentiert. Wähle oben aus, was du erfassen möchtest.
        </div>
      ) : (
        <ol
          className="list-none"
          style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, margin: 0 }}
        >
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1
            const meta = KIND_META[item.kind]
            // Falls Mail: zugehöriges Log fürs Toggling rausholen
            const mailLog =
              item.kind === 'email'
                ? mails.find((m) => `mail:${m.id}` === item.id)
                : undefined
            return (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  paddingBottom: isLast ? 0 : 14,
                  position: 'relative',
                }}
              >
                {/* Vertikale Verbindungslinie */}
                {!isLast ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 13,
                      top: 30,
                      bottom: 0,
                      width: 1,
                      background: 'var(--glass-border-1)',
                    }}
                  />
                ) : null}

                {/* Icon-Bullet */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: `color-mix(in srgb, ${meta.color} 18%, var(--glass-2))`,
                    border: `1px solid ${meta.color}`,
                    color: meta.color,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                    flexShrink: 0,
                    fontFamily: 'system-ui',
                  }}
                >
                  {item.inbound ? '↙' : meta.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 8,
                      marginBottom: 2,
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        color: meta.color,
                        letterSpacing: '0.1em',
                        fontWeight: 600,
                      }}
                    >
                      {(item.inbound ? 'E-MAIL' : meta.label).toUpperCase()}
                      {item.meta ? (
                        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                          {' · '}
                          {item.meta}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="font-mono"
                      style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                    >
                      {fmtRel(item.at)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {item.title}
                  </div>
                  {item.bodyPreview ? (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        background: 'var(--glass-2)',
                        padding: '6px 8px',
                        borderRadius: 6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.bodyPreview}
                    </div>
                  ) : null}
                  {mailLog ? (
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <MailToggle
                        on={!!mailLog.opened_at}
                        label="geöffnet"
                        onClick={() =>
                          onUpdateMail(mailLog.id, {
                            opened_at: mailLog.opened_at ? null : new Date().toISOString(),
                          })
                        }
                      />
                      <MailToggle
                        on={!!mailLog.replied_at}
                        label="geantwortet"
                        onClick={() =>
                          onUpdateMail(mailLog.id, {
                            replied_at: mailLog.replied_at ? null : new Date().toISOString(),
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function MailToggle({
  on,
  label,
  onClick,
}: {
  on: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono"
      style={{
        fontSize: 9,
        padding: '2px 7px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent-teal)' : 'var(--glass-border-2)'}`,
        background: on
          ? 'color-mix(in srgb, var(--accent-teal) 16%, transparent)'
          : 'transparent',
        color: on ? 'var(--accent-teal)' : 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {on ? '✓ ' : '○ '}
      {label}
    </button>
  )
}

// Type guard for unused warning suppression
void (null as unknown as Task)
