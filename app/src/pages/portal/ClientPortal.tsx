import { type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PortalCrmShell, PortalShell } from '../../components/portal/PortalShell'
import { useAuth } from '../../hooks/useAuth'
import { usePortalProject } from '../../hooks/usePortalProject'
import './portal.css'

export function ClientPortal({ preview = false, crm = false }: { preview?: boolean; crm?: boolean }) {
  const { projectId } = useParams<{ projectId: string }>()
  const { user, role, clientProjectId, signOut } = useAuth()
  const navigate = useNavigate()

  const { project, brand, loading, error } = usePortalProject(projectId, {
    preview,
    role,
    clientProjectId,
    userId: user?.id ?? null,
  })

  const accent = brand?.color && brand.color.startsWith('#') ? brand.color : '#111827'

  const displayName =
    (typeof user?.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : null) ??
    project?.client_name ??
    'Kunde'

  if (loading) {
    return (
      <div className="portal-root">
        <div className="portal-shell__main">
          <p style={{ fontSize: 14, color: 'var(--portal-text-secondary)' }}>Laden…</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="portal-root">
        <div className="portal-shell__main">
          <p style={{ fontSize: 14, color: '#c0392b' }}>
            {error ?? 'Projekt nicht gefunden.'}
          </p>
        </div>
      </div>
    )
  }

  if (role === 'client' && clientProjectId && projectId !== clientProjectId) {
    return null
  }

  return (
    <div className="portal-root" style={{ '--portal-accent': accent } as CSSProperties}>
      {crm ? (
        <PortalCrmShell
          project={project}
          brandName={brand?.name}
          accentColor={accent}
          senderName={displayName}
          preview={preview}
          onSignOut={
            preview
              ? undefined
              : () => void signOut().then(() => navigate('/login'))
          }
        />
      ) : (
        <PortalShell
          project={project}
          brandName={brand?.name}
          accentColor={accent}
          senderName={displayName}
          preview={preview}
          onSignOut={
            preview
              ? undefined
              : () => void signOut().then(() => navigate('/login'))
          }
        />
      )}
    </div>
  )
}
