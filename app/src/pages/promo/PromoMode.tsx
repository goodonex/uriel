import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useBrands } from '../../hooks/useBrands'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import { PromoCalendarSplit, PromoCampaignsSplit, PromoPiecesSplit } from './PromoSplitViews'
import { AdsPanel } from './AdsPanel'
import { MailFlowsPanel } from './MailFlowsPanel'
import { PromoEmailPanel } from './PromoEmailPanel'
import { PromoIdeasPanel } from './PromoIdeasPanel'
import { PromoSequencesPanel } from './PromoSequencesPanel'
import { RecruitingPanel } from './RecruitingPanel'

export function PromoMode() {
  const { slug } = useParams<{ slug: string }>()

  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const { brands } = useBrands()
  const positioning = usePositioning(slug)
  const brand = brands.find((b) => b.slug === slug)

  const [promoTab, setPromoTab] = useState<
    'kalender' | 'ideen' | 'sequenzen' | 'email' | 'flows' | 'recruiting' | 'ads'
  >('kalender')

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div>
          <div
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
          </div>
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
        </div>
      </div>

      {promoTab === 'kalender' ? (
        <>
          <PromoCalendarSplit />
          <div style={{ marginTop: 20 }}>
            <PromoPiecesSplit />
          </div>
          <div style={{ marginTop: 20 }}>
            <PromoCampaignsSplit />
          </div>
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
      ) : promoTab === 'sequenzen' ? (
        <>
          <SectionLabel accent="var(--mode-promo)">Sequenzen</SectionLabel>
          {slug ? <PromoSequencesPanel slug={slug} /> : null}
        </>
      ) : promoTab === 'email' ? (
        <>
          <SectionLabel accent="var(--accent-blue)">E-Mail-Sequenzen</SectionLabel>
          {slug ? <PromoEmailPanel slug={slug} /> : null}
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

// ============================================================
// PromoTabBar — 3 primäre Tabs + "Mehr"-Dropdown.
// ============================================================

type PromoTab = 'kalender' | 'ideen' | 'sequenzen' | 'email' | 'flows' | 'recruiting' | 'ads'

const PRIMARY_TABS: ReadonlyArray<[PromoTab, string]> = [
  ['kalender', 'Kalender'],
  ['ideen', 'Ideen'],
  ['flows', 'Mail-Flows'],
]

const MORE_TABS: ReadonlyArray<[PromoTab, string]> = [
  ['sequenzen', 'Content-Sequenzen'],
  ['email', 'E-Mail-Plan'],
  ['recruiting', 'Recruiting'],
  ['ads', 'Ads'],
]

function PromoTabBar({
  tab,
  setTab,
}: {
  tab: PromoTab
  setTab: (t: PromoTab) => void
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!moreOpen) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [moreOpen])

  const activeMore = MORE_TABS.find(([t]) => t === tab)

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {PRIMARY_TABS.map(([t, label]) => (
        <TabButton key={t} on={tab === t} onClick={() => setTab(t)}>
          {label}
        </TabButton>
      ))}
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <TabButton on={!!activeMore} onClick={() => setMoreOpen((m) => !m)}>
          {activeMore ? activeMore[1] : 'Mehr'}
          <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.7 }}>▾</span>
        </TabButton>
        <AnimatePresence>
          {moreOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: 200,
                padding: 4,
                borderRadius: 12,
                background: 'rgba(20, 22, 28, 0.92)',
                border: '1px solid var(--glass-border-2)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
                zIndex: 50,
              }}
            >
              {MORE_TABS.map(([t, label]) => {
                const on = tab === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTab(t)
                      setMoreOpen(false)
                    }}
                    className="font-mono"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: on ? 'var(--mode-promo)' : 'var(--text-secondary)',
                      background: on ? 'color-mix(in srgb, var(--mode-promo) 14%, transparent)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="font-mono"
      onClick={onClick}
      style={{
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '8px 14px',
        borderRadius: 10,
        border: on ? '1px solid var(--mode-promo)' : '1px solid var(--glass-border-2)',
        background: on
          ? 'color-mix(in srgb, var(--mode-promo) 16%, transparent)'
          : 'var(--glass-2)',
        color: on ? 'var(--mode-promo)' : 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
