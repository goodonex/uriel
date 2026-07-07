import { useMemo, useState } from 'react'
import type { RunSummary } from '../lib/runnerApi'

const DISMISS_KEY = 'cockpit.dreamDismissed'

/**
 * Dream-Karte (REBUILD-PLAN §8): zeigt den heutigen dream-check-Run als
 * EINE Karte im Command-Deck-Bereich. Dismiss merkt sich die Run-Id.
 * Bewusst klein — kein eigenes Dashboard.
 */
export function DreamCard({
  runs,
  onOpen,
}: {
  runs: RunSummary[]
  onOpen: (runId: string) => void
}) {
  const [dismissedId, setDismissedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY)
    } catch {
      return null
    }
  })

  const todayPrefix = new Date().toISOString().slice(0, 10)
  const dream = useMemo(
    () =>
      runs.find(
        (r) => r.agent === 'dream-check' && r.id.startsWith(todayPrefix) && r.status === 'done',
      ) ?? null,
    [runs, todayPrefix],
  )

  if (!dream || dream.id === dismissedId) return null

  const dismiss = () => {
    setDismissedId(dream.id)
    try {
      localStorage.setItem(DISMISS_KEY, dream.id)
    } catch {
      /* ohne localStorage nur für diese Session */
    }
  }

  return (
    <section
      className="ck-panel"
      aria-label="Dream-Vorschlag des Tages"
      style={{ borderColor: 'rgba(52, 211, 153, 0.35)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px 4px' }}>
        <span className="ck-label" style={{ color: 'var(--ck-accent)' }}>☾ Dream · heute</span>
        <button
          onClick={dismiss}
          aria-label="Dream-Vorschlag ausblenden"
          style={{ background: 'none', border: 'none', color: 'var(--ck-text-3)', cursor: 'pointer', fontSize: 12 }}
        >
          ✕
        </button>
      </div>
      <button
        onClick={() => onOpen(dream.id)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: '4px 12px 12px',
          cursor: 'pointer',
          color: 'var(--ck-text-2)',
          fontFamily: 'var(--ck-font)',
          fontSize: 12,
          lineHeight: 1.55,
        }}
      >
        {dream.preview || 'Vorschlag ansehen…'}
        <span style={{ display: 'block', marginTop: 6, color: 'var(--ck-accent)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Öffnen →
        </span>
      </button>
    </section>
  )
}
