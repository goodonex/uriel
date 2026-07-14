import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useUiTheme } from '../../hooks/useUiTheme'
import { useActiveBrand } from '../lib/activeBrand'
import { useRunnerStatus } from '../lib/useRunnerStatus'

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const date = now
    .toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })
    .toUpperCase()

  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div className="ck-clock-time">
        {hh}:{mm}
        <span className="ck-clock-seconds" style={{ color: 'var(--ck-text-3)', fontSize: 13 }}>:{ss}</span>
      </div>
      <div className="ck-label">{date}</div>
    </div>
  )
}

function StatusWord({ label, state }: { label: string; state: 'on' | 'off' | 'pulse' }) {
  const dotClass =
    state === 'on' ? 'ck-dot ck-dot--on' : state === 'pulse' ? 'ck-dot ck-dot--pulse' : 'ck-dot'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={dotClass} />
      <span className="ck-label" style={{ color: state === 'off' ? 'var(--ck-text-3)' : 'var(--ck-text-2)' }}>
        {label}
        {state === 'off' ? ' · OFFLINE' : ''}
      </span>
    </span>
  )
}

export function StatusBar() {
  const { user } = useAuth()
  const { brands, activeSlug, setActiveSlug } = useActiveBrand()
  const runner = useRunnerStatus()
  const { isPlainLight, togglePlainLight } = useUiTheme()

  return (
    <header className="ck-statusbar">
      {/* Wortmarke */}
      <div className="ck-status-brand">
        <span className="ck-wordmark">K E V I N&nbsp;&nbsp;O S</span>
        <span className="ck-label ck-status-brand-tag" style={{ marginTop: 2 }}>Cockpit</span>
      </div>

      {/* Status-Wörter — auf Mobile ausgeblendet (Platz für Nav+Tracking) */}
      <div className="ck-status-words">
        <StatusWord label="CORE" state="on" />
        <StatusWord label="SUPABASE" state={user ? 'on' : 'off'} />
        <StatusWord
          label="RUNNER"
          state={
            runner.state === 'online' ? (runner.runningCount > 0 ? 'pulse' : 'on') : 'off'
          }
        />
      </div>

      {/* Brand-Switcher + Uhr */}
      <div className="ck-status-right">
        <select
          className="ck-select"
          value={activeSlug}
          onChange={(e) => setActiveSlug(e.target.value)}
          aria-label="Aktive Brand"
        >
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ck-btn"
          onClick={togglePlainLight}
          title={isPlainLight ? 'Dunkler Modus' : 'Heller Modus'}
          aria-label={isPlainLight ? 'Dunkler Modus' : 'Heller Modus'}
        >
          {isPlainLight ? '◐' : '☀'}
        </button>
        <Clock />
      </div>
    </header>
  )
}
