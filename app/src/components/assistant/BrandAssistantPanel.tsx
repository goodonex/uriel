import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { ASSISTANT_QUICK_ACTIONS, type AssistantAttachment } from '../../types/assistant'
import { assistantFileAccept } from '../../lib/assistantFileExtract'
import { textContainsYoutubeUrl } from '../../lib/youtubeUrl'
import type { useBrandAssistant } from '../../hooks/useBrandAssistant'
import { AssistantMarkdown } from './AssistantMarkdown'

type AssistantApi = ReturnType<typeof useBrandAssistant>

export function BrandAssistantPanel({
  brandName,
  brandAccent,
  assistant,
  onMinimize,
  embedded = false,
}: {
  brandName: string
  brandAccent: string
  assistant: AssistantApi
  onMinimize: () => void
  embedded?: boolean
}) {
  const [input, setInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    loading,
    loadingHistory,
    error,
    pendingAttachments,
    sendMessage,
    clearHistory,
    addFileAttachment,
    removeAttachment,
    detectYoutubeInInput,
  } = assistant

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const onSend = () => {
    if (loading) return
    void sendMessage(input)
    setInput('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const onInputChange = (v: string) => {
    setInput(v)
    if (textContainsYoutubeUrl(v)) detectYoutubeInInput(v)
  }

  const hasAttachments = pendingAttachments.length > 0

  const panelStyle: CSSProperties = embedded
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'transparent',
      }
    : {
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        height: 600,
        maxHeight: '80vh',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(10,10,22,0.78)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid color-mix(in srgb, ${brandAccent} 35%, rgba(255,255,255,0.1))`,
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }

  const Wrapper = embedded ? 'div' : motion.div
  const wrapperProps = embedded
    ? { style: panelStyle }
    : {
        initial: { opacity: 0, scale: 0.92, originX: 1, originY: 1 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.92 },
        transition: { type: 'spring' as const, stiffness: 420, damping: 32 },
        style: panelStyle,
      }

  return (
    <Wrapper {...wrapperProps}>
      <header
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
            {brandName}
          </div>
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
            ASSISTENT
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <HeaderBtn label="Verlauf löschen" onClick={() => void clearHistory()} />
          {!embedded ? <HeaderBtn label="—" onClick={onMinimize} /> : null}
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px' }}>
        {loadingHistory ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Lade Verlauf…
          </p>
        ) : null}
        {!loadingHistory && messages.length === 0 && !loading ? (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Frag mich etwas zu deiner Brand — oder hänge eine Datei / YouTube-Video an.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <MessageBubble key={`${m.role}-${i}`} role={m.role} content={m.content} />
        ))}
        {loading &&
        messages[messages.length - 1]?.role === 'assistant' &&
        !messages[messages.length - 1]?.content?.trim() ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Assistent denkt… (Brand-DNA wird geladen)
          </p>
        ) : null}
        
        <div ref={endRef} />
      </div>

      {error ? (
        <p style={{ fontSize: 11, color: 'var(--accent-coral)', padding: '0 14px 8px', margin: 0 }}>{error}</p>
      ) : null}

      {hasAttachments ? (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pendingAttachments.map((a, i) => (
            <AttachmentChip key={i} att={a} onRemove={() => removeAttachment(i)} />
          ))}
        </div>
      ) : null}

      {hasAttachments ? (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ASSISTANT_QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.id}
              type="button"
              className="font-mono"
              disabled={loading}
              onClick={() => void sendMessage(qa.prompt, { attachments: pendingAttachments })}
              style={chipStyle(brandAccent)}
            >
              {qa.label}
            </button>
          ))}
        </div>
      ) : null}

      <footer style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <input
          ref={fileRef}
          type="file"
          accept={assistantFileAccept()}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void addFileAttachment(f)
            e.target.value = ''
          }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button
            type="button"
            title="Datei anhängen"
            onClick={() => fileRef.current?.click()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            +
          </button>
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Nachricht… (YouTube-Link wird erkannt)"
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={loading || (!input.trim() && !hasAttachments)}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: brandAccent,
              color: '#0a0a12',
              fontWeight: 700,
              fontSize: 12,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || (!input.trim() && !hasAttachments) ? 0.45 : 1,
            }}
          >
            Senden
          </button>
        </div>
      </footer>
    </Wrapper>
  )
}

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div
        style={{
          maxWidth: '92%',
          padding: '10px 12px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser
            ? 'color-mix(in srgb, var(--brand-accent, var(--accent-teal)) 20%, rgba(255,255,255,0.06))'
            : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {isUser ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{content}</p>
        ) : content ? (
          <AssistantMarkdown content={content} />
        ) : (
          <p className="font-mono" style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)' }}>
            …
          </p>
        )}
      </div>
    </div>
  )
}

function AttachmentChip({ att, onRemove }: { att: AssistantAttachment; onRemove: () => void }) {
  const label =
    att.type === 'youtube'
      ? 'YouTube'
      : `${att.fileName}${att.truncated ? ' (gekürzt)' : ''}`
  return (
    <span style={chipStyle('var(--text-secondary)')}>
      {label}
      <button type="button" onClick={onRemove} style={{ marginLeft: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}>
        ×
      </button>
    </span>
  )
}

function chipStyle(accent: string): CSSProperties {
  return {
    fontSize: 9,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '5px 8px',
    borderRadius: 8,
    border: `1px solid color-mix(in srgb, ${accent} 40%, rgba(255,255,255,0.12))`,
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  }
}

function HeaderBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="font-mono"
      onClick={onClick}
      style={{
        fontSize: 9,
        padding: '5px 8px',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'transparent',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
