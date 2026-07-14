import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../../Toast'
import {
  instagramEmbedUrl,
  linkedInProfileUrl,
  normalizeWebsiteUrl,
} from '../../../lib/contactUrls'
import type { Contact } from '../../../types/db'

type ChannelKey = 'phone' | 'email' | 'website' | 'instagram' | 'linkedin'

const CHANNELS: Array<{
  key: ChannelKey
  label: string
  accent: string
  placeholder: string
  icon: ReactNode
}> = [
  { key: 'phone', label: 'Telefon', accent: 'var(--mode-sales)', placeholder: '+49 …', icon: <PhoneIcon /> },
  { key: 'email', label: 'E-Mail', accent: 'var(--accent-blue)', placeholder: 'name@firma.de', icon: <MailIcon /> },
  { key: 'website', label: 'Website', accent: 'var(--accent-teal)', placeholder: 'https://…', icon: <WebIcon /> },
  { key: 'instagram', label: 'Instagram', accent: '#E1306C', placeholder: '@handle', icon: <InstaIcon /> },
  { key: 'linkedin', label: 'LinkedIn', accent: '#0A66C2', placeholder: 'linkedin.com/in/…', icon: <LinkedInIcon /> },
]

export function ContactChannelButtons({
  contact,
  onField,
  trailing,
  phoneChoices = [],
}: {
  contact: Contact
  onField: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  trailing?: React.ReactNode
  phoneChoices?: Array<{ label: string; value: string }>
}) {
  const { show } = useToast()
  const rootRef = useRef<HTMLDivElement>(null)
  const [openKey, setOpenKey] = useState<ChannelKey | null>(null)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!openKey) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpenKey(null)
        setEditing(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [openKey])

  const openChannel = (key: ChannelKey) => {
    const value = (contact[key] as string) ?? ''
    if (openKey === key) {
      setOpenKey(null)
      setEditing(false)
      return
    }
    setOpenKey(key)
    setDraft(value)
    setEditing(!value.trim())
  }

  const save = () => {
    if (!openKey) return
    onField({ [openKey]: draft.trim() } as Partial<Omit<Contact, 'id' | 'brand_id'>>)
    setEditing(false)
    show(`${CHANNELS.find((c) => c.key === openKey)?.label} gespeichert`, 'success')
  }

  return (
    <div
      ref={rootRef}
      style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
    >
      {CHANNELS.map((ch, idx) => {
        const value = (contact[ch.key] as string) ?? ''
        const has = value.trim().length > 0
        const isOpen = openKey === ch.key
        const popoverAlignRight = idx >= CHANNELS.length - 2
        return (
          <div key={ch.key} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => openChannel(ch.key)}
              title={has ? `${ch.label}: ${value}` : `${ch.label} eintragen`}
              aria-expanded={isOpen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 10,
                border: isOpen
                  ? `1px solid color-mix(in srgb, ${ch.accent} 55%, var(--glass-border-2))`
                  : has
                    ? `1px solid color-mix(in srgb, ${ch.accent} 40%, var(--glass-border-2))`
                    : '1px solid var(--glass-border-2)',
                background: isOpen
                  ? `color-mix(in srgb, ${ch.accent} 22%, var(--bg-base))`
                  : has
                    ? `color-mix(in srgb, ${ch.accent} 16%, var(--bg-base))`
                    : 'color-mix(in srgb, var(--bg-base) 90%, var(--glass-2))',
                color: has || isOpen ? ch.accent : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: isOpen ? `0 0 0 1px color-mix(in srgb, ${ch.accent} 25%, transparent)` : undefined,
              }}
            >
              {ch.icon}
            </button>

            {isOpen ? (
              <div
                className="font-mono"
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  ...(popoverAlignRight ? { right: 0 } : { left: 0 }),
                  zIndex: 80,
                  width:
                    has && (ch.key === 'website' || ch.key === 'instagram') && !editing
                      ? 300
                      : undefined,
                  minWidth: 260,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  background: 'color-mix(in srgb, var(--bg-base) 94%, transparent)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {ch.label.toUpperCase()}
                </div>
                {editing ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={ch.placeholder}
                      style={popoverInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') save()
                        if (e.key === 'Escape') {
                          setEditing(false)
                          setDraft(value)
                          if (!value.trim()) setOpenKey(null)
                        }
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {has && ch.key === 'phone' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginRight: 'auto' }}>
                          {(phoneChoices.length > 0 ? phoneChoices : [{ label: 'Telefon', value }]).map(
                            (choice) => (
                              <a
                                key={`${choice.label}-${choice.value}`}
                                href={`tel:${choice.value.replace(/[^\d+]/g, '')}`}
                                className="font-mono"
                                style={{
                                  ...popoverBtn,
                                  textDecoration: 'none',
                                  fontSize: 10,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                {choice.label}
                              </a>
                            ),
                          )}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false)
                          setDraft(value)
                          if (!value.trim()) setOpenKey(null)
                        }}
                        style={popoverBtnGhost}
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={save}
                        style={{ ...popoverBtn, color: ch.accent, borderColor: ch.accent }}
                      >
                        Speichern
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: has ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {value || `${ch.label} fehlt`}
                    </div>
                    {has && ch.key === 'website' ? (
                      <WebsitePopoverPreview url={normalizeWebsiteUrl(value)} />
                    ) : null}
                    {has && ch.key === 'instagram' ? (
                      <InstagramPopoverPreview embedUrl={instagramEmbedUrl(value)} />
                    ) : null}
                    {has && ch.key === 'linkedin' ? (
                      <LinkedInPopoverHint url={linkedInProfileUrl(value)} />
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!has) {
                            setEditing(true)
                            return
                          }
                          void navigator.clipboard.writeText(value.trim()).then(() =>
                            show(`${ch.label} kopiert`, 'success'),
                          )
                        }}
                        style={popoverBtnGhost}
                        disabled={!has}
                      >
                        Kopieren
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(true)
                          setDraft(value)
                        }}
                        style={{ ...popoverBtn, color: ch.accent, borderColor: ch.accent }}
                      >
                        Ändern
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
      {trailing ? <div style={{ display: 'inline-flex', alignItems: 'center' }}>{trailing}</div> : null}
    </div>
  )
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '9 / 19.5',
        borderRadius: 26,
        padding: 8,
        background: 'linear-gradient(180deg, var(--glass-3) 0%, var(--bg-surface) 100%)',
        border: '1px solid var(--glass-border-1)',
        boxShadow: 'inset 0 0 0 1px var(--glass-border-1), var(--shadow-md)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 56,
          height: 5,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 18,
          overflow: 'hidden',
          background: 'var(--glass-2)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function WebsitePopoverPreview({ url }: { url: string }) {
  const [stage, setStage] = useState<'iframe' | 'screenshot' | 'fallback'>('iframe')
  const shot = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&viewport.isMobile=true&viewport.width=390&viewport.height=844&embed=screenshot.url`

  return (
    <PhoneFrame>
      {stage === 'iframe' ? (
        <iframe
          title="Website preview"
          src={url}
          sandbox="allow-scripts allow-same-origin"
          onError={() => setStage('screenshot')}
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
        />
      ) : stage === 'screenshot' ? (
        <img
          src={shot}
          alt="Website Screenshot"
          onError={() => setStage('fallback')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            padding: 12,
            textAlign: 'center',
          }}
        >
          Keine Vorschau verfügbar
        </div>
      )}
      <button
        type="button"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
        className="font-mono"
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          fontSize: 9,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(0,0,0,0.55)',
          color: 'rgba(255,255,255,0.92)',
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          zIndex: 3,
        }}
      >
        Öffnen ↗
      </button>
    </PhoneFrame>
  )
}

function InstagramPopoverPreview({ embedUrl }: { embedUrl: string | null }) {
  if (!embedUrl) return null
  return (
    <PhoneFrame>
      <iframe
        title="Instagram preview"
        src={embedUrl}
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer"
        style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      />
    </PhoneFrame>
  )
}

function LinkedInPopoverHint({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <button
      type="button"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      className="font-mono"
      style={{
        fontSize: 10,
        padding: '8px 10px',
        borderRadius: 7,
        border: '1px solid #0A66C2',
        background: 'color-mix(in srgb, #0A66C2 12%, transparent)',
        color: '#0A66C2',
        cursor: 'pointer',
        textAlign: 'left',
        wordBreak: 'break-all',
      }}
    >
      Profil öffnen ↗
    </button>
  )
}

const popoverInput = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 12,
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'color-mix(in srgb, var(--bg-base) 96%, var(--glass-2))',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
} as const

const popoverBtn = {
  fontSize: 10,
  padding: '5px 10px',
  borderRadius: 7,
  border: '1px solid var(--mode-sales)',
  background: 'color-mix(in srgb, var(--bg-base) 90%, transparent)',
  color: 'var(--mode-sales)',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const

const popoverBtnGhost = {
  ...popoverBtn,
  border: '1px solid var(--glass-border-2)',
  color: 'var(--text-secondary)',
} as const

function PhoneIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M3 3 L5 3 L6 6 L4.5 7 a8 8 0 0 0 4.5 4.5 L10 10 L13 11 L13 13 a1 1 0 0 1 -1 1 a11 11 0 0 1 -11 -11 a1 1 0 0 1 1 -1 Z" />
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 4 L8 9 L14 4" />
    </svg>
  )
}
function WebIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8 H14 M8 2 a8 8 0 0 1 0 12 M8 2 a8 8 0 0 0 0 12" />
    </svg>
  )
}
function InstaIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="2" width="12" height="12" rx="3" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="11.5" cy="4.5" r="0.7" fill="currentColor" />
    </svg>
  )
}
function LinkedInIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 5.5a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm-1 1.5h2v6h-2v-6Zm4 0h1.9v.85h.03c.27-.5.92-1.05 1.9-1.05 2.03 0 2.4 1.3 2.4 3v3.2h-2v-2.84c0-.68-.01-1.55-.95-1.55-.95 0-1.1.73-1.1 1.5v2.89h-2v-6Z" />
    </svg>
  )
}
