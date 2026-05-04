import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Workspace nur für eingeloggte Owner (nicht Client-Rolle). */
export function RequireOwnerGate({ children }: { children: ReactNode }) {
  const { user, role, clientProjectId, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        className="font-mono animate-pulse"
        style={{
          pointerEvents: 'auto',
          padding: 24,
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        Session wird geladen…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role === 'client') {
    if (!clientProjectId) {
      return (
        <div
          className="font-mono"
          style={{
            pointerEvents: 'auto',
            padding: 24,
            color: 'var(--accent-coral)',
            fontSize: 13,
          }}
        >
          Deinem Konto ist kein Projekt zugeordnet. Bitte den Studio-Inhaber kontaktieren.
        </div>
      )
    }
    return <Navigate to={`/portal/${clientProjectId}`} replace />
  }

  return <>{children}</>
}
