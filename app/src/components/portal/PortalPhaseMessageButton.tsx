import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useProjectMessages } from '../../hooks/useProjectMessages'

interface PortalPhaseMessageButtonProps {
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

export function PortalPhaseMessageButton({
  projectId,
  senderName,
  accentColor,
  brandName,
}: PortalPhaseMessageButtonProps) {
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

  const handleSend = async () => {
    if (!draft.trim()) return
    const result = await send(draft)
    if (result.ok) setDraft('')
  }

  return (
    <>
      <button
        type="button"
        className="portal-btn portal-btn-ghost mt-3"
        style={{ borderColor: accentColor, color: accentColor }}
        onClick={() => setOpen(true)}
      >
        Nachricht schreiben
        {unreadCount > 0 ? (
          <span
            className="font-mono ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1"
            style={{ fontSize: 10, background: accentColor, color: '#0a0a12' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="portal-phase-message-modal"
          role="dialog"
          aria-label="Nachrichten"
          style={{ '--portal-accent': accentColor } as CSSProperties}
        >
          <div className="portal-phase-message-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="portal-phase-message-modal__panel">
            <header className="portal-chat-panel__head">
              <div>
                <div className="portal-chat-panel__title">
                  {brandName ? `${brandName} · ` : ''}Nachricht an Kevin
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
                        isClient ? ({ background: accentColor } as CSSProperties) : undefined
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
        </div>
      ) : null}
    </>
  )
}
