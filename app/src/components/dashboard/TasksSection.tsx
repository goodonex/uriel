import { AnimatePresence } from 'framer-motion'
import { useMemo } from 'react'
import { useContacts } from '../../hooks/useContacts'
import { useTaskBuckets, useTasks } from '../../hooks/useTasks'
import { TaskCompose, TaskRow } from '../tasks/TaskRow'

interface TasksSectionProps {
  slug: string
}

export function TasksSection({ slug }: TasksSectionProps) {
  const tasks = useTasks(slug)
  const contacts = useContacts(slug)
  const buckets = useTaskBuckets(tasks.items)

  const contactMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts.items) {
      m.set(c.id, c.name || c.email || c.phone || 'Kontakt')
    }
    return m
  }, [contacts.items])

  const sections: Array<{
    label: string
    color: string
    items: typeof buckets.overdue
    emptyHint?: string
  }> = [
    { label: 'Überfällig', color: 'var(--accent-coral)', items: buckets.overdue },
    { label: 'Heute', color: 'var(--accent-blue)', items: buckets.today },
    { label: 'Diese Woche', color: 'var(--accent-teal)', items: buckets.week },
    { label: 'Später', color: 'var(--text-tertiary)', items: buckets.later, emptyHint: '—' },
  ]

  const visibleSections = sections.filter((s) => s.items.length > 0)
  const totalOpen =
    buckets.overdue.length + buckets.today.length + buckets.week.length + buckets.later.length

  return (
    <section
      className="rounded-2xl"
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        padding: '18px 20px 16px',
      }}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
          >
            TASKS
          </div>
          <h3
            className="font-display mt-1"
            style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
          >
            Was steht an
          </h3>
        </div>
        <div className="flex flex-wrap items-baseline gap-2 font-mono" style={{ fontSize: 10 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalOpen}</span> offen
          </span>
          {buckets.done.length > 0 ? (
            <>
              <span style={{ color: 'var(--glass-border-2)' }}>·</span>
              <span style={{ color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {buckets.done.length}
                </span>{' '}
                erledigt
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-3">
        <TaskCompose
          onCreate={(input) =>
            tasks.create({
              title: input.title,
              due_at: input.due_at,
              priority: input.priority,
              source: 'manual',
            })
          }
        />
      </div>

      {tasks.loading ? (
        <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Lädt …
        </div>
      ) : visibleSections.length === 0 ? (
        <div
          className="font-body"
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            padding: '14px 0',
            textAlign: 'center',
          }}
        >
          Keine offenen Aufgaben. Sauberer Schreibtisch.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSections.map((sec) => (
            <div key={sec.label}>
              <div
                className="font-mono mb-1.5 flex items-center gap-2"
                style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: sec.color,
                    display: 'inline-block',
                  }}
                />
                {sec.label.toUpperCase()}
                <span style={{ color: 'var(--text-tertiary)' }}>· {sec.items.length}</span>
              </div>
              <div className="space-y-1">
                <AnimatePresence initial={false}>
                  {sec.items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      brandSlug={slug}
                      contactName={t.contact_id ? contactMap.get(t.contact_id) : undefined}
                      onToggle={tasks.toggle}
                      onRemove={tasks.remove}
                      showContext
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
