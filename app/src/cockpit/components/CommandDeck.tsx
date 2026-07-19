import { useEffect, useState } from 'react'
import type { RunnerState } from '../lib/useRunnerStatus'
import { fetchAgents, type AgentInfo } from '../lib/runnerApi'

/**
 * Agenten, die NICHT als generischer Deck-Button erscheinen:
 * - dream-check läuft automatisch 1×/Tag,
 * - lead-research hat ein eigenes Eingabefeld (unten),
 * - write-Agenten (kind:'write', z. B. Content-Batch) sind schwer/teuer und
 *   leben auf /agenten — das Deck ist für schnelle tägliche Routinen.
 */
const HIDDEN_ON_DECK = new Set(['dream-check', 'lead-research'])

/** Fallback, solange /agents noch nicht geladen ist — Deck nie leer, wenn online. */
const FALLBACK: AgentInfo[] = [
  { id: 'morgenbrief', label: 'Morgen-Brief', description: 'Tagesstart', kind: 'readonly', running: false },
  { id: 'wochenrecap', label: 'Wochenrecap', description: 'Zahlen vs. Ziel', kind: 'readonly', running: false },
  { id: 'followup-entwuerfe', label: 'Follow-up-Entwürfe', description: 'Wartende Kontakte', kind: 'readonly', running: false },
]

interface CommandDeckProps {
  runnerState: RunnerState
  /** Agenten, die gerade laufen (agent-ids) */
  activeAgents: string[]
  onRun: (agentId: string, input?: Record<string, unknown>) => Promise<void>
}

/**
 * Command Deck v2 (IDEAS-2026 R1): Buttons kommen aus dem Runner-Katalog
 * (`/agents`) — jeder neue readonly-Agent erscheint automatisch, ohne UI-Änderung.
 * Lead-Research behält sein Eingabefeld.
 */
export function CommandDeck({ runnerState, activeAgents, onRun }: CommandDeckProps) {
  const offline = runnerState !== 'online'
  const [leadQuery, setLeadQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<AgentInfo[]>([])

  useEffect(() => {
    if (runnerState !== 'online') return
    let cancelled = false
    void fetchAgents()
      .then((list) => {
        if (!cancelled) setAgents(list)
      })
      .catch(() => {
        /* offline/Fehler → Fallback greift */
      })
    return () => {
      cancelled = true
    }
  }, [runnerState])

  const source = agents.length ? agents : FALLBACK
  const deckAgents = source.filter((a) => a.kind === 'readonly' && !HIDDEN_ON_DECK.has(a.id))
  const hasLeadResearch = source.some((a) => a.id === 'lead-research') || agents.length === 0

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
        {deckAgents.map((a) => {
          const isRunning = activeAgents.includes(a.id) || a.running
          return (
            <button
              key={a.id}
              className="ck-btn"
              disabled={offline || isRunning}
              onClick={() => void trigger(a.id)}
              title={offline ? 'Runner offline' : a.description}
              style={{ justifyContent: 'space-between' }}
            >
              <span>
                {isRunning ? <span className="ck-dot ck-dot--pulse" style={{ marginRight: 8 }} /> : '▶ '}
                {a.label}
              </span>
              <span className="ck-label">{isRunning ? 'läuft…' : a.description}</span>
            </button>
          )
        })}

        {/* Lead-Research mit Eingabe */}
        {hasLeadResearch ? (
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
        ) : null}

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
