import { useCallback, useEffect, useState } from 'react'
import {
  formatMetricEuro,
  formatMetricRatio,
  type FunnelEconomics,
} from '../../lib/funnelEconomics'
import { useSwarmPrediction, type SwarmPredictionRow } from '../../hooks/useSwarmPrediction'
import type { FunnelEdgeRow, FunnelNodeRow } from '../../types/funnel'
import type { SwarmPredictionResult } from '../../types/swarm'

function parseConversionBand(band: string): { low: number; high: number } | null {
  const m = band.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*%/)
  if (!m) return null
  const low = parseFloat(m[1].replace(',', '.'))
  const high = parseFloat(m[2].replace(',', '.'))
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null
  return { low, high }
}

function deviationText(
  prediction: SwarmPredictionResult,
  economics: FunnelEconomics,
  calibrated: boolean,
): string | null {
  if (!calibrated) return null
  if (economics.totalLeads === 0) return null
  const actualRate = economics.goodLeadRate
  if (actualRate == null) return null
  const band = parseConversionBand(prediction.quantitative.expectedConversionBand)
  if (!band) {
    return economics.goodLeads > 0
      ? 'Ist-Daten vorhanden — Conversion-Band der Prognose nicht vergleichbar.'
      : null
  }
  const mid = (band.low + band.high) / 2 / 100
  if (actualRate > mid * 1.15) return 'Conversion lag über Prognose.'
  if (actualRate < mid * 0.85) return 'Conversion lag unter Prognose.'
  return 'Conversion lag in der Prognose-Spanne.'
}

export function FunnelForecastCard({
  slug,
  funnelId,
  funnelNodes,
  funnelEdges,
  economics,
  onPredictionLoaded,
}: {
  slug: string
  funnelId: string
  funnelNodes: FunnelNodeRow[]
  funnelEdges: FunnelEdgeRow[]
  economics: FunnelEconomics
  onPredictionLoaded?: (row: SwarmPredictionRow | null) => void
}) {
  const swarm = useSwarmPrediction(slug)
  const [predictionRow, setPredictionRow] = useState<SwarmPredictionRow | null>(null)

  const loadStored = useCallback(async () => {
    const row = await swarm.loadFunnelPrediction(funnelId)
    setPredictionRow(row)
    onPredictionLoaded?.(row)
  }, [funnelId, onPredictionLoaded, swarm])

  useEffect(() => {
    void loadStored()
  }, [loadStored])

  const runForecast = async () => {
    const row = await swarm.runFunnelSwarm(funnelId, funnelNodes, funnelEdges)
    setPredictionRow(row)
    onPredictionLoaded?.(row)
    if (row && economics.totalLeads > 0 && economics.goodLeads > 0) {
      await swarm.recordActualOutcome(row.id, {
        cpgl: economics.cpgl,
        goodLeads: economics.goodLeads,
        totalLeads: economics.totalLeads,
        goodLeadRate: economics.goodLeadRate,
        funnelValue: economics.funnelValue,
      })
    }
  }

  const prediction = predictionRow?.prediction ?? null
  const calibrated = Boolean(predictionRow?.actual_outcome)
  const hasIstData =
    economics.totalLeads > 0 || economics.totalSpend > 0
  const deviation =
    prediction && hasIstData
      ? deviationText(prediction, economics, calibrated)
      : null

  const quant = prediction?.quantitative
  const qual = prediction?.qualitative

  return (
    <div
      style={{
        margin: '0 8px 10px',
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--glass-border-2)',
        background: 'var(--surface-popover)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
          PROGNOSE VS. IST
        </span>
        <button
          type="button"
          className="font-mono"
          onClick={() => void runForecast()}
          disabled={swarm.loading}
          style={{
            fontSize: 9,
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-2)',
            color: 'var(--text-secondary)',
            cursor: swarm.loading ? 'wait' : 'pointer',
          }}
        >
          {prediction ? 'Neu simulieren' : 'Funnel-Prognose erstellen'}
        </button>
      </div>

      {swarm.loading ? (
        <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
          Schwarm simuliert Reaktionen…
        </p>
      ) : swarm.error ? (
        <p style={{ fontSize: 11, color: 'var(--accent-coral)' }}>{swarm.error}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="font-mono" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--accent-blue)', marginBottom: 6 }}>
              PROGNOSE
            </div>
            {!prediction ? (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                Noch keine Prognose — unkalibriert bis Ist-Daten da sind.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 11, margin: '0 0 4px' }}>
                  Engagement: <strong>{quant?.expectedEngagementRate}</strong>
                </p>
                <p style={{ fontSize: 11, margin: '0 0 8px' }}>
                  Conversion: <strong>{quant?.expectedConversionBand}</strong>
                </p>
                <p style={{ fontSize: 11, color: 'var(--accent-coral)', margin: '0 0 8px' }}>
                  {qual?.biggestRisk}
                </p>
                <p
                  style={{
                    fontSize: 9,
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic',
                    margin: 0,
                    lineHeight: 1.35,
                  }}
                >
                  {quant?.confidenceNote}
                </p>
                {!calibrated ? (
                  <p style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 0 }}>
                    Unkalibriert — kein Ist-Abgleich gespeichert.
                  </p>
                ) : null}
              </>
            )}
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--accent-teal)', marginBottom: 6 }}>
              IST
            </div>
            {!hasIstData ? (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.4 }}>
                Noch keine Ist-Daten — läuft der erste Funnel-Durchlauf, erscheint hier der Vergleich.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  {formatMetricEuro(economics.cpgl)}
                </p>
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', margin: '0 0 6px' }}>
                  CPGL
                </p>
                <p style={{ fontSize: 11, margin: '0 0 4px' }}>
                  Gute Leads: <strong>{formatMetricRatio(economics.goodLeads, economics.totalLeads)}</strong>
                </p>
                <p style={{ fontSize: 11, margin: '0 0 8px' }}>
                  Funnel-Wert: <strong>{formatMetricEuro(economics.funnelValue > 0 ? economics.funnelValue : null)}</strong>
                </p>
                {deviation ? (
                  <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: 0 }}>{deviation}</p>
                ) : prediction && !calibrated ? (
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>
                    Prognose steht — Abweichung nach Kalibrierung.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
