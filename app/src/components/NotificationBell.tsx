import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivityLog } from '../hooks/useActivityLog'
import type { ActivityEntityType, ActivityEntry } from '../lib/activityLog'

interface NotificationBellProps {
  slug: string
  collapsed?: boolean
}

const ENTITY_LABEL: Record<ActivityEntityType, string> = {
  contact: 'Kontakt',
  task: 'Task',
  project: 'Projekt',
  positioning: 'Positioning',
  icp: 'ICP',
  business_model: 'Business Model',
  word_bank: 'Wortbank',
  content_piece: 'Piece',
  asset: 'Asset',
  sop: 'SOP',
}

const ENTITY_ACCENT: Record<ActivityEntityType, string> = {
  contact: 'var(--mode-sales)',
  task: 'var(--accent-blue)',
  project: 'var(--accent-teal)',
  positioning: 'var(--mode-building)',
  icp: 'var(--mode-building)',
  business_model: 'var(--mode-building)',
  word_bank: 'var(--mode-building)',
  content_piece: 'var(--mode-promo)',
  asset: 'var(--text-tertiary)',
  sop: 'var(--text-tertiary)',
}

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const now = Date.now()
    const diff = Math.max(0, Math.round((now - d) / 1000))
    if (diff < 60) return 'gerade eben'
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
    if (diff < 604800) return `vor ${Math.floor(diff / 86400)} d`
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

export function NotificationBell({ slug, collapsed }: NotificationBellProps) {
  const log = useActivityLog(slug, 60)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const handleClickEntry = (entry: ActivityEntry) => {
    void log.markRead(entry.id)
    if (!entry.entity_id) return
    setOpen(false)
    switch (entry.entity_type) {
      case 'contact':
        navigate(`/brand/${slug}/sales/${entry.entity_id}`)
        break
      case 'project':
        navigate(`/brand/${slug}/deliver/${entry.entity_id}`)
        break
      case 'task': {
        const ctxContact = (entry.metadata as Record<string, unknown>).contact_id
        if (typeof ctxContact === 'string') {
          navigate(`/brand/${slug}/sales/${ctxContact}`)
        } else {
          navigate(`/brand/${slug}/dashboard`)
        }
        break
      }
      case 'positioning':
      case 'icp':
      case 'business_model':
      case 'word_bank':
      case 'asset':
      case 'sop':
        navigate(`/brand/${slug}/foundation`)
        break
      case 'content_piece':
        navigate(`/brand/${slug}/promo`)
        break
    }
  }

  const handleToggle = () => {
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        title={`Aktivität${log.unreadCount > 0 ? ` (${log.unreadCount} ungelesen)` : ''}`}
        aria-label="Aktivität"
        className="relative flex shrink-0 items-center justify-center rounded-lg transition-colors"
        style={{
          width: collapsed ? '100%' : 30,
          height: 30,
          padding: 0,
          border: '1px solid var(--glass-border-2)',
          background: open ? 'var(--glass-2)' : 'var(--glass-1)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <svg
          width={13}
          height={13}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M3 6 A5 5 0 0 1 13 6 L13 9 L14 11 L2 11 L3 9 Z" />
          <path d="M6.5 13 a1.5 1.5 0 0 0 3 0" />
        </svg>
        {log.unreadCount > 0 ? (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 999,
              background: 'var(--accent-coral)',
              color: 'var(--bg-base)',
              fontWeight: 600,
              minWidth: 14,
              textAlign: 'center',
              letterSpacing: '0.02em',
              lineHeight: 1.3,
            }}
          >
            {log.unreadCount > 99 ? '99+' : log.unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
            className="fixed inset-0 z-[70]"
            style={{
              background: 'rgba(8, 12, 22, 0.45)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <motion.aside
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="font-body absolute right-0 top-0 flex h-full w-full max-w-md flex-col"
              style={{
                background: 'color-mix(in srgb, var(--bg-base) 96%, transparent)',
                borderLeft: '1px solid var(--glass-border-2)',
                boxShadow: '-24px 0 56px rgba(0,0,0,0.45)',
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--glass-border-1)',
                }}
              >
                <div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    AKTIVITÄT
                  </div>
                  <div
                    className="font-display"
                    style={{ fontSize: 16, fontWeight: 600 }}
                  >
                    Was passiert ist
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {log.unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => void log.markAllRead()}
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        padding: '6px 10px',
                        borderRadius: 7,
                        border: '1px solid var(--glass-border-2)',
                        background: 'var(--glass-1)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      Alle gelesen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '6px 9px',
                      borderRadius: 7,
                      border: '1px solid var(--glass-border-2)',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {log.loading ? (
                  <div
                    className="font-mono"
                    style={{ padding: 24, fontSize: 11, color: 'var(--text-tertiary)' }}
                  >
                    Lädt …
                  </div>
                ) : log.items.length === 0 ? (
                  <div
                    className="font-body"
                    style={{
                      padding: 28,
                      fontSize: 13,
                      color: 'var(--text-tertiary)',
                      textAlign: 'center',
                    }}
                  >
                    Noch keine Aktivität. Aktionen erscheinen hier automatisch.
                  </div>
                ) : (
                  <ul className="list-none p-0">
                    {log.items.map((e) => {
                      const accent = ENTITY_ACCENT[e.entity_type] ?? 'var(--text-tertiary)'
                      return (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => handleClickEntry(e)}
                            className="flex w-full items-start gap-3 text-left transition-colors"
                            style={{
                              padding: '12px 18px',
                              background: !e.read_at
                                ? 'color-mix(in srgb, var(--accent-blue) 6%, transparent)'
                                : 'transparent',
                              borderBottom: '1px solid var(--glass-border-1)',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                            }}
                            onMouseEnter={(ev) => {
                              ev.currentTarget.style.background = 'var(--glass-2)'
                            }}
                            onMouseLeave={(ev) => {
                              ev.currentTarget.style.background = !e.read_at
                                ? 'color-mix(in srgb, var(--accent-blue) 6%, transparent)'
                                : 'transparent'
                            }}
                          >
                            <span
                              className="shrink-0"
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                marginTop: 8,
                                background: !e.read_at ? accent : 'var(--glass-border-2)',
                                boxShadow: !e.read_at ? `0 0 6px ${accent}` : 'none',
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span
                                  className="font-mono"
                                  style={{
                                    fontSize: 9,
                                    color: accent,
                                    letterSpacing: '0.08em',
                                  }}
                                >
                                  {ENTITY_LABEL[e.entity_type]} · {e.action}
                                </span>
                                <span
                                  className="font-mono shrink-0"
                                  style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                                >
                                  {relativeTime(e.created_at)}
                                </span>
                              </div>
                              <div
                                className="font-body mt-1"
                                style={{
                                  fontSize: 12.5,
                                  color: 'var(--text-primary)',
                                  fontWeight: !e.read_at ? 500 : 400,
                                }}
                              >
                                {e.summary || '—'}
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
