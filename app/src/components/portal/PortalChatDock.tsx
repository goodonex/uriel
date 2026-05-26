import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useProjectMessages } from '../../hooks/useProjectMessages'

interface PortalChatDockProps {
  projectId: string
  senderName: string
  accentColor: string
  brandName?: string
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

export function PortalChatDock({
  projectId,
  senderName,
  accentColor,
  brandName,
}: PortalChatDockProps) {
  const { messages, loading, error, sending, send, unreadCount } = useProjectMessages(
    projectId,
    'client',
    senderName,
  )
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (unreadCount > 0 && !open) {
      setOpen(true)
    }
  }, [unreadCount, open])

  const handleSend = async () => {
    if (!draft.trim()) return
    const result = await send(draft)
    if (result.ok) setDraft('')
  }

  return (
    <>
      <div
        className={`portal-chat-panel${open ? ' portal-chat-panel--open' : ''}`}
        style={{ '--portal-accent': accentColor } as CSSProperties}
        role="dialog"
        aria-label="Nachrichten"
      >
        <header className="portal-chat-panel__head">
          <div>
            <div className="portal-chat-panel__title">
              {brandName ? `${brandName} · ` : ''}Dein Team
            </div>
            <div className="portal-chat-panel__sub">Antwortet in der Regel innerhalb von 24h</div>
          </div>
          <button
            type="button"
            className="portal-chat-panel__close"
            onClick={() => setOpen(false)}
            aria-label="Schließen"
          >
            ✕
          </button>
        </header>

        <div className="portal-chat-panel__body">
          {loading && messages.length === 0 ? (
            <p className="portal-chat-panel__empty">Laden…</p>
          ) : null}
          {!loading && messages.length === 0 ? (
            <p className="portal-chat-panel__empty">
              Schreib uns — ob Frage, Feedback oder Terminwunsch.
            </p>
          ) : null}
          {messages.map((msg) => {
            const isClient = msg.sender_role === 'client'
            const unread = !isClient && !msg.read_at
            return (
              <div
                key={msg.id}
                className={`portal-chat-bubble-row${isClient ? ' portal-chat-bubble-row--mine' : ''}`}
              >
                <div
                  className={`portal-chat-bubble${unread ? ' portal-chat-bubble--unread' : ''}`}
                  style={
                    isClient
                      ? ({ background: accentColor } as CSSProperties)
                      : undefined
                  }
                >
                  {!isClient ? (
                    <div className="portal-chat-bubble__sender">
                      {msg.sender_name ?? 'Dein Team'}
                    </div>
                  ) : null}
                  <p>{msg.body}</p>
                  <time>{formatTime(msg.created_at)}</time>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {error ? <p className="portal-chat-panel__error">{error}</p> : null}

        <footer className="portal-chat-panel__foot">
          <textarea
            className="portal-chat-panel__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nachricht schreiben…"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
          />
          <button
            type="button"
            className="portal-chat-panel__send"
            style={{ background: accentColor }}
            disabled={sending || !draft.trim()}
            onClick={() => void handleSend()}
          >
            {sending ? '…' : '↑'}
          </button>
        </footer>
      </div>

      {open ? (
        <button
          type="button"
          className="portal-chat-backdrop"
          aria-label="Chat schließen"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <button
        type="button"
        className={`portal-chat-fab${open ? ' portal-chat-fab--open' : ''}`}
        style={{ background: accentColor }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Chat schließen' : 'Nachrichten öffnen'}
      >
        {open ? '✕' : '💬'}
        {!open && unreadCount > 0 ? (
          <span className="portal-chat-fab__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>
    </>
  )
}
