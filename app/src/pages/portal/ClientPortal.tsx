import { useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Kundenportal — Schritt 7 erweitert die freigegebenen Inhalte. */
export function ClientPortal() {
  const { clientSlug } = useParams<{ clientSlug: string }>()
  const { user } = useAuth()

  const display =
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null) ??
    user?.email ??
    'Gast'

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'transparent',
        minHeight: '100%',
        padding: '8px 0 48px',
      }}
    >
      <div
        className="glass-2"
        style={{
          borderRadius: 20,
          padding: '28px 24px',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
        }}
      >
        <div
          className="font-mono mb-2"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent-teal)',
          }}
        >
          Kundenportal · {clientSlug}
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Willkommen, {display}
        </h1>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Hier entsteht dein Bereich für freigegebene Brand-Inhalte.
        </p>
      </div>
    </div>
  )
}
