import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBrands } from '../../hooks/useBrands'
import { useBrandAssistant } from '../../hooks/useBrandAssistant'
import { useHubBadgeCount } from '../../hooks/useGlobalMessages'
import { useAuth } from '../../hooks/useAuth'
import { BrandAssistantPanel } from './BrandAssistantPanel'
import { HubActivityFeed, useHubActivityUnread } from './HubActivityFeed'
import { MessagesInbox } from './MessagesInbox'

type HubTab = 'ai' | 'messages' | 'activity'

const TABS: { id: HubTab; label: string; icon: string }[] = [
  { id: 'ai', label: 'KI', icon: '✦' },
  { id: 'messages', label: 'Nachrichten', icon: '💬' },
  { id: 'activity', label: 'Aktivität', icon: '🔔' },
]

export function CommunicationHub() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug)
  const assistant = useBrandAssistant(slug)
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<HubTab>('ai')

  const hubBadge = useHubBadgeCount(slug)
  const activityUnread = useHubActivityUnread(slug)
  const badgeTotal = hubBadge + activityUnread

  if (!slug || !brand) return null

  const accent = brand.color || 'var(--accent-teal)'
  const senderName =
    (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
    'Team'

  const tabBadge = (id: HubTab) => {
    if (id === 'messages') return hubBadge
    if (id === 'activity') return activityUnread
    return 0
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, originX: 1, originY: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{
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
              background: 'var(--glass-3)',
              border: '1px solid var(--glass-border-2)',
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <header
              className="flex items-center gap-1 border-b px-2 py-2"
              style={{ borderColor: 'var(--glass-border-2)' }}
            >
              {TABS.map((t) => {
                const count = tabBadge(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="relative flex flex-1 items-center justify-center gap-1 rounded-lg py-2"
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      background: tab === t.id ? 'var(--glass-4)' : 'transparent',
                      color: tab === t.id ? accent : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => setTab(t.id)}
                  >
                    <span>{t.icon}</span>
                    {t.label}
                    {count > 0 ? (
                      <span
                        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1"
                        style={{ fontSize: 9, background: accent, color: 'var(--chip-text-on-accent)' }}
                      >
                        {count > 9 ? '9+' : count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
              <button
                type="button"
                aria-label="Hub schließen"
                onClick={() => setOpen(false)}
                style={{
                  marginLeft: 4,
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden">
              {tab === 'ai' ? (
                <BrandAssistantPanel
                  brandName={brand.name}
                  brandAccent={accent}
                  assistant={assistant}
                  onMinimize={() => setOpen(false)}
                  embedded
                />
              ) : null}
              {tab === 'messages' ? <MessagesInbox slug={slug} senderName={senderName} /> : null}
              {tab === 'activity' ? <HubActivityFeed slug={slug} /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!open ? (
        <motion.button
          type="button"
          aria-label="Kommunikations-Hub öffnen"
          onClick={() => setOpen(true)}
          animate={{
            boxShadow: [
              `0 0 0 0 color-mix(in srgb, ${accent} 0%, transparent)`,
              `0 0 0 10px color-mix(in srgb, ${accent} 18%, transparent)`,
              `0 0 0 0 color-mix(in srgb, ${accent} 0%, transparent)`,
            ],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 8999,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `1px solid color-mix(in srgb, ${accent} 55%, var(--glass-border-2))`,
            background: `color-mix(in srgb, ${accent} 35%, var(--bg-surface))`,
            backdropFilter: 'blur(12px)',
            color: '#0a0a12',
            fontSize: 22,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          ✦
          {badgeTotal > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: 'var(--accent-coral)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
                padding: '0 4px',
              }}
            >
              {badgeTotal > 9 ? '9+' : badgeTotal}
            </span>
          ) : null}
        </motion.button>
      ) : null}
    </>
  )
}

/** @deprecated Use CommunicationHub */
export const BrandAssistant = CommunicationHub
