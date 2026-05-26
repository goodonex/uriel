import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivityLog } from '../../hooks/useActivityLog'
import { useNotifications } from '../../hooks/useNotifications'
import type { ActivityEntityType, ActivityEntry } from '../../lib/activityLog'

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

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const diff = Math.max(0, Math.round((Date.now() - d) / 1000))
    if (diff < 60) return 'gerade eben'
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

const AUTO_READ_DELAY_MS = 1200

export function HubActivityFeed({ slug }: { slug: string }) {
  const log = useActivityLog(slug, 60)
  const follow = useNotifications(slug)
  const navigate = useNavigate()

  /**
   * Beim Öffnen des Feeds nach kurzer Sichtbarkeit automatisch:
   *  - alle activity_log-Einträge als gelesen markieren
   *  - alle heutigen Follow-ups als gelesen markieren
   *  - überfällige Follow-ups BLEIBEN immer ungelesen bis der Lead erledigt ist
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (log.unreadCount > 0) void log.markAllRead()
      follow.markTodayFollowUpsRead()
    }, AUTO_READ_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [log, follow])

  const handleClickEntry = (entry: ActivityEntry) => {
    void log.markRead(entry.id)
    if (!entry.entity_id) return
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

  const overdueItems = follow.overdueFollowUps ?? []
  const todayItems = follow.todayFollowUps ?? []
  const hasAnything = overdueItems.length > 0 || todayItems.length > 0 || log.items.length > 0

  return (
    <div className="flex h-full flex-col overflow-y-auto px-2 py-2">
      {overdueItems.length > 0 ? (
        <section className="mb-3">
          <h3
            className="font-mono mb-1 px-2"
            style={{ fontSize: 10, color: 'var(--accent-coral)', letterSpacing: '0.12em' }}
          >
            Überfällig
          </h3>
          {overdueItems.map((it) => (
            <button
              key={it.id}
              type="button"
              className="mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left"
              style={{
                background: 'color-mix(in srgb, var(--accent-coral) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-coral) 35%, transparent)',
              }}
              onClick={() => navigate(`/brand/${slug}/sales/${it.contact.id}`)}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {it.contact.name || it.contact.email || 'Kontakt'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{it.label}</span>
            </button>
          ))}
        </section>
      ) : null}

      {todayItems.length > 0 ? (
        <section className="mb-3">
          <h3
            className="font-mono mb-1 px-2"
            style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.12em' }}
          >
            Heute
          </h3>
          {todayItems.map((it) => (
            <button
              key={it.id}
              type="button"
              className="mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-[var(--glass-2)]"
              onClick={() => {
                follow.markFollowUpRead(it.contact.id)
                navigate(`/brand/${slug}/sales/${it.contact.id}`)
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {it.contact.name || it.contact.email || 'Kontakt'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{it.label}</span>
            </button>
          ))}
        </section>
      ) : null}

      <section>
        <h3
          className="font-mono mb-1 px-2"
          style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.12em' }}
        >
          Aktivität
        </h3>
        {log.loading ? (
          <p className="font-mono px-2 py-2" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Laden…
          </p>
        ) : log.items.length === 0 ? (
          <p
            className="font-mono px-2 py-2"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            Keine neuen Einträge.
          </p>
        ) : null}
        {log.items.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-[var(--glass-2)]"
            onClick={() => handleClickEntry(entry)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {ENTITY_LABEL[entry.entity_type]}
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {relativeTime(entry.created_at)}
              </span>
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{entry.summary}</span>
          </button>
        ))}
      </section>

      {!hasAnything && !log.loading ? (
        <div
          className="font-body"
          style={{
            padding: 28,
            fontSize: 13,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          Noch keine Aktivität.
        </div>
      ) : null}
    </div>
  )
}

/**
 * Badge-Zähler für die Chat-Blase: ungelesene Activity-Log-Einträge
 * + ungelesene Follow-ups (überfällig zählt immer, heute nur wenn nicht angeschaut).
 */
export function useHubActivityUnread(slug: string) {
  const log = useActivityLog(slug, 60)
  const follow = useNotifications(slug)
  return follow.followUpBadgeCount + log.unreadCount
}
