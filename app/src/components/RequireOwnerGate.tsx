import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Workspace nur für eingeloggte Owner (nicht Client-Rolle). */
export function RequireOwnerGate({ children }: { children: ReactNode }) {
  const { user, role, clientSlug, loading } = useAuth()
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
    const slug = clientSlug ?? 'workspace'
    return <Navigate to={`/portal/${slug}`} replace />
  }

  return <>{children}</>
}
