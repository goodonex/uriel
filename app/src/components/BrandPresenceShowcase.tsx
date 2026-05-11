import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  hostLabel,
  normalizeWebUrl,
  useBrandPresence,
  type BrandPresence,
} from '../hooks/useBrandPresence'

const FIELD: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 12,
}

function SocialIcon({ kind }: { kind: Exclude<keyof BrandPresence, 'website_url'> }) {
  const common = { width: 16, height: 16, fill: 'currentColor' as const }
  switch (kind) {
    case 'instagram_url':
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A5.5 5.5 0 1 1 8.5 12 5.5 5.5 0 0 1 12 7.5zm0 2A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 9.5zm5.25-4.25a1.25 1.25 0 1 1-1.25 1.25 1.25 1.25 0 0 1 1.25-1.25z" />
        </svg>
      )
    case 'linkedin_url':
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M6.5 6.5h-4V20h4zm-2-6a2.25 2.25 0 1 0 2.25 2.25A2.25 2.25 0 0 0 4.5.5zM21.5 13.5v6.5h-4v-6c0-1.5-.5-2.5-2-2.5s-2 1.1-2 2.4V20h-4V9h4v1.5h.1a4.4 4.4 0 0 1 4-2.2c2.8 0 4.9 1.8 4.9 5.2z" />
        </svg>
      )
    case 'tiktok_url':
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M16.6 5.8c.9.9 2 1.4 3.2 1.5v3.1a6.7 6.7 0 0 1-3.9-1.3v5.9a5.7 5.7 0 1 1-5.7-5.7c.2 0 .4 0 .6.1v3.5a2.3 2.3 0 0 0-.6-.1 2.3 2.3 0 1 0 2.3 2.3V2h3.1a3.3 3.3 0 0 0 0 3.8z" />
        </svg>
      )
    case 'youtube_url':
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C18 4.5 12 4.5 12 4.5s-6 0-7.6.7a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.6.7 7.6.7 7.6.7s6 0 7.6-.7a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .4-4.8 29 29 0 0 0-.4-4.8zM10 14.9V9.1L15.2 12z" />
        </svg>
      )
    case 'x_url':
      return (
        <svg viewBox="0 0 24 24" {...common} aria-hidden>
          <path d="M18.2 3H21l-5.9 6.7L22 21h-5.4l-4.2-5.5L6.8 21H4l6.3-7.2L2 3h5.5l3.8 5 4.9-5zm-1.9 16h1.7L8.9 5H7l8.3 14z" />
        </svg>
      )
  }
}

const SOCIAL_KEYS: Array<{ key: Exclude<keyof BrandPresence, 'website_url'>; label: string }> = [
  { key: 'instagram_url', label: 'Instagram' },
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'tiktok_url', label: 'TikTok' },
  { key: 'youtube_url', label: 'YouTube' },
  { key: 'x_url', label: 'X' },
]

export function BrandPresenceShowcase({
  slug,
  brandName,
  accent = 'var(--accent-teal)',
}: {
  slug: string
  brandName: string
  accent?: string
}) {
  const { presence, updatePresence } = useBrandPresence(slug)
  const [open, setOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const embedSrc = useMemo(() => {
    const u = normalizeWebUrl(presence.website_url)
    return u || ''
  }, [presence.website_url])

  const previewHost = hostLabel(presence.website_url)
  const hasAnySocial = SOCIAL_KEYS.some(({ key }) => presence[key].trim().length > 0)

  return (
    <section
      className="mb-6 overflow-hidden rounded-2xl"
      style={{
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{
          border: 'none',
          background: open ? 'color-mix(in srgb, var(--glass-3) 50%, transparent)' : 'transparent',
          cursor: 'pointer',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded-xl"
          style={{
            width: 40,
            height: 40,
            background: `color-mix(in srgb, ${accent} 18%, transparent)`,
            color: accent,
            border: `1px solid color-mix(in srgb, ${accent} 35%, var(--glass-border-2))`,
          }}
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6}>
            <circle cx="12" cy="12" r="9" />
            <path d="M2 12h20M12 2a15 15 0 0 0 0 20M12 2a15 15 0 0 1 0 20" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="font-mono block"
            style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
          >
            WEB & SOCIAL
          </span>
          <span className="font-display mt-0.5 block truncate" style={{ fontSize: 15, fontWeight: 600 }}>
            {brandName}
          </span>
          <span className="font-mono mt-0.5 block truncate" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {previewHost || (hasAnySocial ? 'Nur Soziale Kanäle' : 'URLs unter „Anpassen“ hinterlegen')}
          </span>
        </span>
        <span
          className="font-mono shrink-0"
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.25s ease',
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="border-t border-[var(--glass-border-1)] px-4 pb-4 pt-1">
          {embedSrc ? (
            <div
              className="overflow-hidden rounded-xl"
              style={{ border: '1px solid var(--glass-border-2)', background: 'var(--bg-base)' }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{
                  background: 'color-mix(in srgb, var(--bg-base) 85%, #1a2e33)',
                  borderBottom: '1px solid var(--glass-border-1)',
                }}
              >
                <span className="flex shrink-0 gap-1.5">
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: '#ff5f57' }} />
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: '#febc2e' }} />
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: '#28c840' }} />
                </span>
                <div
                  className="font-mono min-w-0 flex-1 truncate rounded-lg px-3 py-1"
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    background: 'var(--glass-1)',
                    border: '1px solid var(--glass-border-2)',
                  }}
                >
                  {previewHost}
                </div>
                <a
                  href={embedSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono shrink-0"
                  style={{ fontSize: 10, color: accent, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗
                </a>
              </div>
              <div className="relative" style={{ height: 'min(420px, 52vh)' }}>
                <iframe
                  title={`Website ${brandName}`}
                  src={embedSrc}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          ) : (
            <p className="font-body py-6 text-center" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              Noch keine Website-URL — unten bei „Links anpassen“ eintragen.
            </p>
          )}

          {(hasAnySocial || embedSrc) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-mono w-full" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                KANÄLE
              </span>
              {SOCIAL_KEYS.map(({ key, label }) => {
                const href = presence[key].trim()
                if (!href) return null
                const url = normalizeWebUrl(href)
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono inline-flex items-center gap-2 rounded-full px-3 py-2 transition-opacity hover:opacity-90"
                    style={{
                      fontSize: 11,
                      color: 'var(--text-primary)',
                      background: 'var(--glass-1)',
                      border: '1px solid var(--glass-border-2)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ color: accent, display: 'inline-flex' }}>
                      <SocialIcon kind={key} />
                    </span>
                    {label}
                  </a>
                )
              })}
              {!hasAnySocial ? (
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Keine Social-Links hinterlegt.
                </span>
              ) : null}
            </div>
          )}

          <div className="mt-4 border-t border-[var(--glass-border-1)] pt-3">
            <button
              type="button"
              className="font-mono"
              onClick={() => setEditorOpen((e) => !e)}
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                color: accent,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {editorOpen ? 'Links ausblenden' : 'Links anpassen (lokal)'}
            </button>

            {editorOpen ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="font-mono mb-1 block" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                    Website
                  </span>
                  <input
                    type="url"
                    value={presence.website_url}
                    onChange={(e) => updatePresence({ website_url: e.target.value })}
                    placeholder="https://…"
                    style={FIELD}
                    autoComplete="off"
                  />
                </label>
                {SOCIAL_KEYS.map(({ key, label }) => (
                  <label key={key} className="block">
                    <span className="font-mono mb-1 block" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {label}
                    </span>
                    <input
                      type="url"
                      value={presence[key]}
                      onChange={(e) =>
                        updatePresence({ [key]: e.target.value } as Partial<BrandPresence>)
                      }
                      placeholder="https://…"
                      style={FIELD}
                      autoComplete="off"
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <p className="font-mono mt-3" style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Hinweis: Manche Sites blockieren Einbettung im iframe — dann nutze „↗“. Daten nur in diesem Browser
            gespeichert.
          </p>
        </div>
      ) : null}
    </section>
  )
}
