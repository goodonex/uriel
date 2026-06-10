import { useParams } from 'react-router-dom'
import { FunnelCanvas } from '../funnel/FunnelCanvas'
import { HorizontalScroller } from '../HorizontalScroller'
import { PromoHomeDashboard } from '../promo/PromoHomeDashboard'
import { PromoPerformanceDashboard } from '../promo/PromoPerformanceDashboard'
import { SectionLabel } from '../SectionLabel'
import { useBrands } from '../../hooks/useBrands'
import { useHorizontalPanelUrl } from '../../hooks/useHorizontalPanelUrl'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import {
  PROMO_PANELS,
  promoPanelIndexFromPath,
  promoPathForPanel,
} from '../../lib/horizontalPanels'
import { AdsPanel } from '../../pages/promo/AdsPanel'
import { PromoEmailFlowsPanel } from '../../pages/promo/PromoEmailFlowsPanel'
import { PromoIdeasPanel } from '../../pages/promo/PromoIdeasPanel'
import { PromoSequencesPanel } from '../../pages/promo/PromoSequencesPanel'
import { PromoCalendarSplit, PromoCampaignsSplit, PromoPiecesSplit } from '../../pages/promo/PromoSplitViews'
import { ScrollSectionPanel } from './ScrollSectionPanel'

export function PromoSection() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { activeIndex, onIndexChange } = useHorizontalPanelUrl(
    slug,
    promoPanelIndexFromPath,
    promoPathForPanel,
  )

  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const { brands } = useBrands()
  const positioning = usePositioning(slug)
  const brand = brands.find((b) => b.slug === slug)

  const tabs = PROMO_PANELS.map((p) => ({ id: p.id, label: p.label }))

  const panels = [
    <PromoHomeDashboard key="overview" />,
    slug ? <FunnelCanvas key="funnel" slug={slug} /> : null,
    <PromoPerformanceDashboard key="dashboard" />,
    <div key="kalender">
      <PromoCalendarSplit />
      <div style={{ marginTop: 20 }}>
        <PromoPiecesSplit />
      </div>
      <div style={{ marginTop: 20 }}>
        <PromoCampaignsSplit />
      </div>
    </div>,
    slug ? <PromoEmailFlowsPanel key="email-flows" slug={slug} /> : null,
    <div key="ads">
      <SectionLabel accent="var(--accent-blue)">Ads</SectionLabel>
      <AdsPanel slug={slug} />
    </div>,
    <div key="ideen">
      <SectionLabel accent="var(--mode-promo)">Ideen</SectionLabel>
      <PromoIdeasPanel
        slug={slug}
        brandName={brand?.name ?? slug}
        positioningStatement={positioning.item?.statement ?? ''}
        toneOfVoice={positioning.item?.tone_of_voice ?? ''}
        icps={icps.items}
        wordBank={wordBank.items}
      />
    </div>,
    <div key="sequenzen">
      <SectionLabel accent="var(--mode-promo)">Sequenzen</SectionLabel>
      <PromoSequencesPanel slug={slug} className="!mt-0" />
    </div>,
  ]

  return (
    <ScrollSectionPanel section="promo">
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
