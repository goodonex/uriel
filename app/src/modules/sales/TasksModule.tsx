import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { buildSalesOverview, contactCardTitle, STAGE_LABEL } from './salesOverview'

export function TasksModule() {
  const { slug } = useParams<{ slug: string }>()
  const contacts = useContacts(slug)

  const dueList = useMemo(() => buildSalesOverview(contacts.items).dueTodayList, [contacts.items])

  if (!slug) return null

  if (contacts.loading) {
    return (
      <div
        className="animate-pulse rounded-xl"
        style={{
          minHeight: 100,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (contacts.error) {
    return (
      <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
        {contacts.error}
      </p>
    )
  }

  if (dueList.length === 0) {
    return (
      <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        Keine Follow-ups heute fällig.
      </p>
    )
  }

  return (
    <ul className="flex max-h-[min(200px,28vh)] flex-col gap-1.5 overflow-y-auto pr-0.5">
      {dueList.map((c) => (
        <li key={c.id}>
          <Link
            to={`/brand/${slug}/sales/${c.id}`}
            className="font-mono block truncate rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--glass-3)]"
            style={{
              fontSize: 11,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              border: '1px solid var(--glass-border-2)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{contactCardTitle(c)}</span>
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
              {STAGE_LABEL[c.pipeline_stage]}
            </span>
            {c.next_follow_up_at ? (
              <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                {c.next_follow_up_at.slice(0, 10)}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
