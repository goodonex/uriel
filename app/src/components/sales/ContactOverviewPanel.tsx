/**
 * Lead-Übersicht: links Hero + Metadaten, rechts Deliver + Verlauf.
 */
import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useFunnelCanvas } from '../../hooks/useFunnelCanvas'
import { useViewport } from '../../hooks/useViewport'
import { companyDisplayName, isCompany } from '../../lib/crmContacts'
import type { ActivityEntry, Contact } from '../../types/db'
import { ContactDeliverCard } from './ContactDeliverCard'
import { CompanyPersonSection } from './CompanyPersonSection'
import { useToast } from '../Toast'
import { ContactDeleteConfirm } from './ContactDeleteConfirm'
import { ContactDetailsDrawer } from './ContactDetailsDrawer'
import { ContactSequencesPanel } from './ContactSequencesPanel'
import { ContactActivityTimeline } from './activity/ContactActivityTimeline'
import { ContactTasksPanel } from './activity/ContactTasksPanel'
import { ContactDetailHero } from './activity/ContactDetailHero'
import { CallOutcomeSection } from './CallOutcomeSection'
interface ContactOverviewPanelProps {
  brandSlug: string
  contact: Contact
  onField: (
    patch: Partial<Omit<Contact, 'id' | 'brand_id'>>,
    fieldKey?: string,
  ) => void
  layout?: 'page' | 'narrow'
  column?: 'left' | 'right' | 'full'
  timelineRefresh?: number
  onTimelineRefresh?: () => void
  callOutcomeOpen?: boolean
  onCallOutcomeOpenChange?: (open: boolean) => void
  onEditActivity?: (entry: ActivityEntry) => void
}

export function ContactOverviewPanel({
  brandSlug,
  contact,
  onField,
  layout = 'page',
  column = 'full',
  timelineRefresh = 0,
  onTimelineRefresh,
  callOutcomeOpen,
  onCallOutcomeOpenChange,
  onEditActivity,
}: ContactOverviewPanelProps) {
  const contacts = useContacts(brandSlug)
  const navigate = useNavigate()
  const { show } = useToast()
  const { isMobile } = useViewport()

  const handleDelete = useCallback(async () => {
    const ok = await contacts.remove(contact.id)
    if (!ok) {
      show(contacts.error ?? 'Kontakt konnte nicht gelöscht werden', 'error')
      return
    }
    show('Kontakt gelöscht', 'success')
    navigate(`/brand/${brandSlug}/sales`)
  }, [brandSlug, contact.id, contacts, navigate, show])

  const compact = isMobile || layout === 'narrow'

  if (column === 'left') {
    return (
      <ContactDetailLeftColumn
        contact={contact}
        onField={onField}
        onDelete={handleDelete}
        compact={compact}
        brandSlug={brandSlug}
        onTimelineRefresh={onTimelineRefresh}
        callOutcomeOpen={callOutcomeOpen}
        onCallOutcomeOpenChange={onCallOutcomeOpenChange}
      />
    )
  }

  if (column === 'right') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <ContactDeliverCard brandSlug={brandSlug} contact={contact} onField={onField} />
        <ContactActivityTimeline
          brandSlug={brandSlug}
          contact={contact}
          refreshToken={timelineRefresh}
          onEditActivity={onEditActivity}
        />
      </div>
    )
  }

  const wide = layout === 'page' && !isMobile

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: isMobile || !wide ? '1fr' : 'minmax(300px, 380px) minmax(0, 1fr)',
      }}
    >
      <ContactDetailLeftColumn
        contact={contact}
        onField={onField}
        onDelete={handleDelete}
        compact={compact}
        brandSlug={brandSlug}
        onTimelineRefresh={onTimelineRefresh}
        callOutcomeOpen={callOutcomeOpen}
        onCallOutcomeOpenChange={onCallOutcomeOpenChange}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <ContactDeliverCard brandSlug={brandSlug} contact={contact} onField={onField} />
        <ContactActivityTimeline
          brandSlug={brandSlug}
          contact={contact}
          refreshToken={timelineRefresh}
          onEditActivity={onEditActivity}
        />
      </div>
    </div>
  )
}

export function ContactDetailLeftColumn({
  contact,
  onField,
  onDelete,
  compact = false,
  brandSlug,
  onTimelineRefresh,
  callOutcomeOpen,
  onCallOutcomeOpenChange,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>, fieldKey?: string) => void
  onDelete: () => void | Promise<void>
  compact?: boolean
  brandSlug: string
  onTimelineRefresh?: () => void
  callOutcomeOpen?: boolean
  onCallOutcomeOpenChange?: (open: boolean) => void
}) {
  return (
    <IdentityCard
      contact={contact}
      onField={onField}
      onDelete={onDelete}
      compact={compact}
      brandSlug={brandSlug}
      onTimelineRefresh={onTimelineRefresh}
      callOutcomeOpen={callOutcomeOpen}
      onCallOutcomeOpenChange={onCallOutcomeOpenChange}
    />
  )
}

function IdentityCard({
  contact,
  onField,
  onDelete,
  compact = false,
  brandSlug,
  onTimelineRefresh,
  callOutcomeOpen,
  onCallOutcomeOpenChange,
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  onDelete: () => void | Promise<void>
  compact?: boolean
  brandSlug?: string
  onTimelineRefresh?: () => void
  callOutcomeOpen?: boolean
  onCallOutcomeOpenChange?: (open: boolean) => void
}) {
  const c = contact
  const [sourceOpen, setSourceOpen] = useState(false)
  const [valueOpen, setValueOpen] = useState(false)
  const [flowsOpen, setFlowsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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
      <ContactDetailHero
        contact={c}
        onField={onField}
        embedded
        channelTrailing={
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="font-mono"
            title="Details öffnen"
            style={{
              fontSize: 10,
              padding: '0 10px',
              height: 34,
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Details
          </button>
        }
      />

      {brandSlug && isCompany(c) ? (
        <CompanyPersonSection brandSlug={brandSlug} company={c} onField={onField} />
      ) : null}

      {brandSlug ? (
        <ContactTasksPanel brandSlug={brandSlug} contact={c} onField={onField} />
      ) : null}

      {brandSlug ? (
        <CallOutcomeSection
          brandSlug={brandSlug}
          contact={c}
          onField={onField}
          onTimelineRefresh={onTimelineRefresh}
          open={callOutcomeOpen}
          onOpenChange={onCallOutcomeOpenChange}
        />
      ) : null}

      <EditField
        label="Letzter Kontakt"
        value={c.last_contact_at?.slice(0, 10) ?? ''}
        onChange={(v) => onField({ last_contact_at: v ? new Date(v).toISOString() : null })}
        type="date"
      />

      <CollapsibleBlock
        label="Wert"
        open={valueOpen}
        onToggle={() => setValueOpen((o) => !o)}
      >
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}
            >
              Wahrscheinl. %
            </span>
            <select
              value={String(
                Math.round((c.abschluss_wahrscheinlichkeit ?? 0) / 10) * 10,
              )}
              onChange={(e) =>
                onField({
                  abschluss_wahrscheinlichkeit: Math.max(
                    0,
                    Math.min(100, parseInt(e.target.value, 10) || 0),
                  ),
                })
              }
              className="font-mono"
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                borderRadius: 7,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            >
              {Array.from({ length: 11 }, (_, i) => i * 10).map((v) => (
                <option key={v} value={v}>
                  {v}%
                </option>
              ))}
            </select>
          </label>
        </div>
      </CollapsibleBlock>

      {brandSlug ? (
        <CollapsibleSourceSection
          open={sourceOpen}
          onToggle={() => setSourceOpen((o) => !o)}
          brandSlug={brandSlug}
          contact={c}
          onField={onField}
        />
      ) : null}

      {brandSlug ? (
        <CollapsibleBlock
          label="Mailflows"
          open={flowsOpen}
          onToggle={() => setFlowsOpen((o) => !o)}
        >
          <ContactSequencesPanel brandSlug={brandSlug} contactId={c.id} embedded />
        </CollapsibleBlock>
      ) : null}

      <ContactDetailsDrawer
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        contact={c}
        onField={onField}
        onRequestDelete={() => setDeleteOpen(true)}
      />

      <ContactDeleteConfirm
        open={deleteOpen}
        contactName={c.name || c.email || ''}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false)
          void onDelete()
        }}
      />
    </aside>
  )
}

function CollapsibleBlock({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="font-mono"
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--text-tertiary)',
          }}
        >
          {label.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  )
}

function CollapsibleSourceSection({
  open,
  onToggle,
  brandSlug,
  contact,
  onField,
}: {
  open: boolean
  onToggle: () => void
  brandSlug: string
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>, fieldKey?: string) => void
}) {
  return (
    <CollapsibleBlock label="Quelle" open={open} onToggle={onToggle}>
      <LeadSourceFields brandSlug={brandSlug} contact={contact} onField={onField} />
    </CollapsibleBlock>
  )
}

function LeadSourceFields({
  brandSlug,
  contact,
  onField,
}: {
  brandSlug: string
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>, fieldKey?: string) => void
}) {
  const pieces = useContentPieces(brandSlug)
  const campaigns = useCampaigns(brandSlug)
  const funnelCanvas = useFunnelCanvas(brandSlug)
  const allContacts = useContacts(brandSlug)
  const [referralQ, setReferralQ] = useState('')
  const referred = contact.referred_by_id
    ? allContacts.items.find((x) => x.id === contact.referred_by_id)
    : null

  const referralOptions = useMemo(() => {
    const needle = referralQ.trim().toLowerCase()
    return allContacts.items
      .filter((x) => x.id !== contact.id)
      .filter((x) => {
        if (!needle) return true
        return (x.company || x.name || '').toLowerCase().includes(needle)
      })
      .slice(0, 8)
  }, [allContacts.items, contact.id, referralQ])

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: '7px 9px',
    fontSize: 11,
    borderRadius: 7,
    border: '1px solid var(--glass-border-2)',
    background: 'var(--glass-2)',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          Content / Leadrecherche
        </span>
        <select
          value={contact.source_content_piece_id ?? ''}
          onChange={(e) =>
            onField({ source_content_piece_id: e.target.value === '' ? null : e.target.value })
          }
          style={selectStyle}
        >
          <option value="">— keine —</option>
          {pieces.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          Kampagne / Ad
        </span>
        <select
          value={contact.source_campaign_id ?? ''}
          onChange={(e) =>
            onField({ source_campaign_id: e.target.value === '' ? null : e.target.value })
          }
          style={selectStyle}
        >
          <option value="">— keine —</option>
          {campaigns.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          Funnel
        </span>
        <select
          value={contact.source_funnel_id ?? ''}
          onChange={(e) =>
            onField({ source_funnel_id: e.target.value === '' ? null : e.target.value })
          }
          style={selectStyle}
        >
          <option value="">— keiner —</option>
          {funnelCanvas.funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          Empfehlungsgeber
        </span>
        {referred ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to={`/brand/${brandSlug}/sales/${referred.id}`}
              className="font-mono"
              style={{ fontSize: 11, color: 'var(--mode-sales)', textDecoration: 'none' }}
            >
              {companyDisplayName(referred)}
            </Link>
            <button
              type="button"
              onClick={() => onField({ referred_by_id: null }, 'referred_by_id')}
              className="font-mono"
              style={{
                fontSize: 10,
                border: 'none',
                background: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              value={referralQ}
              onChange={(e) => setReferralQ(e.target.value)}
              placeholder="Lead suchen …"
              className="font-mono"
              style={selectStyle}
            />
            {referralQ.trim() && referralOptions.length > 0 ? (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  maxHeight: 120,
                  overflowY: 'auto',
                  border: '1px solid var(--glass-border-2)',
                  borderRadius: 8,
                }}
              >
                {referralOptions.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      className="font-mono"
                      onClick={() => {
                        onField({ referred_by_id: x.id, referral_source: '' }, 'referred_by_id')
                        setReferralQ('')
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: 11,
                        padding: '7px 9px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {companyDisplayName(x)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              value={contact.referral_source ?? ''}
              onChange={(e) =>
                onField({ referral_source: e.target.value, referred_by_id: null }, 'referral_source')
              }
              placeholder="oder Freitext (Name / Quelle)"
              className="font-mono"
              style={selectStyle}
            />
          </>
        )}
      </label>
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
