import { useEffect, useMemo, useRef, useState } from 'react'
import { useContacts } from '../../../hooks/useContacts'
import { useTasks } from '../../../hooks/useTasks'
import { copyBriefMailingJson } from '../../../lib/briefTaskExport'
import { followUpTaskTitle } from '../../../lib/followUpTask'
import { useToast } from '../../Toast'
import type { Contact, Task } from '../../../types/db'

function dueColor(due: string | null, status: Task['status']): string {
  if (status === 'done' || status === 'cancelled') return 'var(--text-tertiary)'
  if (!due) return 'var(--text-tertiary)'
  const d = new Date(due)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (dueDay < today) return 'var(--accent-coral)'
  if (dueDay.getTime() === today.getTime()) return '#eab308'
  return 'var(--text-tertiary)'
}

function fmtDue(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function fmtTerminLong(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

function fmtDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const TERMIN_TYPES = ['Setting', 'Closing', 'Follow-Up', 'Sonstiges'] as const

function readTerminTyp(contact: Contact): string {
  const raw = contact.custom_fields?.next_termin_typ
  return typeof raw === 'string' ? raw : ''
}

export function ContactTasksPanel({
  brandSlug,
  contact,
  onField,
}: {
  brandSlug: string
  contact: Contact
  onField?: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
}) {
  const tasks = useTasks(brandSlug)
  const contacts = useContacts(brandSlug)
  const { show } = useToast()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [showDone, setShowDone] = useState(false)

  const contactTasks = useMemo(
    () =>
      tasks.items
        .filter((t) => t.contact_id === contact.id)
        .sort((a, b) => {
          const order = { open: 0, in_progress: 0, cancelled: 2, done: 3 }
          if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
          const da = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY
          const db = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY
          return da - db
        }),
    [tasks.items, contact.id],
  )

  const openTasks = contactTasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled')
  const doneTasks = contactTasks.filter((t) => t.status === 'done')

  const followUpTask = useMemo(
    () => contactTasks.find((t) => t.source === 'follow_up'),
    [contactTasks],
  )

  const lastSyncedAt = useRef<string | null>(null)

  useEffect(() => {
    if (tasks.loading || !contact.next_follow_up_at) return
    const target = new Date(contact.next_follow_up_at).toISOString()
    if (target === lastSyncedAt.current) return
    lastSyncedAt.current = target

    const title = followUpTaskTitle(contact)
    if (!followUpTask) {
      tasks.create({
        title,
        due_at: target,
        contact_id: contact.id,
        priority: 1,
        source: 'follow_up',
      })
    } else if (followUpTask.due_at !== target || followUpTask.title !== title) {
      tasks.update(followUpTask.id, { due_at: target, title })
    }
  }, [contact, followUpTask, tasks])

  const handleToggle = (task: Task) => {
    tasks.toggle(task.id)
    if (task.source === 'follow_up' && task.status !== 'done' && onField) {
      onField({ next_follow_up_at: null })
    }
  }

  const saveTask = () => {
    if (!title.trim()) return
    tasks.create({
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      contact_id: contact.id,
      priority: 2,
    })
    setTitle('')
    setDue('')
    setAdding(false)
  }

  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>
          TASKS · {openTasks.length} offen
        </div>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="font-mono"
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid var(--glass-border-2)',
            background: 'transparent',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
          }}
        >
          + Task
        </button>
      </div>

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTask()
              if (e.key === 'Escape') {
                setTitle('')
                setDue('')
                setAdding(false)
              }
            }}
            placeholder="Titel"
            className="font-mono"
            style={{
              padding: '7px 9px',
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTask()
              if (e.key === 'Escape') {
                setTitle('')
                setDue('')
                setAdding(false)
              }
            }}
            className="font-mono"
            style={{
              padding: '6px 9px',
              fontSize: 11,
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setTitle('')
                setDue('')
                setAdding(false)
              }}
              className="font-mono"
              style={{
                fontSize: 10,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--glass-border-2)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={saveTask}
              disabled={!title.trim()}
              className="font-mono"
              style={{
                fontSize: 10,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--mode-sales)',
                background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
                color: 'var(--mode-sales)',
                cursor: title.trim() ? 'pointer' : 'not-allowed',
                opacity: title.trim() ? 1 : 0.5,
                fontWeight: 600,
              }}
            >
              Speichern
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {openTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            highlight={t.source === 'follow_up'}
            isBrief={t.source === 'brief_task'}
            onToggle={() => handleToggle(t)}
            onExportBrief={async () => {
              try {
                await copyBriefMailingJson(contact, contacts.items)
                show('Brief-Daten in Zwischenablage kopiert', 'success')
              } catch {
                show('Kopieren fehlgeschlagen', 'error')
              }
            }}
          />
        ))}
        {openTasks.length === 0 && !adding ? (
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>
            Keine offenen Tasks.
          </p>
        ) : null}
      </div>

      {doneTasks.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="font-mono"
            style={{
              fontSize: 10,
              border: 'none',
              background: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showDone ? '▼' : '▶'} {doneTasks.length} erledigte anzeigen
          </button>
          {showDone
            ? doneTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  isBrief={t.source === 'brief_task'}
                  onToggle={() => handleToggle(t)}
                  onExportBrief={async () => {
                    try {
                      await copyBriefMailingJson(contact, contacts.items)
                      show('Brief-Daten in Zwischenablage kopiert', 'success')
                    } catch {
                      show('Kopieren fehlgeschlagen', 'error')
                    }
                  }}
                  done
                />
              ))
            : null}
        </div>
      ) : null}

      <NextTerminBlock contact={contact} onField={onField} />
    </section>
  )
}

function NextTerminBlock({
  contact,
  onField,
}: {
  contact: Contact
  onField?: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [dateVal, setDateVal] = useState(fmtDatetimeLocal(contact.next_follow_up_at))
  const [typVal, setTypVal] = useState(readTerminTyp(contact))

  useEffect(() => {
    if (editing) return
    setDateVal(fmtDatetimeLocal(contact.next_follow_up_at))
    setTypVal(readTerminTyp(contact))
  }, [contact.next_follow_up_at, contact.custom_fields, editing])

  const save = () => {
    if (!onField) return
    const iso = dateVal ? new Date(dateVal).toISOString() : null
    onField({
      next_follow_up_at: iso,
      custom_fields: {
        ...contact.custom_fields,
        next_termin_typ: typVal,
      } as Contact['custom_fields'],
    })
    setEditing(false)
  }

  const clear = () => {
    if (!onField) return
    onField({
      next_follow_up_at: null,
      custom_fields: {
        ...contact.custom_fields,
        next_termin_typ: '',
      } as Contact['custom_fields'],
    })
    setEditing(false)
  }

  const currentTyp = readTerminTyp(contact)
  const hasTermin = Boolean(contact.next_follow_up_at)

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: '1px solid var(--glass-border-2)',
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-tertiary)',
          marginBottom: 6,
        }}
      >
        NÄCHSTER TERMIN
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="datetime-local"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className="font-mono"
            style={inlineInput}
          />
          <select
            value={typVal}
            onChange={(e) => setTypVal(e.target.value)}
            className="font-mono"
            style={inlineInput}
          >
            <option value="">— Typ wählen —</option>
            {TERMIN_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {hasTermin ? (
              <button
                type="button"
                onClick={clear}
                className="font-mono"
                style={{ ...miniBtn, color: 'var(--accent-coral)', marginRight: 'auto' }}
              >
                Entfernen
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="font-mono"
              style={miniBtn}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={save}
              className="font-mono"
              style={{
                ...miniBtn,
                border: '1px solid var(--mode-sales)',
                background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
                color: 'var(--mode-sales)',
                fontWeight: 600,
              }}
            >
              Speichern
            </button>
          </div>
        </div>
      ) : hasTermin ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            width: '100%',
            textAlign: 'left',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--accent-amber) 45%, transparent)',
            background: 'color-mix(in srgb, var(--accent-amber) 10%, var(--glass-2))',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {fmtTerminLong(contact.next_follow_up_at)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {currentTyp || 'Typ nicht gesetzt'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono"
          style={{
            fontSize: 11,
            padding: '6px 10px',
            borderRadius: 7,
            border: '1px dashed var(--glass-border-2)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          + Termin festlegen
        </button>
      )}
    </div>
  )
}

const inlineInput = {
  padding: '7px 9px',
  fontSize: 12,
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  outline: 'none',
} as const

const miniBtn = {
  fontSize: 10,
  padding: '5px 9px',
  borderRadius: 6,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
} as const

function TaskRow({
  task,
  onToggle,
  done = false,
  highlight = false,
  isBrief = false,
  onExportBrief,
}: {
  task: Task
  onToggle: () => void
  done?: boolean
  highlight?: boolean
  isBrief?: boolean
  onExportBrief?: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 8,
        background: isBrief
          ? 'color-mix(in srgb, var(--accent-teal) 10%, var(--glass-2))'
          : highlight
            ? 'color-mix(in srgb, var(--accent-amber) 12%, var(--glass-2))'
            : 'var(--glass-2)',
        border: isBrief
          ? '1px solid color-mix(in srgb, var(--accent-teal) 40%, transparent)'
          : highlight
            ? '1px solid color-mix(in srgb, var(--accent-amber) 45%, transparent)'
            : '1px solid transparent',
        opacity: done ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? 'Als offen markieren' : 'Als erledigt markieren'}
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `1.5px solid ${done ? 'var(--mode-sales)' : 'var(--glass-border-2)'}`,
          background: done ? 'var(--mode-sales)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!done) e.currentTarget.style.borderColor = 'var(--mode-sales)'
        }}
        onMouseLeave={(e) => {
          if (!done) e.currentTarget.style.borderColor = 'var(--glass-border-2)'
        }}
      >
        {done ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M2 5.2 4 7.2 8 2.8"
              stroke="#0a0a0a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>
      <span
        style={{
          flex: 1,
          fontSize: 12,
          textDecoration: done ? 'line-through' : 'none',
          color: 'var(--text-primary)',
        }}
      >
        {isBrief ? '✉ ' : task.priority === 1 ? '⚡ ' : ''}
        {task.title}
      </span>
      {isBrief && onExportBrief ? (
        <button
          type="button"
          onClick={onExportBrief}
          className="font-mono"
          title="JSON für DirectMailing kopieren"
          style={{
            fontSize: 9,
            padding: '4px 7px',
            borderRadius: 6,
            border: '1px solid var(--accent-teal)',
            background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
            color: 'var(--accent-teal)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Export
        </button>
      ) : null}
      <span className="font-mono" style={{ fontSize: 10, color: dueColor(task.due_at, task.status) }}>
        {fmtDue(task.due_at)}
      </span>
    </div>
  )
}
