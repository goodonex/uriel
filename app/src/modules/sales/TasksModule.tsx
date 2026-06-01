import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTasks } from '../../hooks/useTasks'

function endOfTodayMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function TasksModule() {
  const { slug } = useParams<{ slug: string }>()
  const brandTasks = useTasks(slug)

  const dueTodayOrOpen = useMemo(() => {
    const end = endOfTodayMs()
    return brandTasks.items
      .filter((t) => t.status === 'open' || t.status === 'in_progress')
      .filter((t) => {
        if (!t.due_at) return true
        const due = new Date(t.due_at).getTime()
        return !Number.isNaN(due) && due <= end
      })
      .slice()
      .sort((a, b) => {
        const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
        const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
        return da - db
      })
      .slice(0, 24)
  }, [brandTasks.items])

  if (!slug) return null

  if (brandTasks.loading) {
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

  if (brandTasks.error) {
    return (
      <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
        {brandTasks.error}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2" style={{ minWidth: 0 }}>
      <div
        className="font-mono mb-0.5"
        style={{
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}
      >
        Offene Tasks · heute und ohne Datum
      </div>
      {dueTodayOrOpen.length === 0 ? (
        <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Nichts Offenes für heute.
        </p>
      ) : (
        <ul className="flex max-h-[min(200px,32vh)] flex-col gap-1.5 overflow-y-auto pr-0.5">
          {dueTodayOrOpen.map((t) => (
            <li key={t.id}>
              <Link
                to={t.contact_id ? `/brand/${slug}/sales/${t.contact_id}` : `/brand/${slug}/sales`}
                className="font-mono block truncate rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--glass-3)]"
                style={{
                  fontSize: 11,
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  border: '1px solid var(--glass-border-2)',
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {t.source === 'brief_task' ? '✉ ' : ''}
                  {t.title || 'Task'}
                </span>
                {t.due_at ? (
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                    {t.due_at.slice(0, 10)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>ohne Datum</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
