import { useAuth } from '../hooks/useAuth'

/**
 * Angemeldet, aber ohne Rolle (seit 0093 vergibt nur der Server Rollen).
 * Solche Konten sehen weder Cockpit noch Portal — nur diesen Hinweis.
 */
export function KeinZugang() {
  const { user, signOut } = useAuth()
  return (
    <div
      className="font-mono"
      style={{
        pointerEvents: 'auto',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        background: 'var(--bg-base)',
        color: 'var(--text-secondary)',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      <p style={{ maxWidth: 420, margin: 0 }}>
        Für {user?.email ?? 'dieses Konto'} ist kein Zugang eingerichtet. Wenn du eine Einladung
        erwartest, melde dich bei deinem Ansprechpartner.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          border: '1px solid var(--glass-border-1)',
          background: 'transparent',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        Abmelden
      </button>
    </div>
  )
}
