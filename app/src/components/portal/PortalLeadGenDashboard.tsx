import { useMemo } from 'react'
import { usePortalLeads } from '../../hooks/useProjectLeads'
import type { DeliverStageDurations } from '../../types/db'

interface PortalLeadGenDashboardProps {
  projectId: string
  accentColor: string
  stageDurations: DeliverStageDurations
  visible: boolean
  embedded?: boolean
}

export function PortalLeadGenDashboard({
  projectId,
  accentColor,
  stageDurations,
  visible,
  embedded = false,
}: PortalLeadGenDashboardProps) {
  const { leads, loading } = usePortalLeads(projectId)

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    let thisWeek = 0
    const daily: number[] = Array.from({ length: 30 }, () => 0)

    for (const l of leads) {
      const t = new Date(l.created_at ?? 0).getTime()
      if (t >= weekAgo) thisWeek++
      if (t >= monthAgo) {
        const dayIdx = Math.min(29, Math.floor((now - t) / (24 * 60 * 60 * 1000)))
        daily[29 - dayIdx] += 1
      }
    }

    const maxDaily = Math.max(1, ...daily)
    return { total: leads.length, thisWeek, daily, maxDaily }
  }, [leads])

  const executeEta = stageDurations.execute || 'Phase 5'

  if (!visible && !embedded) {
    return (
      <section className="portal-area portal-area--locked">
        <header className="portal-area__header">
          <div className="portal-area__icon">📈</div>
          <div>
            <h2 className="portal-area__title">Lead Generation</h2>
            <p className="portal-area__meta">
              Startet nach Website-Launch — ca. {executeEta}
            </p>
          </div>
        </header>
      </section>
    )
  }

  const content = (
    <div className={`portal-card${embedded ? ' portal-card--flat' : ''}`} style={{ marginBottom: embedded ? 0 : undefined }}>
        <div className="portal-stats portal-stats--4">
          <div className="portal-stat">
            <div className="portal-stat-value" style={{ color: accentColor }}>
              {loading ? '…' : stats.thisWeek}
            </div>
            <div className="portal-stat-label">Leads diese Woche</div>
          </div>
          <div className="portal-stat">
            <div className="portal-stat-value">{loading ? '…' : stats.total}</div>
            <div className="portal-stat-label">Leads gesamt</div>
          </div>
          <div className="portal-stat">
            <div className="portal-stat-value">—</div>
            <div className="portal-stat-label">Kosten / Lead</div>
          </div>
          <div className="portal-stat">
            <div className="portal-stat-value">—</div>
            <div className="portal-stat-label">Conversion</div>
          </div>
        </div>

        <div className="portal-mini-chart">
          <div className="portal-mini-chart__label">Lead-Verlauf · 30 Tage</div>
          <div className="portal-mini-chart__bars">
            {stats.daily.map((v, i) => (
              <div
                key={i}
                className="portal-mini-chart__bar"
                style={{
                  height: `${Math.max(4, (v / stats.maxDaily) * 100)}%`,
                  background:
                    v > 0
                      ? accentColor
                      : 'color-mix(in srgb, var(--portal-border) 80%, transparent)',
                }}
                title={`${v} Leads`}
              />
            ))}
          </div>
        </div>

        <div className="portal-leadgen-campaigns">
          <div className="portal-leadgen-campaigns__title">Aktive Kampagnen</div>
          <div className="portal-leadgen-campaign-row portal-leadgen-campaign-row--placeholder">
            <span>Kampagne 1</span>
            <span>Vorbereitung</span>
            <span>—</span>
          </div>
          <div className="portal-leadgen-campaign-row portal-leadgen-campaign-row--placeholder">
            <span>Kampagne 2</span>
            <span>Geplant</span>
            <span>—</span>
          </div>
        </div>
      </div>
  )

  if (embedded) {
    return (
      <div className="portal-area-view">
        <header className="portal-area-view__head">
          <div>
            <h2 className="portal-area-view__title">Lead Generation</h2>
            <p className="portal-area-view__meta">Kampagnen-Performance & Verlauf</p>
          </div>
        </header>
        {content}
      </div>
    )
  }

  return (
    <section className="portal-area">
      <header className="portal-area__header">
        <div className="portal-area__icon">📈</div>
        <div style={{ flex: 1 }}>
          <h2 className="portal-area__title">Lead Generation</h2>
          <p className="portal-area__meta">Kampagnen-Performance auf einen Blick</p>
        </div>
      </header>
      {content}
    </section>
  )
}
