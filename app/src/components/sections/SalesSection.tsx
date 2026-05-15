import { useLocation } from 'react-router-dom'
import { CardTile } from '../../modules/CardTile'
import { ContactDetailModule } from '../../modules/sales/ContactDetailModule'
import { PipelineModule } from '../../modules/sales/PipelineModule'
import { QuickStatsModule } from '../../modules/sales/QuickStatsModule'
import { TasksModule } from '../../modules/sales/TasksModule'
import {
  SCROLL_PIPELINE_WIDTH,
  SCROLL_SIDE_CARD_WIDTH,
  SECTION_SHELL,
  SECTION_VIEWPORT,
} from './sectionLayout'

function salesContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)/)
  if (!m?.[1]) return null
  if (m[1] === 'lists' || m[1] === 'call-mode') return null
  return m[1]
}

export function SalesSection() {
  const { pathname } = useLocation()
  const contactId = salesContactIdFromPath(pathname)

  const pipelineWidth = SCROLL_PIPELINE_WIDTH
  const sideW = SCROLL_SIDE_CARD_WIDTH

  return (
    <div data-scroll-section="sales" style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <CardTile
          flyFrom="left"
          delay={0}
          className="sales-scroll-pipeline-card"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: contactId
              ? `calc(${pipelineWidth} - ${sideW + 16}px)`
              : pipelineWidth,
            bottom: 0,
            maxHeight: '100%',
          }}
        >
          <PipelineModule />
        </CardTile>

        {contactId ? (
          <CardTile
            flyFrom="right"
            delay={0.05}
            style={{
              position: 'absolute',
              top: 0,
              right: sideW + 16,
              width: sideW,
              bottom: 0,
            }}
          >
            <ContactDetailModule />
          </CardTile>
        ) : null}

        <CardTile
          flyFrom="right"
          delay={0.1}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: sideW,
            maxHeight: contactId ? 'calc(50% - 6px)' : 'calc(50% - 6px)',
          }}
        >
          <TasksModule />
        </CardTile>

        <CardTile
          flyFrom="right"
          delay={0.18}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: sideW,
            maxHeight: 'calc(50% - 6px)',
          }}
        >
          <QuickStatsModule />
        </CardTile>
      </div>
    </div>
  )
}
