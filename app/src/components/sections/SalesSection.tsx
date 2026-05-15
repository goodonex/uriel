import { useLocation, useParams } from 'react-router-dom'
import { HorizontalScroller } from '../HorizontalScroller'
import { CardTile } from '../../modules/CardTile'
import { ContactDetailModule } from '../../modules/sales/ContactDetailModule'
import { SalesListDetailModule } from '../../modules/sales/SalesListDetailModule'
import { SalesListsModule } from '../../modules/sales/SalesListsModule'
import { useHorizontalPanelUrl } from '../../hooks/useHorizontalPanelUrl'
import {
  SALES_PANELS,
  salesPanelIndexFromPath,
  salesPathForPanel,
} from '../../lib/horizontalPanels'
import { CallModePage } from '../../pages/sales/CallModePage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { ScrollSectionPanel } from './ScrollSectionPanel'
import { SECTION_SHELL, SECTION_VIEWPORT } from './sectionLayout'

const CONTACT_PANEL_W = 320

function salesListIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/lists\/([^/]+)/)
  return m?.[1] ?? null
}

function salesContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)/)
  if (!m?.[1]) return null
  if (m[1] === 'lists' || m[1] === 'call-mode') return null
  return m[1]
}

function salesView(pathname: string): 'call-mode' | 'list-detail' | 'horizontal' {
  if (pathname.includes('/sales/call-mode')) return 'call-mode'
  if (salesListIdFromPath(pathname)) return 'list-detail'
  return 'horizontal'
}

export function SalesSection() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const view = salesView(pathname)
  const contactId = salesContactIdFromPath(pathname)
  const { activeIndex, onIndexChange } = useHorizontalPanelUrl(
    slug,
    salesPanelIndexFromPath,
    salesPathForPanel,
  )

  if (view === 'call-mode') {
    return (
      <ScrollSectionPanel section="sales">
        <CallModePage />
      </ScrollSectionPanel>
    )
  }

  if (view === 'list-detail') {
    return (
      <ScrollSectionPanel section="sales">
        <SalesListDetailModule />
      </ScrollSectionPanel>
    )
  }

  const tabs = SALES_PANELS.map((p) => ({ id: p.id, label: p.label }))

  const pipelinePanel = (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        paddingRight: contactId ? CONTACT_PANEL_W + 12 : 0,
      }}
    >
      <SalesMode scrollEmbed />
      {contactId ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: CONTACT_PANEL_W,
            zIndex: 2,
          }}
        >
          <ContactDetailModule />
        </div>
      ) : null}
    </div>
  )

  const panels = [pipelinePanel, <SalesListsModule key="lists" />]

  return (
    <div data-scroll-section="sales" style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <CardTile
          bare
          flyFrom="left"
          delay={0}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <HorizontalScroller
            tabs={tabs}
            activeIndex={activeIndex}
            onIndexChange={onIndexChange}
            children={panels}
          />
        </CardTile>
      </div>
    </div>
  )
}
