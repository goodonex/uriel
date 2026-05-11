import { useState } from 'react'
import { useCallLogs } from '../../hooks/useSalesPro'
import type { Contact, SalesCallLog, SalesCallOutcome } from '../../types/db'
import { useToast } from '../Toast'

interface ContactCallsTabProps {
  brandSlug: string
  contact: Contact
}

const OUTCOMES: Array<{ key: SalesCallOutcome; label: string; accent: string }> = [
  { key: 'connected', label: 'Gesprochen', accent: 'var(--accent-teal)' },
  { key: 'no_pickup', label: 'Nicht erreicht', accent: 'var(--text-tertiary)' },
  { key: 'voicemail', label: 'Mailbox', accent: 'var(--accent-blue)' },
  { key: 'callback_requested', label: 'Rückruf gewünscht', accent: 'var(--mode-sales)' },
  { key: 'wrong_number', label: 'Falsche Nummer', accent: 'var(--accent-coral)' },
]

function relTime(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Math.max(0, Math.round((Date.now() - t) / 1000))
    if (diff < 60) return 'gerade eben'
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function ContactCallsTab({ brandSlug, contact }: ContactCallsTabProps) {
  const calls = useCallLogs(brandSlug, { contactId: contact.id })
  const { show } = useToast()
  const [note, setNote] = useState('')

  const startCall = () => {
    if (!contact.phone) {
      show('Keine Telefonnummer hinterlegt', 'info')
      return
    }
    window.location.href = `tel:${contact.phone}`
  }

  const logOutcome = async (outcome: SalesCallOutcome) => {
    await calls.log({
      contact_id: contact.id,
      outcome,
      notes: note,
    })
    setNote('')
    show('Anruf geloggt', 'success')
  }

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
            ANRUFE
          </div>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
            {calls.items.length} Log{calls.items.length === 1 ? '' : 's'}
          </div>
        </div>
        <button
          type="button"
          onClick={startCall}
          disabled={!contact.phone}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--mode-sales)',
            background: 'color-mix(in srgb, var(--mode-sales) 16%, transparent)',
            color: 'var(--mode-sales)',
            cursor: contact.phone ? 'pointer' : 'not-allowed',
            opacity: contact.phone ? 1 : 0.5,
            fontWeight: 600,
          }}
        >
          ☎ {contact.phone || 'Keine Nummer'}
        </button>
      </div>

      <div
        style={{
          padding: 12,
          marginBottom: 12,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          borderRadius: 10,
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}
        >
          ERGEBNIS LOGGEN
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Kurze Notiz zum Call (optional) …"
          rows={2}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-2)',
            color: 'var(--text-primary)',
            fontSize: 12,
            outline: 'none',
            resize: 'vertical',
            marginBottom: 8,
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => void logOutcome(o.key)}
              className="font-mono"
              style={{
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 999,
                border: `1px solid ${o.accent}`,
                background: `color-mix(in srgb, ${o.accent} 12%, transparent)`,
                color: o.accent,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {calls.loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Lädt …</div>
      ) : calls.items.length === 0 ? (
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
          Noch keine Anrufe geloggt.
        </div>
      ) : (
        <ul className="list-none p-0" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {calls.items.map((c) => (
            <CallRow key={c.id} item={c} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CallRow({ item }: { item: SalesCallLog }) {
  const outcomeMeta = OUTCOMES.find((o) => o.key === item.outcome)
  return (
    <li
      style={{
        padding: 10,
        borderRadius: 10,
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: outcomeMeta?.accent ?? 'var(--text-tertiary)',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          {outcomeMeta?.label ?? item.outcome}
        </span>
        <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {relTime(item.called_at)}
        </span>
      </div>
      {item.notes ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {item.notes}
        </div>
      ) : null}
    </li>
  )
}
