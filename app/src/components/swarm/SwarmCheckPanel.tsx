import { useEffect, useState } from 'react'
import { useSwarmPrediction } from '../../hooks/useSwarmPrediction'
import type { SwarmPredictionResult } from '../../types/swarm'

const PANEL_W = 380

export function SwarmCheckPanel({
  slug,
  open,
  onClose,
  content,
  contentType,
}: {
  slug: string
  open: boolean
  onClose: () => void
  content: string
  contentType: string
}) {
  const swarm = useSwarmPrediction(slug)
  const [result, setResult] = useState<SwarmPredictionResult | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setResult(null)
    setExpanded({})
    if (!content.trim()) return
    void (async () => {
      const row = await swarm.runContentSwarm(content, contentType)
      if (row) setResult(row.prediction)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content, contentType])

  if (!open) return null

  const q = result?.qualitative
  const quant = result?.quantitative

  return (
    <>
      <style>{`@keyframes swarm-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }`}</style>
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_W,
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10,10,22,0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
        }}
      >
        <header
          style={{
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
            Schwarm-Check
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px 24px' }}>
          {swarm.loading ? (
            <p
              className="font-mono"
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                animation: 'swarm-pulse 1.4s ease-in-out infinite',
              }}
            >
              Schwarm simuliert Reaktionen…
            </p>
          ) : swarm.error ? (
            <p style={{ fontSize: 12, color: 'var(--accent-coral)' }}>{swarm.error}</p>
          ) : !content.trim() ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Kein Inhalt zum Prüfen.</p>
          ) : q ? (
            <>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-secondary)',
                  margin: '0 0 12px',
                }}
              >
                {q.summary}
              </p>
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: 'color-mix(in srgb, var(--accent-coral) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-coral) 35%, transparent)',
                  marginBottom: 10,
                  fontSize: 12,
                  color: 'var(--accent-coral)',
                }}
              >
                <strong>Risiko:</strong> {q.biggestRisk}
              </div>
              <div
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-teal) 35%, transparent)',
                  marginBottom: 16,
                  fontSize: 12,
                  color: 'var(--accent-teal)',
                }}
              >
                <strong>Stärkste:</strong> {q.strongestElement}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {q.perIcp.map((icp) => {
                  const openRow = expanded[icp.icpName]
                  return (
                    <div
                      key={icp.icpName}
                      style={{
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        overflow: 'hidden',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((m) => ({ ...m, [icp.icpName]: !m[icp.icpName] }))
                        }
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: icp.wouldAct ? 'var(--accent-teal)' : 'var(--accent-coral)',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            flex: 1,
                          }}
                        >
                          {icp.icpName}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {openRow ? '▲' : '▼'}
                        </span>
                      </button>
                      {openRow ? (
                        <div
                          style={{
                            padding: '0 12px 12px',
                            fontSize: 11,
                            lineHeight: 1.45,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <p>
                            <strong>Erste Reaktion:</strong> {icp.firstReaction}
                          </p>
                          <p>
                            <strong>Was zieht:</strong> {icp.whatResonates}
                          </p>
                          <p>
                            <strong>Was prallt ab:</strong> {icp.whatBounces}
                          </p>
                          <p style={{ marginBottom: 0 }}>
                            <strong>Haupteinwand:</strong> {icp.mainObjection}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {quant ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      color: 'var(--text-tertiary)',
                      marginBottom: 8,
                    }}
                  >
                    QUANTITATIV (SCHÄTZUNG)
                  </div>
                  <p style={{ fontSize: 12, margin: '0 0 6px' }}>
                    Engagement: <strong>{quant.expectedEngagementRate}</strong>
                  </p>
                  <p style={{ fontSize: 12, margin: '0 0 10px' }}>
                    Conversion-Band: <strong>{quant.expectedConversionBand}</strong>
                  </p>
                  <p
                    style={{
                      fontSize: 10,
                      lineHeight: 1.4,
                      color: 'var(--text-tertiary)',
                      margin: 0,
                      fontStyle: 'italic',
                    }}
                  >
                    {quant.confidenceNote}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
