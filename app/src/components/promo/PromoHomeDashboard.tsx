import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../SectionLabel'
import { useAdCampaigns } from '../../hooks/useAdCampaigns'
import { useBrandNavigate } from '../../hooks/useBrandNavigate'
import { usePromoPerformance } from '../../hooks/usePromoPerformance'
import { promoPathForPanel } from '../../lib/horizontalPanels'

function fmtNum(n: number): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(n))
}

export function PromoHomeDashboard() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { go } = useBrandNavigate(slug)
  const perf = usePromoPerformance(slug)
  const camps = useAdCampaigns(slug)

  const totals = useMemo(() => {
    let impressions = 0
    let clicks = 0
    let leads = 0
    for (const r of perf.items) {
      impressions += r.impressions
      clicks += r.clicks
      leads += r.leads
    }
    return { impressions, clicks, leads }
  }, [perf.items])

  const liveAds = camps.items.filter((c) => c.status === 'live').length

  const quickLinks = [
    { label: 'Funnel', index: 1 },
    { label: 'Performance', index: 2 },
    { label: 'Ads', index: 5 },
    { label: 'E-Mail & Flows', index: 4 },
  ] as const

  return (
    <div className="font-mono" style={{ padding: '4px 2px 20px' }}>
      <SectionLabel accent="var(--mode-promo)" tight>
        Übersicht
      </SectionLabel>

      <div className="flex flex-wrap gap-2" style={{ marginTop: 12, marginBottom: 20 }}>
        {[
          { label: 'Impressionen', value: fmtNum(totals.impressions) },
          { label: 'Klicks', value: fmtNum(totals.clicks) },
          { label: 'Leads', value: fmtNum(totals.leads) },
          { label: 'Live Ads', value: String(liveAds) },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="glass-2"
            style={{
              flex: '1 1 100px',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
            }}
          >
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
              {kpi.label}
            </div>
            <div
              className="font-display"
              style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <h3
        className="font-display"
        style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}
      >
        Schnellzugriff
      </h3>
      <div className="flex flex-wrap gap-2">
        {quickLinks.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => go(promoPathForPanel(slug, link.index))}
            style={{
              fontSize: 10,
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'color-mix(in srgb, var(--mode-promo) 10%, var(--glass-2))',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {link.label} →
          </button>
        ))}
      </div>
    </div>
  )
}
