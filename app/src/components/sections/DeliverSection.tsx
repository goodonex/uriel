import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CardTile } from '../../modules/CardTile'
import { DeliverProjectModule } from '../../modules/deliver/DeliverProjectModule'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useContacts } from '../../hooks/useContacts'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'
import type { DeliverProject } from '../../types/db'
import { SCROLL_SIDE_CARD_WIDTH, SECTION_SHELL, SECTION_VIEWPORT } from './sectionLayout'

function deliverProjectId(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/deliver\/([^/]+)/)
  return m?.[1] ?? null
}

function DeliverProjectCard({
  project,
  clientLabel,
  delay,
  onOpen,
}: {
  project: DeliverProject
  clientLabel: string
  delay: number
  onOpen: () => void
}) {
  return (
    <CardTile
      flyFrom="bottom"
      delay={delay}
      style={{ width: 280, height: 160, flexShrink: 0 }}
    >
      <div
        className="font-display truncate"
        style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}
      >
        {project.name}
      </div>
      <div
        className="font-mono mt-1 truncate"
        style={{ fontSize: 11, color: 'var(--text-secondary)' }}
      >
        {clientLabel}
      </div>
      <div
        className="font-mono mt-3"
        style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-teal)' }}
      >
        {DELIVER_STAGE_LABEL[project.internal_stage]}
      </div>
      <button
        type="button"
        className="font-mono"
        onClick={onOpen}
        style={{
          marginTop: 'auto',
          paddingTop: 12,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          textAlign: 'left',
        }}
      >
        Öffnen →
      </button>
    </CardTile>
  )
}

export function DeliverSection({ slug }: { slug: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const projects = useDeliverProjects(slug)
  const contacts = useContacts(slug)
  const projectId = deliverProjectId(pathname)

  const active = projects.items.filter((p) => p.status !== 'completed').length
  const done = projects.items.filter((p) => p.status === 'completed').length

  const contactNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts.items) m.set(c.id, c.name || c.email || '')
    return m
  }, [contacts.items])

  const clientLabel = (p: DeliverProject) => {
    if (p.client_contact_id) return contactNameById.get(p.client_contact_id) ?? p.client_name
    return p.client_name || '—'
  }

  if (projectId) {
    return (
      <div data-scroll-section="deliver" style={SECTION_SHELL}>
        <div style={SECTION_VIEWPORT}>
          <CardTile
            flyFrom="left"
            delay={0}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: SCROLL_SIDE_CARD_WIDTH + 24,
              bottom: 0,
            }}
          >
            <DeliverProjectModule />
          </CardTile>
          <CardTile
            flyFrom="right"
            delay={0.08}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: SCROLL_SIDE_CARD_WIDTH,
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: 8,
              }}
            >
              Mond-Status
            </div>
            <div className="font-body" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {active} aktiv · {done} abgeschlossen
            </div>
          </CardTile>
        </div>
      </div>
    )
  }

  return (
    <div data-scroll-section="deliver" style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <CardTile
          flyFrom="right"
          delay={0}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: SCROLL_SIDE_CARD_WIDTH,
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            Mond-Status
          </div>
          <div className="font-body" style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
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
              marginTop: 12,
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
            Übersicht
          </button>
        </CardTile>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: SCROLL_SIDE_CARD_WIDTH + 24,
            bottom: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: 14,
            overflowY: 'auto',
            pointerEvents: 'none',
            paddingBottom: 8,
          }}
        >
          {projects.items.map((p, idx) => (
            <div key={p.id} style={{ pointerEvents: 'auto' }}>
              <DeliverProjectCard
                project={p}
                clientLabel={clientLabel(p)}
                delay={idx * 0.05}
                onOpen={() => navigate(`/brand/${slug}/deliver/${p.id}`)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
