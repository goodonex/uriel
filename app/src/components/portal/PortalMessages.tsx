import { useState, type CSSProperties } from 'react'
import { useProjectMessages } from '../../hooks/useProjectMessages'

interface PortalMessagesProps {
  projectId: string
  senderName: string
  accentColor: string
}

function formatTime(iso: string): string {
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

export function PortalMessages({ projectId, senderName, accentColor }: PortalMessagesProps) {
  const { messages, loading, error, sending, send } = useProjectMessages(
    projectId,
    'client',
    senderName,
  )
  const [draft, setDraft] = useState('')

  const handleSend = async () => {
    if (!draft.trim()) return
    const result = await send(draft)
    if (result.ok) setDraft('')
  }

  return (
    <div className="portal-card">
      <h2 className="portal-section-title">Nachrichten</h2>
      <p className="portal-section-meta">Schreib uns — wir melden uns zeitnah.</p>

      {error ? (
        <p style={{ fontSize: 13, color: '#c0392b', marginBottom: 12 }}>{error}</p>
      ) : null}

      {loading && messages.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--portal-text-secondary)' }}>Laden…</p>
      ) : null}

      {!loading && messages.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--portal-text-secondary)', marginBottom: 12 }}>
          Noch keine Nachrichten. Starte das Gespräch.
        </p>
      ) : null}

      <div style={{ marginBottom: 16 }}>
        {messages.map((msg) => {
          const isOwner = msg.sender_role === 'owner'
          const unread = isOwner && !msg.read_at
          return (
            <div
              key={msg.id}
              className={`portal-message${unread ? ' portal-message--unread' : ''}`}
              style={
                unread
                  ? ({ '--portal-accent': accentColor } as CSSProperties)
                  : undefined
              }
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 6,
                  fontSize: 11,
                  color: 'var(--portal-text-secondary)',
                }}
              >
                <span>{isOwner ? (msg.sender_name ?? 'Dein Team') : 'Du'}</span>
                <span>{formatTime(msg.created_at)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {msg.body}
              </p>
            </div>
          )
        })}
      </div>

      <textarea
        className="portal-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Deine Nachricht…"
      />
      <button
        type="button"
        className="portal-btn portal-btn-primary"
        style={{ background: accentColor, marginTop: 10 }}
        disabled={sending || !draft.trim()}
        onClick={() => void handleSend()}
      >
        {sending ? 'Senden…' : 'Nachricht senden'}
      </button>
    </div>
  )
}
