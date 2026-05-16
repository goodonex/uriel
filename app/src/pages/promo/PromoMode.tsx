import { motion } from 'framer-motion'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FunnelCanvas } from '../../components/funnel/FunnelCanvas'
import { SectionLabel } from '../../components/SectionLabel'
import { useBrands } from '../../hooks/useBrands'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import { PromoCalendarSplit, PromoCampaignsSplit, PromoPiecesSplit } from './PromoSplitViews'
import { PromoTabBar, type PromoTab } from './PromoTabBar'
import { AdsPanel } from './AdsPanel'
import { MailFlowsPanel } from './MailFlowsPanel'
import { PromoEmailPanel } from './PromoEmailPanel'
import { PromoIdeasPanel } from './PromoIdeasPanel'
import { PromoPerformanceDashboard } from '../../components/promo/PromoPerformanceDashboard'
import { PromoSequencesPanel } from './PromoSequencesPanel'
import { RecruitingPanel } from './RecruitingPanel'

export function PromoMode() {
  const { slug } = useParams<{ slug: string }>()

  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const { brands } = useBrands()
  const positioning = usePositioning(slug)
  const brand = brands.find((b) => b.slug === slug)

  const [promoTab, setPromoTab] = useState<PromoTab>('funnel')

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      <motion.div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <motion.div>
          <motion.div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mode-promo)',
              marginBottom: 6,
            }}
          >
            Promo Mode
          </motion.div>
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            Content &amp; Kampagnen
          </h2>
          <PromoTabBar tab={promoTab} setTab={setPromoTab} />
        </motion.div>
      </motion.div>

      {promoTab === 'funnel' ? (
        slug ? <FunnelCanvas slug={slug} /> : null
      ) : promoTab === 'performance' ? (
        <PromoPerformanceDashboard />
      ) : promoTab === 'kalender' ? (
        <>
          <PromoCalendarSplit />
          <motion.div style={{ marginTop: 20 }}>
            <PromoPiecesSplit />
          </motion.div>
          <motion.div style={{ marginTop: 20 }}>
            <PromoCampaignsSplit />
          </motion.div>
        </>
      ) : promoTab === 'ideen' ? (
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
      ) : promoTab === 'email' ? (
        <>
          <SectionLabel accent="var(--accent-blue)">E-Mail</SectionLabel>
          {slug ? <PromoEmailPanel slug={slug} /> : null}
        </>
      ) : promoTab === 'sequenzen' ? (
        <>
          <SectionLabel accent="var(--mode-promo)">Sequenzen</SectionLabel>
          {slug ? <PromoSequencesPanel slug={slug} className="!mt-0" /> : null}
        </>
      ) : promoTab === 'flows' ? (
        <>
          <SectionLabel accent="var(--accent-blue)">Mail-Flows</SectionLabel>
          {slug ? <MailFlowsPanel slug={slug} /> : null}
        </>
      ) : promoTab === 'recruiting' ? (
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
