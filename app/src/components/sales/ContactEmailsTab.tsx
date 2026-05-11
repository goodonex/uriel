import { useState } from 'react'
import { useEmailLogs } from '../../hooks/useSalesPro'
import type { Contact, SalesEmailLog } from '../../types/db'
import { EmailComposeDialog } from './EmailComposeDialog'

interface ContactEmailsTabProps {
  brandSlug: string
  brandName?: string
  contact: Contact
}

function relTime(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Math.max(0, Math.round((Date.now() - t) / 1000))
    if (diff < 60) return 'gerade eben'
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
    if (diff < 604800) return `vor ${Math.floor(diff / 86400)} d`
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

export function ContactEmailsTab({ brandSlug, brandName, contact }: ContactEmailsTabProps) {
  const logs = useEmailLogs(brandSlug, { contactId: contact.id })
  const [composeOpen, setComposeOpen] = useState(false)

  return (
    <div className="font-body" style={{ paddingBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
          >
            E-MAILS
          </div>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
            {logs.items.length} Mail{logs.items.length === 1 ? '' : 's'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--mode-sales)',
            background: 'color-mix(in srgb, var(--mode-sales) 16%, transparent)',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ✉ Neue Mail
        </button>
      </div>

      {logs.loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Lädt …</div>
      ) : logs.items.length === 0 ? (
        <div
          style={{
            padding: 18,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            background: 'var(--glass-1)',
            borderRadius: 10,
            border: '1px dashed var(--glass-border-1)',
          }}
        >
          Noch keine Mails geloggt. Klick „Neue Mail", um Template zu wählen oder freihand zu schreiben.
        </div>
      ) : (
        <ul className="list-none p-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {logs.items.map((m) => (
            <EmailRow key={m.id} item={m} onToggle={(patch) => logs.update(m.id, patch)} />
          ))}
        </ul>
      )}

      <EmailComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        brandSlug={brandSlug}
        brandName={brandName}
        contact={contact}
      />
    </div>
  )
}

function EmailRow({
  item,
  onToggle,
}: {
  item: SalesEmailLog
  onToggle: (patch: Partial<SalesEmailLog>) => void
}) {
  return (
    <li
      style={{
        padding: 12,
        borderRadius: 10,
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
        >
          {item.direction === 'outbound' ? '→' : '←'} {item.direction.toUpperCase()} · {relTime(item.sent_at)}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <ToggleStat
            label="geöffnet"
            on={!!item.opened_at}
            onToggle={() => onToggle({ opened_at: item.opened_at ? null : new Date().toISOString() })}
          />
          <ToggleStat
            label="geantwortet"
            on={!!item.replied_at}
            onToggle={() => onToggle({ replied_at: item.replied_at ? null : new Date().toISOString() })}
          />
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        {item.subject || '(Kein Betreff)'}
      </div>
      {item.body_preview ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {item.body_preview}
          {item.body_preview.length >= 240 ? '…' : ''}
        </div>
      ) : null}
    </li>
  )
}

function ToggleStat({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${label} ${on ? 'markiert' : 'markieren'}`}
      className="font-mono"
      style={{
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 999,
        border: `1px solid ${on ? 'var(--accent-teal)' : 'var(--glass-border-2)'}`,
        background: on ? 'color-mix(in srgb, var(--accent-teal) 18%, transparent)' : 'transparent',
        color: on ? 'var(--accent-teal)' : 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {on ? '✓ ' : '○ '}
      {label}
    </button>
  )
}
