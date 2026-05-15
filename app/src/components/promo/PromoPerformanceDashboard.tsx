import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useContentPieces } from '../../hooks/useContentPieces'
import { usePromoPerformance } from '../../hooks/usePromoPerformance'
import type { ContentPiece } from '../../types/db'

function fmtNum(n: number): string {
  return new Intl.NumberFormat('de-DE').format(Math.round(n))
}

function pct(clicks: number, impressions: number): string {
  if (impressions <= 0) return '—'
  return `${((clicks / impressions) * 100).toFixed(1)} %`
}

function cac(spend: number, leads: number): string {
  if (leads <= 0) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
    spend / leads,
  )
}

export function PromoPerformanceDashboard() {
  const { slug = '' } = useParams<{ slug: string }>()
  const pieces = useContentPieces(slug)
  const perf = usePromoPerformance(slug)

  const [periodSpend, setPeriodSpend] = useState('')
  const [roiInvest, setRoiInvest] = useState('')
  const [roiReturn, setRoiReturn] = useState('')

  const totals = useMemo(() => {
    let impressions = 0
    let clicks = 0
    let leads = 0
    let spend = Number(periodSpend) || 0
    for (const r of perf.items) {
      impressions += r.impressions
      clicks += r.clicks
      leads += r.leads
      spend += r.spend
    }
    return { impressions, clicks, leads, spend }
  }, [perf.items, periodSpend])

  const bestPiece = useMemo((): ContentPiece | null => {
    let best: ContentPiece | null = null
    let bestEng = -1
    for (const p of pieces.items) {
      const eng = p.performance_manual?.engagements ?? 0
      if (eng > bestEng) {
        bestEng = eng
        best = p
      }
    }
    return best
  }, [pieces.items])

  const tableRows = useMemo(() => {
    const merged = pieces.items.slice(0, 12).map((p) => {
      const row = perf.items.find((r) => r.piece_id === p.id)
      return { piece: p, row }
    })
    return merged.slice(0, 5)
  }, [pieces.items, perf.items])

  const roiHint = useMemo(() => {
    const invest = Number(roiInvest)
    const ret = Number(roiReturn)
    if (!invest || !ret) return null
    const multiple = ret / invest
    return `${multiple.toFixed(2)}× ROI`
  }, [roiInvest, roiReturn])

  const kpis = [
    { label: 'Reichweite', value: fmtNum(totals.impressions), sub: 'Impressionen (Summe)' },
    { label: 'Klicks + CTR', value: fmtNum(totals.clicks), sub: pct(totals.clicks, totals.impressions) },
    { label: 'Leads', value: fmtNum(totals.leads), sub: 'generiert' },
    { label: 'CAC', value: cac(totals.spend, totals.leads), sub: 'aus Spend / Leads' },
    {
      label: 'Top Piece',
      value: bestPiece?.title?.slice(0, 28) || '—',
      sub: bestPiece ? `${bestPiece.performance_manual?.engagements ?? 0} Engagement` : 'manuell pflegen',
    },
    { label: 'ROI-Rechner', value: roiHint ?? '—', sub: 'Invest → Return' },
  ]

  const updatePieceMetric = (
    piece: ContentPiece,
    field: 'impressions' | 'clicks' | 'leads' | 'spend',
    raw: string,
  ) => {
    const num = Number(raw) || 0
    const existing = perf.items.find((r) => r.piece_id === piece.id)
    if (existing) {
      perf.upsert({ ...existing, [field]: num })
      return
    }
    perf.upsert({
      piece_id: piece.id,
      label: piece.title,
      impressions: field === 'impressions' ? num : 0,
      clicks: field === 'clicks' ? num : 0,
      leads: field === 'leads' ? num : 0,
      spend: field === 'spend' ? num : 0,
    })
  }

  const getMetric = (pieceId: string, field: 'impressions' | 'clicks' | 'leads' | 'spend') => {
    const row = perf.items.find((r) => r.piece_id === pieceId)
    return row?.[field] ?? 0
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--mode-promo)',
          marginBottom: 8,
        }}
      >
        Performance
      </div>
      <h2
        className="font-display"
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 16,
        }}
      >
        Promo Auswertung
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.label}
            className="glass-2"
            style={{
              borderRadius: 14,
              padding: '12px 14px',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            <div
              className="font-mono"
              style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 6 }}
            >
              {k.label}
            </div>
            <div
              className="font-display"
              style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {k.value}
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      <div
        className="glass-2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 16,
          padding: 12,
          borderRadius: 14,
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <label className="font-mono block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          Ad-Budget (Periode)
          <input
            type="number"
            min={0}
            value={periodSpend}
            onChange={(e) => setPeriodSpend(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
            }}
          />
        </label>
        <label className="font-mono block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          ROI Invest
          <input
            type="number"
            min={0}
            value={roiInvest}
            onChange={(e) => setRoiInvest(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
            }}
          />
        </label>
        <label className="font-mono block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          ROI Return (geschätzt)
          <input
            type="number"
            min={0}
            value={roiReturn}
            onChange={(e) => setRoiReturn(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
            }}
          />
        </label>
      </div>

      <div
        className="glass-2 overflow-x-auto"
        style={{ borderRadius: 14, border: '1px solid var(--glass-border-1)' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr className="font-mono" style={{ color: 'var(--text-tertiary)', textAlign: 'left' }}>
              {['Titel', 'Format', 'Kanal', 'Impr.', 'Klicks', 'Leads', 'Spend'].map((h) => (
                <th key={h} style={{ padding: '10px 8px', fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ piece }) => (
              <tr key={piece.id} style={{ borderTop: '1px solid var(--glass-border-1)' }}>
                <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{piece.title || '—'}</td>
                <td style={{ padding: '8px' }}>{piece.tags.format}</td>
                <td style={{ padding: '8px' }}>{piece.tags.channel}</td>
                {(['impressions', 'clicks', 'leads', 'spend'] as const).map((field) => (
                  <td key={field} style={{ padding: '4px' }}>
                    <input
                      type="number"
                      min={0}
                      step={field === 'spend' ? 0.01 : 1}
                      value={getMetric(piece.id, field) || ''}
                      onChange={(e) => updatePieceMetric(piece, field, e.target.value)}
                      style={{
                        width: '100%',
                        minWidth: 56,
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: '1px solid var(--glass-border-2)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        className="font-mono"
        style={{
          marginTop: 14,
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.06em',
        }}
      >
        Live-Daten via Meta/Google Ads API — folgt
      </p>
    </div>
  )
}
