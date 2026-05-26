import { useState } from 'react'
import { AutoSizeTextarea } from '../AutoSizeTextarea'
import { CollapsibleSection } from '../CollapsibleSection'
import { useProjectMessages } from '../../hooks/useProjectMessages'

interface ProjectMessagesPanelProps {
  projectId: string
  senderName: string
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

export function ProjectMessagesPanel({ projectId, senderName }: ProjectMessagesPanelProps) {
  const { messages, loading, error, sending, send, unreadCount } = useProjectMessages(
    projectId,
    'owner',
    senderName,
  )
  const [draft, setDraft] = useState('')

  const handleSend = async () => {
    if (!draft.trim()) return
    const result = await send(draft)
    if (result.ok) setDraft('')
  }

  return (
    <CollapsibleSection
      title="Nachrichten (Client)"
      meta={unreadCount > 0 ? `${unreadCount} ungelesen` : undefined}
      status={messages.length > 0 ? 'partial' : 'empty'}
      defaultOpen={unreadCount > 0}
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
            {error}
          </p>
        ) : null}
        {loading && messages.length === 0 ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Nachrichten werden geladen…
          </p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Noch keine Nachrichten. Schreib deinem Kunden hier.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isClient = msg.sender_role === 'client'
            const unread = isClient && !msg.read_at
            return (
              <div
                key={msg.id}
                className="rounded-xl p-3"
                style={{
                  border: unread
                    ? '1px solid var(--accent-teal)'
                    : '1px solid var(--glass-border-2)',
                  background: unread ? 'color-mix(in srgb, var(--accent-teal) 8%, transparent)' : 'var(--glass-1)',
                }}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: isClient ? 'var(--accent-teal)' : 'var(--text-secondary)',
                    }}
                  >
                    {isClient ? (msg.sender_name ?? 'Kunde') : 'Du'}
                    {unread ? ' · neu' : ''}
                  </span>
                  <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p
                  className="font-body whitespace-pre-wrap"
                  style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)', margin: 0 }}
                >
                  {msg.body}
                </p>
              </div>
            )
          })}
        </div>
        <AutoSizeTextarea
          value={draft}
          onChange={setDraft}
          placeholder="Nachricht an den Kunden…"
          minHeight={72}
        />
        <button
          type="button"
          className="font-mono self-start"
          disabled={sending || !draft.trim()}
          onClick={() => void handleSend()}
          style={{
            fontSize: 11,
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid var(--accent-teal)',
            background: 'color-mix(in srgb, var(--accent-teal) 15%, transparent)',
            color: 'var(--accent-teal)',
            opacity: sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          {sending ? 'Senden…' : 'Senden'}
        </button>
      </div>
    </CollapsibleSection>
  )
}
