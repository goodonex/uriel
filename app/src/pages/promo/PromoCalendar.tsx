import { useMemo, useState } from 'react'
import type { ContentPiece } from '../../types/db'

interface PromoCalendarProps {
  pieces: ContentPiece[]
  /** ISO YYYY-MM-DD */
  onSelectDay?: (day: string) => void
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Montag als ersten Wochentag */
function startOfCalendarMonth(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const dow = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  return start
}

export function PromoCalendar({ pieces, onSelectDay }: PromoCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const countsByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pieces) {
      const day = p.scheduled_at.slice(0, 10)
      m.set(day, (m.get(day) ?? 0) + 1)
    }
    return m
  }, [pieces])

  const [selected, setSelected] = useState<string | null>(null)

  const gridStart = startOfCalendarMonth(cursor)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const c = new Date(gridStart)
    c.setDate(gridStart.getDate() + i)
    cells.push(c)
  }

  const label = cursor.toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      className="glass-2"
      style={{
        borderRadius: 16,
        padding: 16,
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="font-mono"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--glass-border-2)',
            color: 'var(--text-secondary)',
          }}
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          ‹
        </button>
        <span
          className="font-display"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </span>
        <button
          type="button"
          className="font-mono"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--glass-border-2)',
            color: 'var(--text-secondary)',
          }}
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          ›
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 font-mono"
        style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const ymd = toYMD(d)
          const inMonth = d.getMonth() === cursor.getMonth()
          const count = countsByDay.get(ymd) ?? 0
          const isSel = selected === ymd
          return (
            <button
              key={ymd + d.getTime()}
              type="button"
              onClick={() => {
                setSelected(ymd)
                onSelectDay?.(ymd)
              }}
              className="font-mono"
              style={{
                minHeight: 36,
                borderRadius: 8,
                border: isSel
                  ? '1px solid var(--mode-promo)'
                  : '1px solid transparent',
                background: isSel ? 'var(--glass-3)' : 'var(--glass-1)',
                color: inMonth ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 11,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span>{d.getDate()}</span>
              {count > 0 ? (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--mode-promo)',
                    opacity: 0.85,
                  }}
                />
              ) : (
                <span style={{ height: 6 }} />
              )}
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className="mt-4 border-t border-[var(--glass-border-1)] pt-3">
          <span
            className="font-mono mb-2 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Geplant am {selected}
          </span>
          <ul className="flex flex-col gap-1">
            {pieces
              .filter((p) => p.scheduled_at.slice(0, 10) === selected)
              .map((p) => (
                <li
                  key={p.id}
                  style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                >
                  {p.title}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
