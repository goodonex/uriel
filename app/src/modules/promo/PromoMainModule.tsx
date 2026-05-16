import { motion } from 'framer-motion'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FunnelCanvas } from '../../components/funnel/FunnelCanvas'
import { SectionLabel } from '../../components/SectionLabel'
import { useBrands } from '../../hooks/useBrands'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import { AdsPanel } from '../../pages/promo/AdsPanel'
import { MailFlowsPanel } from '../../pages/promo/MailFlowsPanel'
import { PromoEmailPanel } from '../../pages/promo/PromoEmailPanel'
import { PromoIdeasPanel } from '../../pages/promo/PromoIdeasPanel'
import { PromoCalendarSplit } from '../../pages/promo/PromoSplitViews'
import { PromoHubStrip } from '../../pages/promo/PromoHubStrip'
import { PromoPerformanceDashboard } from '../../components/promo/PromoPerformanceDashboard'
import { PromoSequencesPanel } from '../../pages/promo/PromoSequencesPanel'
import { PromoTabBar, type PromoTab } from '../../pages/promo/PromoTabBar'
import { RecruitingPanel } from '../../pages/promo/RecruitingPanel'

/** Main-Slot: Funnel + Tab-Navigation. Pieces/Kampagnen leben in Side-Modulen. */
export function PromoMainModule() {
  const { slug } = useParams<{ slug: string }>()
  const [tab, setTab] = useState<PromoTab>('funnel')

  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const { brands } = useBrands()
  const positioning = usePositioning(slug)
  const brand = brands.find((b) => b.slug === slug)

  return (
    <motion.div layout style={{ minWidth: 0 }}>
      <PromoTabBar tab={tab} setTab={setTab} compact />
      {tab === 'funnel' ? (
        slug ? <FunnelCanvas slug={slug} /> : null
      ) : tab === 'performance' ? (
        <PromoPerformanceDashboard />
      ) : tab === 'kalender' ? (
        <>
          <PromoCalendarSplit />
          <PromoHubStrip onPick={setTab} />
        </>
      ) : tab === 'ideen' ? (
        <>
          <SectionLabel accent="var(--mode-promo)">Ideen</SectionLabel>
          {slug ? (
            <PromoIdeasPanel
              slug={slug}
              brandName={brand?.name ?? slug}
              positioningStatement={positioning.item?.statement ?? ''}
              toneOfVoice={positioning.item?.tone_of_voice ?? ''}
              icps={icps.items}
              wordBank={wordBank.items}
            />
          ) : null}
        </>
      ) : tab === 'email' ? (
        <>
          <SectionLabel accent="var(--accent-blue)">E-Mail</SectionLabel>
          {slug ? <PromoEmailPanel slug={slug} /> : null}
        </>
      ) : tab === 'sequenzen' ? (
        <>
          <SectionLabel accent="var(--mode-promo)">Sequenzen</SectionLabel>
          {slug ? <PromoSequencesPanel slug={slug} className="!mt-0" /> : null}
        </>
      ) : tab === 'flows' ? (
        <>
          <SectionLabel accent="var(--accent-blue)">Mail-Flows</SectionLabel>
          {slug ? <MailFlowsPanel slug={slug} /> : null}
        </>
      ) : tab === 'recruiting' ? (
        <>
          <SectionLabel accent="var(--accent-teal)">Recruiting</SectionLabel>
          {slug ? <RecruitingPanel slug={slug} /> : null}
        </>
      ) : (
        <>
          <SectionLabel accent="var(--accent-blue)">Ads</SectionLabel>
          {slug ? <AdsPanel slug={slug} /> : null}
        </>
      )}
    </motion.div>
  )
}
