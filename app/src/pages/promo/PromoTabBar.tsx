import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import type { PromoTab } from './PromoTabBar.types'

export type { PromoTab } from './PromoTabBar.types'

const ALL_TABS: ReadonlyArray<[PromoTab, string]> = [
  ['funnel', 'Funnel'],
  ['performance', 'Performance'],
  ['kalender', 'Kalender'],
  ['email', 'E-Mail'],
  ['ads', 'Ads'],
  ['ideen', 'Ideen'],
  ['flows', 'Flows'],
  ['sequenzen', 'Sequenzen'],
  ['recruiting', 'Recruiting'],
]

export function PromoTabBar({
  tab,
  setTab,
  compact = false,
}: {
  tab: PromoTab
  setTab: (t: PromoTab) => void
  compact?: boolean
}) {
  return (
    <motion.div
      layout
      className="module-scroll flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1"
      style={{ marginTop: compact ? 0 : 8, marginBottom: compact ? 8 : 0 }}
    >
      {ALL_TABS.map(([t, label]) => (
        <TabButton key={t} on={tab === t} onClick={() => setTab(t)} compact={compact}>
          {label}
        </TabButton>
      ))}
    </motion.div>
  )
}

function TabButton({
  on,
  onClick,
  children,
  compact,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  compact?: boolean
}) {
  return (
    <motion.button
      layout
      type="button"
      className="font-mono shrink-0"
      onClick={onClick}
      style={{
        fontSize: compact ? 9 : 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: compact ? '5px 9px' : '7px 12px',
        borderRadius: 8,
        border: on ? '1px solid var(--mode-promo)' : '1px solid var(--glass-border-2)',
        background: on
          ? 'color-mix(in srgb, var(--mode-promo) 16%, transparent)'
          : 'var(--glass-2)',
        color: on ? 'var(--mode-promo)' : 'var(--text-tertiary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </motion.button>
  )
}
