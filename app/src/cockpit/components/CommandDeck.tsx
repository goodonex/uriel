import { useState } from 'react'
import type { RunnerState } from '../lib/useRunnerStatus'

const AGENTS = [
  { id: 'wochenrecap', label: 'Wochenrecap', hint: 'Zahlen vs. Ziel + Fokus' },
  { id: 'followup-entwuerfe', label: 'Follow-up-Entwürfe', hint: 'Wartende Kontakte' },
] as const

interface CommandDeckProps {
  runnerState: RunnerState
  /** Agenten, die gerade laufen (agent-ids) */
  activeAgents: string[]
  onRun: (agentId: string, input?: Record<string, unknown>) => Promise<void>
}

/**
 * Command Deck (REBUILD-PLAN §7): genau 3 Agenten-Buttons in v1.
 * Wochenrecap + Follow-ups senden ihre Daten aus der App mit;
 * Lead-Research hat ein Eingabefeld (Name/Firma/URL).
 */
export function CommandDeck({ runnerState, activeAgents, onRun }: CommandDeckProps) {
  const offline = runnerState !== 'online'
  const [leadQuery, setLeadQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const trigger = async (agentId: string, input?: Record<string, unknown>) => {
    setError(null)
    try {
      await onRun(agentId, input)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="ck-panel" aria-label="Agenten-Buttons">
      <div className="ck-label" style={{ padding: '10px 12px 6px' }}>
        Command Deck
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
        {AGENTS.map((a) => {
          const isRunning = activeAgents.includes(a.id)
          return (
            <button
              key={a.id}
              className="ck-btn"
              disabled={offline || isRunning}
              onClick={() => void trigger(a.id)}
              title={offline ? 'Runner offline' : a.hint}
              style={{ justifyContent: 'space-between' }}
            >
              <span>
                {isRunning ? <span className="ck-dot ck-dot--pulse" style={{ marginRight: 8 }} /> : '▶ '}
                {a.label}
              </span>
              <span className="ck-label">{isRunning ? 'läuft…' : a.hint}</span>
            </button>
          )
        })}

        {/* Lead-Research mit Eingabe */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="ck-input"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Lead: Name, Firma oder URL…"
            value={leadQuery}
            disabled={offline}
            onChange={(e) => setLeadQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && leadQuery.trim()) {
                void trigger('lead-research', { query: leadQuery.trim() })
                setLeadQuery('')
              }
            }}
            aria-label="Lead-Research Eingabe"
          />
          <button
            className="ck-btn"
            disabled={offline || !leadQuery.trim() || activeAgents.includes('lead-research')}
            onClick={() => {
              void trigger('lead-research', { query: leadQuery.trim() })
              setLeadQuery('')
            }}
          >
            {activeAgents.includes('lead-research') ? '…' : '▶'}
          </button>
        </div>

        {error ? (
          <p className="ck-label" style={{ margin: 0, color: 'var(--ck-warn)' }}>{error}</p>
        ) : null}
        {offline ? (
          <p className="ck-label" style={{ margin: '2px 0 0', color: 'var(--ck-text-3)' }}>
            Runner offline · starte `npm run cockpit` im Repo-Root
          </p>
        ) : null}
      </div>
    </section>
  )
}
