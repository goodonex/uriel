import { useNavigate, useParams } from 'react-router-dom'
import { companyDisplayName } from '../../lib/crmContacts'
import { useDailyWorkList, type WorkItem } from '../../hooks/useDailyWorkList'
import { usePostCallFlow } from '../../hooks/usePostCallFlow'

const PRIORITY_COLOR: Record<1 | 2 | 3, string> = {
  1: 'var(--accent-coral)',
  2: '#f59e0b',
  3: 'var(--text-tertiary)',
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

function fmtRel(iso: string | null): string {
  if (!iso) return 'nie kontaktiert'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 86_400_000) return 'heute'
    const days = Math.floor(diff / 86_400_000)
    if (days === 1) return 'vor 1 Tag'
    return `vor ${days} Tagen`
  } catch {
    return ''
  }
}

function contactPhone(item: WorkItem): string {
  return item.contact.phone?.trim() || ''
}

function contactPerson(item: WorkItem): string {
  return item.contact.ansprechpartner?.trim() || item.contact.name?.trim() || '—'
}

function SummaryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono"
      style={{
        fontSize: 11,
        padding: '6px 12px',
        borderRadius: 999,
        border: active ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
        background: active
          ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
          : 'var(--glass-2)',
        color: active ? 'var(--mode-sales)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {count} {label}
    </button>
  )
}

export function DailyWorkList() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const {
    items,
    allItems,
    filter,
    setFilter,
    overdueCount,
    todayCount,
    coldCount,
    loading,
    error,
    skipItem,
  } = useDailyWorkList(slug)
  const { openPostCall } = usePostCallFlow()

  const handleCalled = (item: WorkItem) => {
    const idx = allItems.findIndex((i) => i.contact.id === item.contact.id)
    openPostCall({
      contactId: item.contact.id,
      queue: allItems,
      queueIndex: idx >= 0 ? idx : 0,
      source: 'daily',
    })
  }

  if (!slug) return null

  return (
    <div style={{ padding: '8px 4px 24px', pointerEvents: 'auto' }}>
      <div
        className="font-mono mb-4"
        style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--mode-sales)' }}
      >
        HEUTE
      </div>
      <h2
        className="font-display mb-4"
        style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}
      >
        Was mache ich heute?
      </h2>
      <button
        type="button"
        onClick={() => navigate(`/brand/${slug}#daily-scorecard`)}
        className="font-mono mb-4"
        style={{
          fontSize: 10,
          padding: '5px 10px',
          borderRadius: 7,
          border: '1px solid var(--glass-border-2)',
          background: 'transparent',
          color: 'var(--mode-sales)',
          cursor: 'pointer',
        }}
      >
        Tagesbuch öffnen →
      </button>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SummaryChip
          label="überfällig"
          count={overdueCount}
          active={filter === 'overdue'}
          onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
        />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>·</span>
        <SummaryChip
          label="heute"
          count={todayCount}
          active={filter === 'today'}
          onClick={() => setFilter(filter === 'today' ? 'all' : 'today')}
        />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>·</span>
        <SummaryChip
          label="kalt"
          count={coldCount}
          active={filter === 'cold'}
          onClick={() => setFilter(filter === 'cold' ? 'all' : 'cold')}
        />
        {filter !== 'all' ? (
          <button
            type="button"
            className="font-mono"
            onClick={() => setFilter('all')}
            style={{
              fontSize: 10,
              marginLeft: 4,
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Alle zeigen
          </button>
        ) : null}
      </div>

      {loading ? (
        <div
          className="animate-pulse"
          style={{
            minHeight: 160,
            borderRadius: 14,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ) : null}

      {error ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div
          className="glass-2 font-mono rounded-xl p-6 text-center"
          style={{ fontSize: 12, color: 'var(--text-tertiary)', border: '1px solid var(--glass-border-1)' }}
        >
          Keine offenen Aktionen für heute.
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const phone = contactPhone(item)
          const href = telHref(phone)
          return (
            <li
              key={item.contact.id}
              className="glass-2"
              style={{
                borderRadius: 12,
                border: `1px solid var(--glass-border-1)`,
                borderLeft: `4px solid ${PRIORITY_COLOR[item.priority]}`,
                padding: '12px 14px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div
                  className="font-display"
                  style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  {companyDisplayName(item.contact)}
                </div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {contactPerson(item)}
                  {phone ? (
                    <>
                      {' · '}
                      <a
                        href={href}
                        style={{ color: 'var(--mode-sales)', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {phone}
                      </a>
                    </>
                  ) : null}
                </div>
                <div className="font-mono" style={{ fontSize: 10, color: PRIORITY_COLOR[item.priority], marginTop: 4 }}>
                  {item.action}
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                    · {fmtRel(item.contact.last_contact_at)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="font-mono"
                  onClick={() => handleCalled(item)}
                  style={{
                    fontSize: 11,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--mode-sales)',
                    background: 'color-mix(in srgb, var(--mode-sales) 16%, transparent)',
                    color: 'var(--mode-sales)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Angerufen
                </button>
                <button
                  type="button"
                  className="font-mono"
                  onClick={() => skipItem(item.contact.id)}
                  style={{
                    fontSize: 11,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--glass-border-2)',
                    background: 'var(--glass-2)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Überspringen
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
