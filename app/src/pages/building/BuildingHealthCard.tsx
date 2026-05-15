import { Link } from 'react-router-dom'
import { healthScoreColor, computeBuildingHealth } from '../../lib/brandHealthScore'
import type { BusinessModelDoc, ICP, Positioning, WordBankEntry, Asset } from '../../types/db'

export function BuildingHealthCard({
  slug,
  positioning,
  icps,
  wordBank,
  businessModel,
  assets,
  variant = 'standalone',
}: {
  slug: string
  positioning: Positioning | null
  icps: ICP[]
  wordBank: WordBankEntry[]
  businessModel: BusinessModelDoc | null
  assets: Asset[]
  variant?: 'standalone' | 'tile'
}) {
  const isTile = variant === 'tile'
  const { percent, missing } = computeBuildingHealth({
    positioning,
    icps,
    wordBank,
    businessModel,
    assets,
  })
  const c = healthScoreColor(percent)
  const size = isTile ? 80 : 96
  const stroke = 6
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ

  return (
    <div
      className="font-body shrink-0"
      style={{
        width: isTile ? '100%' : 220,
        padding: isTile ? 0 : 16,
        borderRadius: isTile ? 0 : 16,
        background: isTile ? 'transparent' : 'var(--glass-2)',
        border: isTile ? 'none' : '1px solid var(--glass-border-1)',
        backdropFilter: isTile ? undefined : 'var(--blur-md)',
        WebkitBackdropFilter: isTile ? undefined : 'var(--blur-md)',
      }}
    >
      {!isTile ? (
        <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          BUILDING HEALTH
        </div>
      ) : null}
      <div className={isTile ? 'flex gap-3' : 'mt-3 flex gap-4'}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--glass-border-2)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={c}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="font-display"
            fill="var(--text-primary)"
            fontSize={isTile ? 18 : 20}
            fontWeight={600}
          >
            {percent}%
          </text>
        </svg>
        <div className="min-w-0 flex-1">
          {missing.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Foundation vollständig.</div>
          ) : (
            <ul className="m-0 list-none space-y-1 p-0">
              {missing.slice(0, isTile ? 3 : 5).map((m) => (
                <li key={m} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  · {m}
                </li>
              ))}
            </ul>
          )}
          {!isTile ? (
            <Link
              to={`/brand/${slug}/foundation`}
              className="font-mono mt-2 inline-block"
              style={{ fontSize: 10, color: 'var(--mode-building)' }}
            >
              Details →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}
