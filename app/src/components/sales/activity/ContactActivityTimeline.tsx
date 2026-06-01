import { useEffect, useMemo, useState } from 'react'
import { useCallLogs, useEmailLogs } from '../../../hooks/useSalesPro'
import { useActivityEntries } from '../../../hooks/useActivityEntries'
import { useAuth } from '../../../hooks/useAuth'
import type { TimelineFilter } from '../../../lib/activityTypes'
import { ACTIVITY_META } from '../../../lib/activityTypes'
import { formatActivityDetails, hasActivityDetails } from '../../../lib/activityDetailFormat'
import {
  filterTimeline,
  fmtRel,
  mergeTimelineEntries,
  type MergedTimelineEntry,
} from '../../../lib/activityTimeline'
import type { ActivityEntry, Contact, SalesEmailLog } from '../../../types/db'

const FILTERS: Array<{ key: TimelineFilter; label: string }> = [
  { key: 'all', label: 'Alle' },
  { key: 'wichtig', label: 'Wichtig' },
  { key: 'gespraeche', label: 'Gespräche' },
  { key: 'notizen', label: 'Notizen & Summaries' },
]

const LEGACY_META = { label: 'Anruf (alt)', icon: '📞', color: 'var(--text-tertiary)' }

export function ContactActivityTimeline({
  brandSlug,
  contact,
  refreshToken,
  onEditActivity,
}: {
  brandSlug: string
  contact: Contact
  refreshToken?: number
  onEditActivity?: (entry: ActivityEntry) => void
}) {
  const calls = useCallLogs(brandSlug, { contactId: contact.id })
  const activities = useActivityEntries(brandSlug, { contactId: contact.id })

  useEffect(() => {
    if (refreshToken === undefined || refreshToken === 0) return
    void activities.reload()
  }, [refreshToken, activities.reload])
  const mails = useEmailLogs(brandSlug, { contactId: contact.id })
  const { user } = useAuth()
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const performerMap = useMemo(() => {
    const m: Record<string, string> = {}
    if (user?.id) m[user.id] = user.email?.split('@')[0] ?? 'Du'
    return m
  }, [user])

  const emailExtras: MergedTimelineEntry[] = useMemo(
    () =>
      mails.items.map((m) => ({
        id: `mail:${m.id}`,
        type: 'email',
        timestamp: m.sent_at,
        summary: m.subject || '(Kein Betreff)',
        data: {},
        source: 'email' as const,
        meta: m.replied_at ? 'geantwortet' : m.opened_at ? 'geöffnet' : m.direction,
        bodyPreview: m.body_preview,
        readOnly: true,
        mailLogId: m.id,
      })),
    [mails.items],
  )

  const legacyNotes: MergedTimelineEntry[] = useMemo(
    () =>
      (contact.activity_log ?? []).map((a) => ({
        id: `legacy:note:${a.id}`,
        type: 'legacy_note',
        timestamp: a.at,
        summary: a.text,
        data: { text: a.text },
        source: 'note' as const,
        readOnly: true,
      })),
    [contact.activity_log],
  )

  const merged = useMemo(
    () =>
      filterTimeline(
        mergeTimelineEntries(calls.items, activities.items, performerMap, [
          ...emailExtras,
          ...legacyNotes,
        ]),
        filter,
      ),
    [calls.items, activities.items, performerMap, emailExtras, legacyNotes, filter],
  )

  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 8 }}
        >
          VERLAUF · {merged.length} EINTRÄGE
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FILTERS.map((f) => {
            const on = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
                  background: on ? 'color-mix(in srgb, var(--mode-sales) 15%, transparent)' : 'var(--glass-2)',
                  color: on ? 'var(--mode-sales)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {merged.length === 0 ? (
        <div
          style={{
            padding: 16,
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            background: 'var(--glass-2)',
            border: '1px dashed var(--glass-border-1)',
            borderRadius: 10,
          }}
        >
          Noch keine Aktivitäten in dieser Ansicht.
        </div>
      ) : (
        <ol className="list-none" style={{ margin: 0, padding: 0 }}>
          {merged.map((item, idx) => (
            <TimelineRow
              key={item.id}
              contact={contact}
              item={item}
              isLast={idx === merged.length - 1}
              expanded={expanded === item.id}
              onToggle={() => setExpanded((e) => (e === item.id ? null : item.id))}
              mails={mails.items}
              onUpdateMail={mails.update}
              onEditActivity={onEditActivity}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function TimelineRow({
  contact,
  item,
  isLast,
  expanded,
  onToggle,
  mails,
  onUpdateMail,
  onEditActivity,
}: {
  contact: Contact
  item: MergedTimelineEntry
  isLast: boolean
  expanded: boolean
  onToggle: () => void
  mails: SalesEmailLog[]
  onUpdateMail: (id: string, patch: Partial<SalesEmailLog>) => void
  onEditActivity?: (entry: ActivityEntry) => void
}) {
  const meta =
    item.source === 'legacy'
      ? LEGACY_META
      : item.type === 'legacy_note'
        ? { label: 'Notiz (alt)', icon: '💬', color: 'var(--text-tertiary)' }
        : item.source === 'email'
        ? { label: 'E-Mail', icon: '✉', color: 'var(--accent-blue)' }
        : item.activityType
          ? ACTIVITY_META[item.activityType]
          : { label: item.type, icon: '•', color: 'var(--text-secondary)' }

  const mailLog = item.mailLogId ? mails.find((m) => m.id === item.mailLogId) : undefined
  const activityEntryId = item.id.startsWith('activity:') ? item.id.slice('activity:'.length) : null
  const canEdit =
    Boolean(onEditActivity && activityEntryId && item.source === 'new' && item.activityType !== 'call')

  return (
    <li style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 14, position: 'relative' }}>
      {!isLast ? (
        <div
          style={{
            position: 'absolute',
            left: 13,
            top: 30,
            bottom: 0,
            width: 1,
            background: 'var(--glass-border-1)',
          }}
        />
      ) : null}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${meta.color} 18%, var(--glass-2))`,
          border: `1px solid ${meta.color}`,
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          flexShrink: 0,
          opacity: item.source === 'legacy' ? 0.75 : 1,
        }}
      >
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <button
          type="button"
          onClick={onToggle}
          style={{
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
            <span className="font-mono" style={{ fontSize: 9, color: meta.color, letterSpacing: '0.1em' }}>
              {meta.label.toUpperCase()}
              {item.meta ? (
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {item.meta}</span>
              ) : null}
            </span>
            <span
              className="font-mono"
              title={new Date(item.timestamp).toLocaleString('de-DE')}
              style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
            >
              {fmtRel(item.timestamp)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{item.summary}</div>
          {item.performerLabel ? (
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {item.performerLabel}
            </div>
          ) : null}
        </button>
        {expanded &&
        hasActivityDetails(
          item.activityType ?? (item.type === 'legacy_call' ? 'legacy_call' : item.type),
          item.data,
        ) ? (
          <ActivityDetailBlock
            activityType={
              item.activityType ?? (item.type === 'legacy_call' ? 'legacy_call' : item.type)
            }
            data={item.data}
          />
        ) : null}
        {expanded && canEdit && activityEntryId && onEditActivity ? (
          <button
            type="button"
            className="font-mono"
            onClick={() => {
              onEditActivity({
                id: activityEntryId,
                brand_id: contact.brand_id,
                contact_id: contact.id,
                activity_type: item.activityType!,
                performed_by: item.performedBy ?? null,
                data: item.data,
                created_at: item.timestamp,
              })
            }}
            style={{
              marginTop: 8,
              fontSize: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--mode-sales)',
              background: 'color-mix(in srgb, var(--mode-sales) 16%, #1a1a2e)',
              color: 'var(--mode-sales)',
              cursor: 'pointer',
            }}
          >
            Bearbeiten
          </button>
        ) : null}
        {item.bodyPreview ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: 'var(--text-primary)',
              background: '#1a1a2e',
              border: '1px solid var(--glass-border-2)',
              padding: '8px 10px',
              borderRadius: 8,
              lineHeight: 1.45,
            }}
          >
            {item.bodyPreview}
          </div>
        ) : null}
        {mailLog ? (
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <MailToggle
              on={!!mailLog.opened_at}
              label="geöffnet"
              onClick={() =>
                onUpdateMail(mailLog.id, {
                  opened_at: mailLog.opened_at ? null : new Date().toISOString(),
                })
              }
            />
            <MailToggle
              on={!!mailLog.replied_at}
              label="geantwortet"
              onClick={() =>
                onUpdateMail(mailLog.id, {
                  replied_at: mailLog.replied_at ? null : new Date().toISOString(),
                })
              }
            />
          </div>
        ) : null}
      </div>
    </li>
  )
}

function ActivityDetailBlock({
  activityType,
  data,
}: {
  activityType: string
  data: Record<string, unknown>
}) {
  const rows = formatActivityDetails(activityType, data)
  if (rows.length === 0) return null
  return (
    <div
      className="font-mono"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        background: '#1a1a2e',
        border: '1px solid var(--glass-border-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {rows.map((r) => (
        <div key={r.label}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              marginBottom: 3,
            }}
          >
            {r.label.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {r.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function MailToggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono"
      style={{
        fontSize: 9,
        padding: '3px 7px',
        borderRadius: 6,
        border: on ? '1px solid var(--accent-teal)' : '1px solid var(--glass-border-2)',
        background: on ? 'color-mix(in srgb, var(--accent-teal) 15%, transparent)' : 'transparent',
        color: on ? 'var(--accent-teal)' : 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
