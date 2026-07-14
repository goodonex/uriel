import { type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PortalCrmShell, PortalShell } from '../../components/portal/PortalShell'
import { useAuth } from '../../hooks/useAuth'
import { usePortalProject } from '../../hooks/usePortalProject'
import './portal.css'

export function ClientPortal({
  preview = false,
  crm = false,
  ownerView = false,
}: {
  preview?: boolean
  crm?: boolean
  /** Kevin schaut als Owner durch die Kundenbrille (?als=kunde). */
  ownerView?: boolean
}) {
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
          <p style={{ fontSize: 14, color: 'var(--status-danger)' }}>
            {error ?? 'Projekt nicht gefunden.'}
          </p>
        </div>
      </div>
    )
  }

  if (role === 'client' && clientProjectId && projectId !== clientProjectId) {
    return null
  }

  const onSignOut =
    preview || ownerView
      ? undefined
      : () => void signOut().then(() => navigate('/portal/login'))

  return (
    <div className="portal-root" style={{ '--portal-accent': accent } as CSSProperties}>
      {ownerView ? (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 16px',
            background: '#111827',
            color: '#f9fafb',
            fontSize: 13,
          }}
        >
          <span>
            <strong>Kunden-Ansicht</strong> — du siehst das Portal wie dein Kunde.
          </span>
          <button
            type="button"
            onClick={() => navigate(projectId ? `/projekte/${projectId}` : '/projekte')}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.35)',
              background: 'transparent',
              color: '#f9fafb',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Zurück zum Cockpit
          </button>
        </div>
      ) : null}
      {crm ? (
        <PortalCrmShell
          project={project}
          brandName={brand?.name}
          accentColor={accent}
          senderName={displayName}
          preview={preview}
          onSignOut={onSignOut}
        />
      ) : (
        <PortalShell
          project={project}
          brandName={brand?.name}
          accentColor={accent}
          senderName={displayName}
          preview={preview}
          onSignOut={onSignOut}
        />
      )}
    </div>
  )
}
