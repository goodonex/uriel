import { useLocation, useNavigate } from 'react-router-dom'
import { CardTile } from '../../modules/CardTile'
import { DeliverProjectModule } from '../../modules/deliver/DeliverProjectModule'
import { DeliverWorkspaceModule } from '../../modules/deliver/DeliverWorkspaceModule'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { SECTION_GRID, SECTION_SHELL } from './sectionLayout'

function deliverProjectId(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/deliver\/([^/]+)/)
  return m?.[1] ?? null
}

export function DeliverSection({ slug }: { slug: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const projects = useDeliverProjects(slug)
  const projectId = deliverProjectId(pathname)

  const active = projects.items.filter((p) => p.status !== 'completed').length
  const done = projects.items.filter((p) => p.status === 'completed').length

  return (
    <div data-scroll-section="deliver" style={SECTION_SHELL}>
      <div style={SECTION_GRID}>
        <div style={{ gridColumn: '1', gridRow: '1 / span 2', minHeight: 0 }}>
          <CardTile flyFrom="left" delay={0} style={{ height: '100%', maxHeight: 'calc(100vh - 56px)' }}>
            {projectId ? <DeliverProjectModule /> : <DeliverWorkspaceModule />}
          </CardTile>
        </div>
        <div style={{ gridColumn: '2', gridRow: '1 / span 2' }}>
          <CardTile flyFrom="right" delay={0.1} style={{ height: '100%' }}>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: 10,
              }}
            >
              Mond-Status
            </div>
            <div className="font-body" style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
              {projects.items.length} Projekte
            </div>
            <div className="font-body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {active} aktiv · {done} abgeschlossen
            </div>
            <button
              type="button"
              className="font-mono"
              onClick={() => navigate(`/brand/${slug}/deliver`)}
              style={{
                marginTop: 14,
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                padding: '8px 10px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Alle Projekte
            </button>
          </CardTile>
        </div>
      </div>
    </div>
  )
}
