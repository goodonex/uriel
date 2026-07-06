import { useRunnerStatus } from '../lib/useRunnerStatus'

const AGENTS = [
  { id: 'wochenrecap', label: 'Wochenrecap', hint: 'Zahlen vs. Ziel + Fokus' },
  { id: 'followup-entwuerfe', label: 'Follow-up-Entwürfe', hint: 'Wartende Kontakte' },
  { id: 'lead-research', label: 'Lead-Research', hint: 'Briefing vor Anschreiben' },
] as const

/**
 * Command Deck (REBUILD-PLAN §7): genau 3 Agenten-Buttons in v1.
 * Phase 2: Buttons rendern, aber disabled solange der Runner offline ist.
 * Phase 5: onRun feuert POST /run.
 */
export function CommandDeck({ onRun }: { onRun?: (agentId: string) => void }) {
  const runner = useRunnerStatus()
  const offline = runner.state !== 'online'

  return (
    <section className="ck-panel" aria-label="Agenten-Buttons">
      <div className="ck-label" style={{ padding: '10px 12px 6px' }}>
        Command Deck
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
        {AGENTS.map((a) => (
          <button
            key={a.id}
            className="ck-btn"
            disabled={offline}
            onClick={() => onRun?.(a.id)}
            title={offline ? 'Runner offline — kommt in Phase 5' : a.hint}
            style={{ justifyContent: 'space-between' }}
          >
            <span>▶ {a.label}</span>
            <span className="ck-label">{a.hint}</span>
          </button>
        ))}
        {offline ? (
          <p className="ck-label" style={{ margin: '2px 0 0', color: 'var(--ck-text-3)' }}>
            Runner offline · Buttons aktivieren sich, sobald `npm run cockpit` läuft (Phase 5)
          </p>
        ) : null}
      </div>
    </section>
  )
}
