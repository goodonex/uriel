import { motion } from 'framer-motion'
import type { PromoTab } from './PromoTabBar.types'

const QUICK: ReadonlyArray<{ tab: PromoTab; label: string; hint: string }> = [
  { tab: 'email', label: 'E-Mail-Plan', hint: 'Sequenzen & Versand' },
  { tab: 'ads', label: 'Ads', hint: 'Kampagnen & Performance' },
  { tab: 'ideen', label: 'Ideen', hint: 'Content aus Foundation' },
  { tab: 'flows', label: 'Mail-Flows', hint: 'Automationen' },
]

export function PromoHubStrip({ onPick }: { onPick: (tab: PromoTab) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" style={{ marginTop: 12, marginBottom: 4 }}>
      {QUICK.map((q) => (
        <button
          key={q.tab}
          type="button"
          onClick={() => onPick(q.tab)}
          className="text-left transition-colors hover:bg-[var(--glass-3)]"
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-1)',
            cursor: 'pointer',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--mode-promo)',
              marginBottom: 4,
            }}
          >
            {q.label}
          </div>
          <motion.div
            layout
            className="font-body"
            style={{ fontSize: 11, color: 'var(--text-secondary)' }}
          >
            {q.hint}
          </motion.div>
        </button>
      ))}
    </div>
  )
}
