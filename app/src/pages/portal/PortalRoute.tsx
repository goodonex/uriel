import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { RequireAuthShell } from '../../components/RequireAuthShell'
import { useAuth } from '../../hooks/useAuth'
import { ClientPortal } from './ClientPortal'

function RequireClientPortalGate({ children }: { children: ReactNode }) {
  const { user, role, clientProjectId, loading } = useAuth()
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()

  if (loading) {
    return (
      <div
        className="font-mono animate-pulse"
        style={{
          pointerEvents: 'auto',
          padding: 32,
          color: 'var(--text-tertiary)',
          fontSize: 12,
          background: 'var(--bg-base)',
          minHeight: '100vh',
        }}
      >
        Session wird geladen…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role === 'owner') {
    return <Navigate to="/" replace />
  }

  if (role === 'client' && !clientProjectId) {
    return (
      <div
        className="font-mono"
        style={{
          pointerEvents: 'auto',
          padding: 32,
          color: 'var(--accent-coral)',
          fontSize: 13,
          background: 'var(--bg-base)',
          minHeight: '100vh',
        }}
      >
        Deinem Konto ist noch kein Projekt zugeordnet. Bitte melde dich bei deinem
        Ansprechpartner.
      </div>
    )
  }

  if (role === 'client' && clientProjectId && projectId !== clientProjectId) {
    return <Navigate to={`/portal/${clientProjectId}`} replace />
  }

  return <>{children}</>
}

/** Preview: ?preview=true — lädt Projekt aus localStorage (Entwicklung, kein Login). */
export function PortalRoute() {
  const [searchParams] = useSearchParams()
  const preview = searchParams.get('preview') === 'true'

  if (preview) {
    return <ClientPortal preview />
  }

  return (
    <RequireAuthShell>
      <RequireClientPortalGate>
        <ClientPortal preview={false} />
      </RequireClientPortalGate>
    </RequireAuthShell>
  )
}
