import type { ReactNode } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { HorizontalScroller } from '../HorizontalScroller'
import { CardTile } from '../../modules/CardTile'
import { SalesListDetailModule } from '../../modules/sales/SalesListDetailModule'
import { SalesListsModule } from '../../modules/sales/SalesListsModule'
import { useHorizontalPanelUrl } from '../../hooks/useHorizontalPanelUrl'
import {
  isSalesNewLeadPath,
  SALES_PANELS,
  salesContactIdFromPath,
  salesPanelIndexFromPath,
  salesPathForPanel,
} from '../../lib/horizontalPanels'
import { DailyWorkList } from '../sales/DailyWorkList'
import { PostCallModal } from '../sales/PostCallModal'
import { CallModePage } from '../../pages/sales/CallModePage'
import { ContactPage } from '../../pages/sales/ContactPage'
import { SalesMode } from '../../pages/sales/SalesMode'
import { SalesNewLeadPage } from '../../pages/sales/SalesNewLeadPage'
import { PostCallFlowProvider } from '../../hooks/usePostCallFlow'
import { ScrollSectionPanel } from './ScrollSectionPanel'
import { SECTION_SHELL, SECTION_VIEWPORT } from './sectionLayout'

function salesListIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/lists\/([^/]+)/)
  return m?.[1] ?? null
}

function salesView(pathname: string): 'call-mode' | 'list-detail' | 'contact' | 'new-lead' | 'horizontal' {
  if (pathname.includes('/sales/call-mode')) return 'call-mode'
  if (salesListIdFromPath(pathname)) return 'list-detail'
  if (isSalesNewLeadPath(pathname)) return 'new-lead'
  if (salesContactIdFromPath(pathname)) return 'contact'
  return 'horizontal'
}

function SalesScrollPage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        pointerEvents: 'auto',
        padding: '4px 8px 28px',
      }}
    >
      {children}
    </div>
  )
}

export function SalesSection() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const view = salesView(pathname)
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

  if (view === 'new-lead') {
    return (
      <ScrollSectionPanel section="sales">
        <SalesScrollPage>
          <SalesNewLeadPage />
        </SalesScrollPage>
      </ScrollSectionPanel>
    )
  }

  if (view === 'contact') {
    return (
      <PostCallFlowProvider>
        <ScrollSectionPanel section="sales">
          <SalesScrollPage>
            <ContactPage variant="page" />
          </SalesScrollPage>
        </ScrollSectionPanel>
        {slug ? <PostCallModal brandSlug={slug} /> : null}
      </PostCallFlowProvider>
    )
  }

  const tabs = SALES_PANELS.map((p) => ({ id: p.id, label: p.label }))
  const pipelinePanel = <SalesMode scrollEmbed />
  const panels = [
    pipelinePanel,
    <SalesListsModule key="lists" />,
    <DailyWorkList key="heute" />,
  ]

  return (
    <PostCallFlowProvider>
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
    {slug ? <PostCallModal brandSlug={slug} /> : null}
    </PostCallFlowProvider>
  )
}
