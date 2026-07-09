import { formatEuro } from '../lib/goals'
import type { FunnelKpis } from '../lib/metricsAggregate'

/**
 * Coach-KPIs (Agentur Inkubator): Funnel-Conversions gegen die Zielquoten +
 * „Wert pro Aktion" (€ je Loom / je Erstnachricht). Quoten über den laufenden
 * Monat — bewusst über mehrere Wochen gelesen, nicht je Einzelwoche.
 */
function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`
}

const STATE_COLOR: Record<'great' | 'ok' | 'low', string> = {
  great: 'var(--ck-accent)',
  ok: 'var(--ck-text-1)',
  low: 'var(--ck-warn)',
}

export function ConversionPanel({ kpis }: { kpis: FunnelKpis }) {
  return (
    <section className="ck-panel" aria-label="Funnel-Conversions und Wert pro Aktion">
      <div className="ck-label" style={{ padding: '10px 12px 4px' }}>
        Funnel · Conversion (Monat)
      </div>

      {kpis.conv.map((k) => {
        const color = k.state ? STATE_COLOR[k.state] : 'var(--ck-text-3)'
        return (
          <div
            key={k.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 12px',
              borderBottom: '1px solid var(--ck-border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="ck-label">{k.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color }}>
                {pct(k.rate)}
                <span style={{ color: 'var(--ck-text-3)', fontWeight: 400, fontSize: 11 }}>
                  {' '}
                  Ziel {pct(k.min)}+
                </span>
              </span>
            </div>
            {/* Zielband-Balken: min → great, Marker = Ist */}
            <div
              style={{
                position: 'relative',
                height: 4,
                background: 'var(--ck-border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${k.min * 100}%`,
                  width: `${Math.max(0, (k.great - k.min) * 100)}%`,
                  height: '100%',
                  background: 'var(--ck-accent-dim, rgba(52,211,153,0.25))',
                }}
              />
              {k.rate != null ? (
                <div
                  style={{
                    position: 'absolute',
                    left: `${Math.min(100, k.rate * 100)}%`,
                    top: -2,
                    width: 2,
                    height: 8,
                    background: color,
                  }}
                />
              ) : null}
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, padding: '10px 12px' }}>
        <div style={{ flex: 1 }}>
          <div className="ck-label">€ / Loom</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-accent)' }}>
            {kpis.perLoom != null ? formatEuro(kpis.perLoom) : '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="ck-label">€ / Nachricht</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-accent)' }}>
            {kpis.perNachricht != null ? formatEuro(kpis.perNachricht) : '—'}
          </div>
        </div>
      </div>
    </section>
  )
}
