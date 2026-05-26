import type { ReactNode } from 'react'
import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useContactScrollLock } from '../../hooks/useContactScrollLock'
import { HorizontalScroller } from '../HorizontalScroller'
import { DeliverMoonStatusPanel } from '../deliver/DeliverMoonStatusPanel'
import { DeliverProjectCardsPanel } from '../deliver/DeliverProjectCardsPanel'
import { useHorizontalPanelUrl } from '../../hooks/useHorizontalPanelUrl'
import {
  DELIVER_PANELS,
  deliverPanelIndexFromPath,
  deliverPathForPanel,
  isDeliverProjectDetailPath,
} from '../../lib/horizontalPanels'
import { DeliverProjectModule } from '../../modules/deliver/DeliverProjectModule'
import { ScrollSectionPanel } from './ScrollSectionPanel'

function DeliverScrollPage({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useContactScrollLock(scrollRef)

  return (
    <div
      ref={scrollRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        pointerEvents: 'auto',
        padding: '4px 8px 28px',
        overscrollBehavior: 'contain',
      }}
    >
      {children}
    </div>
  )
}

export function DeliverSection({ slug }: { slug: string }) {
  const { pathname } = useLocation()
  const { activeIndex, onIndexChange } = useHorizontalPanelUrl(
    slug,
    deliverPanelIndexFromPath,
    deliverPathForPanel,
  )

  if (isDeliverProjectDetailPath(pathname)) {
    return (
      <ScrollSectionPanel section="deliver">
        <DeliverScrollPage>
          <DeliverProjectModule />
        </DeliverScrollPage>
      </ScrollSectionPanel>
    )
  }

  const tabs = DELIVER_PANELS.map((p) => ({ id: p.id, label: p.label }))
  const panels = [
    <DeliverProjectCardsPanel key="active" filter="active" />,
    <DeliverProjectCardsPanel key="completed" filter="completed" />,
    <DeliverMoonStatusPanel key="moon" />,
  ]

  return (
    <ScrollSectionPanel section="deliver">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          paddingTop: 4,
        }}
      >
        <HorizontalScroller
          tabs={tabs}
          activeIndex={activeIndex}
          onIndexChange={onIndexChange}
          children={panels}
        />
      </div>
    </ScrollSectionPanel>
  )
}
