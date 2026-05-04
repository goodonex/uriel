import { useEffect, useState } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { Positioning } from '../../types/db'

interface PositioningSectionProps {
  item: Positioning | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<Positioning, 'id' | 'brand_id'>>) => void
}

const STATEMENT_TARGET = 280

export function PositioningSection({
  item,
  loading,
  error,
  onSave,
}: PositioningSectionProps) {
  const [statement, setStatement] = useState(item?.statement ?? '')
  const [tone, setTone] = useState(item?.tone_of_voice ?? '')

  useEffect(() => {
    setStatement(item?.statement ?? '')
    setTone(item?.tone_of_voice ?? '')
  }, [item?.id, item?.statement, item?.tone_of_voice])

  const debouncedStatement = useDebouncedCallback((v: string) =>
    onSave({ statement: v }),
  )
  const debouncedTone = useDebouncedCallback((v: string) =>
    onSave({ tone_of_voice: v }),
  )

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 200,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        Positioning konnte nicht geladen werden: {error}
      </div>
    )
  }

  const statementLen = statement.length
  const overLimit = statementLen > STATEMENT_TARGET

  return (
    <section className="glass-2" style={{ borderRadius: 16, padding: 20 }}>
      <div className="mb-4">
        <div className="mb-1 flex items-baseline justify-between">
          <label
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
            }}
          >
            Positioning Statement
          </label>
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              color: overLimit
                ? 'var(--accent-coral)'
                : 'var(--text-tertiary)',
            }}
          >
            {statementLen} / {STATEMENT_TARGET}
          </span>
        </div>
        <textarea
          value={statement}
          onChange={(e) => {
            setStatement(e.target.value)
            debouncedStatement(e.target.value)
          }}
          rows={3}
          placeholder="In einem Satz: Für wen, was bietest du, wie anders."
          className="w-full rounded-lg outline-none transition-colors"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.5,
            padding: '10px 12px',
            background: 'var(--glass-1)',
            border: `1px solid ${
              overLimit ? 'var(--accent-coral)' : 'var(--glass-border-1)'
            }`,
            color: 'var(--text-primary)',
            resize: 'vertical',
          }}
        />
      </div>

      <div className="mb-4">
        <label
          className="font-mono mb-1 block"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Tone of Voice
        </label>
        <textarea
          value={tone}
          onChange={(e) => {
            setTone(e.target.value)
            debouncedTone(e.target.value)
          }}
          rows={3}
          placeholder="Warm, direkt, bewusst — nie überheblich."
          className="w-full rounded-lg outline-none transition-colors"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.5,
            padding: '10px 12px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
            resize: 'vertical',
          }}
        />
      </div>

      <div
        style={{
          paddingTop: 14,
          borderTop: '1px solid var(--glass-border-1)',
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            marginBottom: 6,
          }}
        >
          Business Model
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          Wer · Was · Wie · Für wen · Womit — im Abschnitt Business Model unten.
        </p>
      </div>
    </section>
  )
}
