import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef } from 'react'
import { useTasks } from '../../hooks/useTasks'
import { useToast } from '../Toast'
import { TaskCompose, TaskRow } from './TaskRow'

interface ContactTasksTabProps {
  slug: string
  contactId: string
  contactName: string
  nextFollowUpAt: string | null
  onClearFollowUp: () => void
}

export function ContactTasksTab({
  slug,
  contactId,
  contactName,
  nextFollowUpAt,
  onClearFollowUp,
}: ContactTasksTabProps) {
  const tasks = useTasks(slug)
  const { show } = useToast()

  const contactTasks = useMemo(
    () => tasks.items.filter((t) => t.contact_id === contactId),
    [tasks.items, contactId],
  )
  const openTasks = useMemo(
    () => contactTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled'),
    [contactTasks],
  )
  const doneTasks = useMemo(
    () => contactTasks.filter((t) => t.status === 'done' || t.status === 'cancelled'),
    [contactTasks],
  )

  const followUpTask = useMemo(
    () => contactTasks.find((t) => t.source === 'follow_up'),
    [contactTasks],
  )

  const lastSyncedAt = useRef<string | null>(null)

  useEffect(() => {
    if (tasks.loading) return
    const target = nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null
    if (target === lastSyncedAt.current) return
    lastSyncedAt.current = target

    if (target && !followUpTask) {
      tasks.create({
        title: `Follow-Up: ${contactName || 'Kontakt'}`,
        due_at: target,
        contact_id: contactId,
        priority: 1,
        source: 'follow_up',
      })
    } else if (target && followUpTask && followUpTask.due_at !== target) {
      tasks.update(followUpTask.id, { due_at: target })
    }
  }, [nextFollowUpAt, followUpTask, contactId, contactName, tasks])

  const handleToggle = (id: string) => {
    const t = contactTasks.find((x) => x.id === id)
    tasks.toggle(id)
    if (t && t.source === 'follow_up' && t.status !== 'done') {
      onClearFollowUp()
      show('Follow-Up erledigt — Datum entfernt', 'success')
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {nextFollowUpAt && !followUpTask ? (
        <button
          type="button"
          onClick={() =>
            tasks.create({
              title: `Follow-Up: ${contactName || 'Kontakt'}`,
              due_at: nextFollowUpAt,
              contact_id: contactId,
              priority: 1,
              source: 'follow_up',
            })
          }
          className="font-mono"
          style={{
            alignSelf: 'flex-start',
            fontSize: 10,
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--mode-sales)',
            background: 'color-mix(in srgb, var(--mode-sales) 14%, transparent)',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
          }}
        >
          + Follow-Up-Task aus Datum erzeugen
        </button>
      ) : null}

      <section
        className="rounded-2xl"
        style={{
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          padding: '16px 18px',
        }}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>
            Offene Aufgaben
          </h3>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {openTasks.length} offen · {doneTasks.length} erledigt
          </span>
        </div>

        <div className="mb-3">
          <TaskCompose
            placeholder={`Aufgabe für ${contactName || 'diesen Kontakt'} …`}
            accent="var(--mode-sales)"
            onCreate={(input) =>
              tasks.create({
                title: input.title,
                due_at: input.due_at,
                priority: input.priority,
                contact_id: contactId,
                source: 'manual',
              })
            }
          />
        </div>

        {tasks.loading ? (
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Lädt …
          </div>
        ) : openTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-body"
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              padding: '12px 0',
              textAlign: 'center',
            }}
          >
            Noch keine Aufgaben für diesen Lead. Compose oben.
          </motion.div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {openTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  brandSlug={slug}
                  onToggle={handleToggle}
                  onRemove={tasks.remove}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {doneTasks.length > 0 ? (
          <details className="mt-4">
            <summary
              className="font-mono cursor-pointer"
              style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
            >
              Erledigt ({doneTasks.length})
            </summary>
            <div className="mt-2 space-y-1">
              <AnimatePresence initial={false}>
                {doneTasks.slice(0, 12).map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    brandSlug={slug}
                    onToggle={handleToggle}
                    onRemove={tasks.remove}
                  />
                ))}
              </AnimatePresence>
            </div>
          </details>
        ) : null}
      </section>
    </div>
  )
}

interface ContactTaskCounterProps {
  slug: string
  contactId: string
}

export function ContactTaskCounter({ slug, contactId }: ContactTaskCounterProps) {
  const tasks = useTasks(slug)
  const open = tasks.items.filter(
    (t) => t.contact_id === contactId && t.status !== 'done' && t.status !== 'cancelled',
  ).length
  if (open === 0) return null
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 9,
        padding: '2px 7px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--mode-sales) 16%, transparent)',
        color: 'var(--mode-sales)',
        letterSpacing: '0.04em',
      }}
    >
      {open}
    </span>
  )
}
