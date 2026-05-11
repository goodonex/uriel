import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contact, Task } from '../../types/db'

interface TaskRowProps {
  task: Task
  brandSlug: string
  contactName?: string
  onToggle: (id: string) => void
  onRemove?: (id: string) => void
  compact?: boolean
  showContext?: boolean
}

function formatDue(due_at: string | null): { label: string; tone: 'overdue' | 'today' | 'soon' | 'later' | 'none' } {
  if (!due_at) return { label: '—', tone: 'none' }
  try {
    const due = new Date(due_at)
    const now = new Date()
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const tomorrow0 = new Date(today0)
    tomorrow0.setDate(today0.getDate() + 1)
    const dayAfter0 = new Date(today0)
    dayAfter0.setDate(today0.getDate() + 2)
    const dueDay0 = new Date(due)
    dueDay0.setHours(0, 0, 0, 0)
    const diff = Math.round((dueDay0.getTime() - today0.getTime()) / 86400000)

    if (due.getTime() < now.getTime() && due.getTime() < today0.getTime()) {
      return { label: diff === -1 ? 'gestern' : `vor ${-diff} Tagen`, tone: 'overdue' }
    }
    if (dueDay0.getTime() === today0.getTime()) {
      return {
        label: `heute · ${due.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
        tone: 'today',
      }
    }
    if (dueDay0.getTime() === tomorrow0.getTime()) return { label: 'morgen', tone: 'soon' }
    if (diff < 7) return { label: `in ${diff} Tagen`, tone: 'soon' }
    return {
      label: due.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
      tone: 'later',
    }
  } catch {
    return { label: '—', tone: 'none' }
  }
}

const TONE_COLOR: Record<ReturnType<typeof formatDue>['tone'], string> = {
  overdue: 'var(--accent-coral)',
  today: 'var(--accent-blue)',
  soon: 'var(--text-secondary)',
  later: 'var(--text-tertiary)',
  none: 'var(--text-tertiary)',
}

const PRIORITY_LABEL: Record<1 | 2 | 3, { dot: string; tone: string }> = {
  1: { dot: '●', tone: 'var(--accent-coral)' },
  2: { dot: '●', tone: 'var(--text-tertiary)' },
  3: { dot: '○', tone: 'var(--text-tertiary)' },
}

export function TaskRow({
  task,
  brandSlug,
  contactName,
  onToggle,
  onRemove,
  compact,
  showContext,
}: TaskRowProps) {
  const navigate = useNavigate()
  const due = formatDue(task.due_at)
  const done = task.status === 'done' || task.status === 'cancelled'
  const prio = PRIORITY_LABEL[task.priority]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="group flex items-center gap-2.5 rounded-lg transition-colors"
      style={{
        padding: compact ? '6px 8px' : '8px 10px',
        background: 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--glass-2)'
        e.currentTarget.style.borderColor = 'var(--glass-border-1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        title={done ? 'Wieder öffnen' : 'Erledigt markieren'}
        className="flex shrink-0 items-center justify-center transition-colors"
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${done ? 'var(--accent-teal)' : 'var(--glass-border-2)'}`,
          background: done
            ? 'color-mix(in srgb, var(--accent-teal) 24%, transparent)'
            : 'transparent',
          color: 'var(--accent-teal)',
          cursor: 'pointer',
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        {done ? '✓' : ''}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="font-body truncate"
          style={{
            fontSize: 12.5,
            color: done ? 'var(--text-tertiary)' : 'var(--text-primary)',
            textDecoration: done ? 'line-through' : 'none',
            fontWeight: 500,
          }}
        >
          {task.title}
        </div>
        {showContext && (contactName || task.project_id) ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (task.contact_id) navigate(`/brand/${brandSlug}/sales/${task.contact_id}`)
              else if (task.project_id)
                navigate(`/brand/${brandSlug}/deliver/${task.project_id}`)
            }}
            className="font-mono mt-0.5 truncate"
            style={{
              fontSize: 9,
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: task.contact_id || task.project_id ? 'pointer' : 'default',
              maxWidth: '100%',
            }}
          >
            {contactName ? `→ ${contactName}` : task.project_id ? '→ Projekt' : ''}
          </button>
        ) : null}
      </div>

      <span
        className="font-mono shrink-0"
        title={`Priorität ${task.priority}`}
        style={{ fontSize: 10, color: prio.tone, opacity: done ? 0.4 : 1 }}
      >
        {prio.dot}
      </span>

      <span
        className="font-mono shrink-0"
        style={{
          fontSize: 10,
          color: TONE_COLOR[due.tone],
          opacity: done ? 0.4 : 1,
          minWidth: 56,
          textAlign: 'right',
        }}
      >
        {due.label}
      </span>

      {onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(task.id)}
          title="Löschen"
          className="font-mono shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            fontSize: 11,
            padding: '2px 6px',
            borderRadius: 5,
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--accent-coral)'
            e.currentTarget.style.borderColor = 'var(--glass-border-2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-tertiary)'
            e.currentTarget.style.borderColor = 'transparent'
          }}
        >
          ×
        </button>
      ) : null}
    </motion.div>
  )
}

interface TaskComposeProps {
  placeholder?: string
  defaultPriority?: 1 | 2 | 3
  defaultContactId?: string | null
  defaultProjectId?: string | null
  defaultSource?: Task['source']
  onCreate: (input: { title: string; due_at: string | null; priority: 1 | 2 | 3 }) => void
  accent?: string
  contacts?: Contact[]
}

export function TaskCompose({
  placeholder = 'Aufgabe hinzufügen …',
  defaultPriority = 2,
  onCreate,
  accent = 'var(--accent-teal)',
}: TaskComposeProps) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState<1 | 2 | 3>(defaultPriority)
  const [open, setOpen] = useState(false)

  const submit = () => {
    const t = title.trim()
    if (!t) return
    onCreate({
      title: t,
      due_at: due ? new Date(due + 'T09:00:00').toISOString() : null,
      priority,
    })
    setTitle('')
    setDue('')
    setPriority(defaultPriority)
    setOpen(false)
  }

  return (
    <div
      className="rounded-lg"
      style={{
        border: '1px solid var(--glass-border-1)',
        background: 'var(--glass-1)',
        padding: '8px 10px',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="shrink-0"
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: '1.5px dashed var(--glass-border-2)',
          }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            } else if (e.key === 'Escape') {
              setTitle('')
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none font-body"
          style={{ fontSize: 12.5, color: 'var(--text-primary)' }}
        />
        {title ? (
          <button
            type="button"
            onClick={submit}
            className="font-mono shrink-0"
            style={{
              fontSize: 10,
              padding: '4px 10px',
              borderRadius: 6,
              border: `1px solid ${accent}`,
              background: `color-mix(in srgb, ${accent} 16%, transparent)`,
              color: accent,
              cursor: 'pointer',
            }}
          >
            Anlegen
          </button>
        ) : null}
      </div>
      {open && title ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label
            className="font-mono flex items-center gap-1"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Fällig:
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="bg-transparent font-mono"
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 5,
                border: '1px solid var(--glass-border-2)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
          <div className="flex items-center gap-1">
            {([1, 2, 3] as const).map((p) => {
              const label = p === 1 ? 'Hoch' : p === 2 ? 'Normal' : 'Niedrig'
              const tone = p === 1 ? 'var(--accent-coral)' : 'var(--text-tertiary)'
              const active = priority === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    padding: '3px 7px',
                    borderRadius: 999,
                    border: `1px solid ${active ? tone : 'var(--glass-border-2)'}`,
                    background: active ? `color-mix(in srgb, ${tone} 16%, transparent)` : 'transparent',
                    color: active ? tone : 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
