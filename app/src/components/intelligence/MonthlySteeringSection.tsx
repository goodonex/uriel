import { useMemo } from 'react'
import { useAdCampaigns } from '../../hooks/useAdCampaigns'
import { useBusinessTargets } from '../../hooks/useBusinessTargets'
import { useMonthlySnapshot } from '../../hooks/useMonthlySnapshot'
import { useMrrMetrics } from '../../hooks/useMrrMetrics'
import { computeAdsMetrics, linearMrrPlanProgress } from '../../lib/performanceMetrics'
import { startOfMonthIsoDate } from '../../lib/performanceDates'

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)} %`
}

function Ampel({ value, target, invert }: { value: number; target: number; invert?: boolean }) {
  const ok = invert ? value <= target : value >= target
  const warn = invert ? value <= target * 1.5 : value >= target * 0.85
  const color = ok
    ? 'var(--accent-mint, var(--accent-teal))'
    : warn
      ? 'var(--accent-amber, #d4a017)'
      : 'var(--accent-coral)'
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        marginRight: 6,
      }}
    />
  )
}

export function MonthlySteeringSection({ slug }: { slug: string }) {
  const { metrics } = useMrrMetrics(slug)
  const { current, previous } = useMonthlySnapshot(slug)
  const targets = useBusinessTargets(slug)
  const campaigns = useAdCampaigns(slug)

  const ads = useMemo(() => computeAdsMetrics(campaigns.items), [campaigns.items])

  const mrr = current?.mrr_override ?? current?.mrr ?? metrics.currentMrr
  const prevMrr = previous?.mrr_override ?? previous?.mrr ?? 0
  const mrrDelta = mrr - prevMrr

  const plan = useMemo(() => {
    const t = targets.current
    if (!t) return null
    return linearMrrPlanProgress(mrr, t.north_star_mrr, '2026-07-01', t.north_star_deadline)
  }, [mrr, targets.current])

  const monthLabel = useMemo(() => {
    const d = new Date(startOfMonthIsoDate())
    return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  }, [])

  return (
    <section
      className="rounded-2xl"
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        padding: '18px 20px',
        marginBottom: 16,
      }}
    >
      <div className="mb-4">
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--mode-intelligence, var(--accent-blue))' }}
        >
          MONATS-STEUERUNG
        </div>
        <h3 className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
          {monthLabel}
        </h3>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <MetricRow
          label="MRR gesamt"
          value={`${fmtEuro(mrr)} (${mrrDelta >= 0 ? '+' : ''}${fmtEuro(mrrDelta)} vs. Vormonat)`}
          ok={mrrDelta >= 0}
        />
        <MetricRow
          label="Churn Retainer"
          value={fmtPct(metrics.monthlyChurnRate)}
          ok={metrics.monthlyChurnRate < 5}
          hint="Ziel <5 %/Monat"
        />
        <MetricRow
          label="Gesamtumsatz Monat"
          value={fmtEuro(current?.total_revenue ?? metrics.totalRevenueThisMonth)}
        />
        <MetricRow
          label="Gewinn / Marge"
          value="Lexoffice folgt"
          muted
        />
        <MetricRow
          label="Kunden aktiv"
          value={String(metrics.activeCustomers)}
        />
        <MetricRow
          label="8k-MRR-Fortschritt"
          value={
            plan
              ? `${Math.round(plan.pct)} % · ${plan.onTrack ? 'Im Plan' : 'Hinter Plan'}`
              : '—'
          }
          ok={plan?.onTrack ?? false}
        />
        {ads.cpl !== null ? (
          <>
            <MetricRow label="Cost per Lead" value={fmtEuro(ads.cpl)} />
            <MetricRow label="Cost per Kunde" value={ads.cpk != null ? fmtEuro(ads.cpk) : '—'} />
          </>
        ) : (
          <MetricRow label="Ads" value="Noch keine Live-Kampagnen" muted />
        )}
      </div>
    </section>
  )
}

function MetricRow({
  label,
  value,
  ok,
  hint,
  muted,
}: {
  label: string
  value: string
  ok?: boolean
  hint?: string
  muted?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        fontSize: 12,
        padding: '8px 0',
        borderBottom: '1px solid var(--glass-border-1)',
      }}
    >
      <div style={{ color: 'var(--text-tertiary)' }}>
        {ok !== undefined ? <Ampel value={ok ? 1 : 0} target={1} /> : null}
        {label}
        {hint ? (
          <div className="font-mono" style={{ fontSize: 9, marginTop: 2 }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div
        style={{
          color: muted ? 'var(--text-tertiary)' : 'var(--text-secondary)',
          textAlign: 'right',
          fontWeight: 500,
        }}
      >
        {value}
      </div>
    </div>
  )
}
