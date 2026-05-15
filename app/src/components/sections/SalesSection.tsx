import { useLocation } from 'react-router-dom'
import { CardTile } from '../../modules/CardTile'
import { ContactDetailModule } from '../../modules/sales/ContactDetailModule'
import { PipelineModule } from '../../modules/sales/PipelineModule'
import { QuickStatsModule } from '../../modules/sales/QuickStatsModule'
import { TasksModule } from '../../modules/sales/TasksModule'
import { SECTION_GRID, SECTION_SHELL } from './sectionLayout'

function salesContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)/)
  if (!m?.[1]) return null
  if (m[1] === 'lists' || m[1] === 'call-mode') return null
  return m[1]
}

export function SalesSection() {
  const { pathname } = useLocation()
  const contactId = salesContactIdFromPath(pathname)

  return (
    <div data-scroll-section="sales" style={SECTION_SHELL}>
      <div
        style={{
          ...SECTION_GRID,
          gridTemplateColumns: contactId
            ? 'minmax(0, 1.1fr) minmax(260px, 30%) minmax(280px, 32%)'
            : undefined,
        }}
      >
        <div style={{ gridColumn: '1', gridRow: '1 / span 2', minHeight: 0 }}>
          <CardTile flyFrom="left" delay={0} style={{ height: '100%', maxHeight: 'calc(100vh - 56px)' }}>
            <PipelineModule />
          </CardTile>
        </div>
        <div style={{ gridColumn: contactId ? '3' : '2', gridRow: '1' }}>
          <CardTile flyFrom="right" delay={0.1} style={{ height: '100%' }}>
            <TasksModule />
          </CardTile>
        </div>
        <div style={{ gridColumn: contactId ? '3' : '2', gridRow: '2' }}>
          <CardTile flyFrom="right" delay={0.18} style={{ height: '100%' }}>
            <QuickStatsModule />
          </CardTile>
        </div>
        {contactId ? (
          <div style={{ gridColumn: '2', gridRow: '1 / span 2', minHeight: 0 }}>
            <CardTile flyFrom="right" delay={0.05} style={{ height: '100%', maxHeight: 'calc(100vh - 56px)' }}>
              <ContactDetailModule />
            </CardTile>
          </div>
        ) : null}
      </div>
    </div>
  )
}
