import { useMemo } from 'react'
import { usePortalLeads } from '../../hooks/useProjectLeads'
import {
  areaProgress,
  deliverablesForArea,
  isWebsiteAreaVisible,
} from '../../lib/deliverableCatalog'
import { getDeliverableUrl, type PortalTab } from '../../lib/portalNavigation'
import type { DeliverProject } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'
import { PortalFunnelVisual } from './PortalFunnelVisual'

interface PortalCommandCenterProps {
  project: DeliverProject
  accentColor: string
  brandName?: string
  onOpenTab: (tab: PortalTab) => void
}

export function PortalCommandCenter({
  project,
  accentColor,
  brandName,
  onOpenTab,
}: PortalCommandCenterProps) {
  const { leads, loading } = usePortalLeads(project.id)
  const isExecute = project.client_stage === 'execute'
  const liveUrl = getDeliverableUrl(project, 'website_live_url')

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    let thisWeek = 0
    let lastWeek = 0
    const week2Ago = now - 14 * 24 * 60 * 60 * 1000

    for (const l of leads) {
      const t = new Date(l.created_at ?? 0).getTime()
      if (t >= weekAgo) thisWeek++
      else if (t >= week2Ago) lastWeek++
    }

    const trend = thisWeek - lastWeek
    return { total: leads.length, thisWeek, trend }
  }, [leads])

  if (isExecute) {
    return (
      <div className="portal-command">
        <section
          className="portal-command-hero"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 88%, #000) 0%, color-mix(in srgb, ${accentColor} 55%, #111) 100%)`,
          }}
        >
          <div className="portal-command-hero__eyebrow">
            {brandName ? `${brandName} · ` : ''}Lead Command Center
          </div>
          <div className="portal-command-hero__metrics">
            <div>
              <div className="portal-command-hero__value">{loading ? '…' : stats.thisWeek}</div>
              <div className="portal-command-hero__label">Leads diese Woche</div>
            </div>
            <div className="portal-command-hero__divider" />
            <div>
              <div className="portal-command-hero__value portal-command-hero__value--sm">
                {loading ? '…' : stats.total}
              </div>
              <div className="portal-command-hero__label">Gesamt</div>
            </div>
            {!loading && stats.trend !== 0 ? (
              <>
                <div className="portal-command-hero__divider" />
                <div>
                  <div
                    className="portal-command-hero__value portal-command-hero__value--sm"
                    style={{ color: stats.trend > 0 ? '#86efac' : '#fca5a5' }}
                  >
                    {stats.trend > 0 ? '+' : ''}
                    {stats.trend}
                  </div>
                  <div className="portal-command-hero__label">vs. Vorwoche</div>
                </div>
              </>
            ) : null}
          </div>
          <div className="portal-command-hero__actions">
            <button type="button" className="portal-command-hero__btn" onClick={() => onOpenTab('crm')}>
              CRM öffnen
            </button>
            <button
              type="button"
              className="portal-command-hero__btn portal-command-hero__btn--ghost"
              onClick={() => onOpenTab('leads')}
            >
              Performance
            </button>
          </div>
        </section>

        <div className="portal-command-grid">
          <div className="portal-command-panel portal-command-panel--wide">
            <div className="portal-command-panel__head">
              <h3>Dein Funnel</h3>
              <span>Was reinkommt — und woher</span>
            </div>
            <PortalFunnelVisual leads={leads} accentColor={accentColor} />
          </div>

          <div className="portal-command-panel">
            <div className="portal-command-panel__head">
              <h3>Deine Website</h3>
              <span>Lead-Magnet im Einsatz</span>
            </div>
            {liveUrl ? (
              <div className="portal-site-preview">
                <iframe
                  title="Website Vorschau"
                  src={liveUrl}
                  className="portal-site-preview__frame"
                  sandbox="allow-scripts allow-same-origin"
                />
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portal-site-preview__link"
                  style={{ color: accentColor }}
                >
                  Website öffnen ↗
                </a>
              </div>
            ) : (
              <div className="portal-site-preview portal-site-preview--placeholder">
                <div className="portal-site-preview__mock">
                  <div className="portal-site-preview__mock-bar" />
                  <div className="portal-site-preview__mock-block" />
                  <div className="portal-site-preview__mock-block portal-site-preview__mock-block--sm" />
                </div>
                <p>Website geht live — dann siehst du sie hier embedded.</p>
              </div>
            )}
          </div>
        </div>

        {leads.length > 0 ? (
          <div className="portal-command-panel">
            <div className="portal-command-panel__head">
              <h3>Neueste Leads</h3>
              <button
                type="button"
                className="portal-command-panel__link"
                style={{ color: accentColor }}
                onClick={() => onOpenTab('crm')}
              >
                Alle anzeigen →
              </button>
            </div>
            <div className="portal-recent-leads">
              {leads.slice(0, 5).map((l) => (
                <div key={l.id} className="portal-recent-leads__row">
                  <div>
                    <div className="portal-recent-leads__name">{l.name || 'Unbekannt'}</div>
                    <div className="portal-recent-leads__meta">
                      {[l.email, l.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <div className="portal-recent-leads__date">
                    {l.created_at
                      ? new Date(l.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="portal-command portal-command--phase">
      <section className="portal-phase-hero">
        <div className="portal-phase-hero__badge" style={{ color: accentColor, borderColor: accentColor }}>
          Aktuelle Phase
        </div>
        <h2 className="portal-phase-hero__title">{DELIVER_STAGE_LABEL[project.client_stage]}</h2>
        <p className="portal-phase-hero__text">
          {project.client_welcome_text ||
            'Wir arbeiten an deinem Projekt. Unten findest du alles zu deiner aktuellen Phase.'}
        </p>
      </section>

      <div className="portal-phase-cards">
        {(() => {
          const branding = deliverablesForArea(project.deliverables, 'branding')
          const bProgress = areaProgress(branding)
          return (
            <button
              type="button"
              className="portal-phase-card"
              onClick={() => onOpenTab('branding')}
            >
              <span className="portal-phase-card__icon">◆</span>
              <span className="portal-phase-card__label">Branding</span>
              <span className="portal-phase-card__stat">
                {bProgress.ready}/{bProgress.total} fertig
              </span>
            </button>
          )
        })()}
        {isWebsiteAreaVisible(project.client_stage) ? (
          <button
            type="button"
            className="portal-phase-card"
            onClick={() => onOpenTab('website')}
          >
            <span className="portal-phase-card__icon">◈</span>
            <span className="portal-phase-card__label">Website</span>
            <span className="portal-phase-card__stat">
              {getDeliverableUrl(project, 'website_live_url') ? 'Live' : 'In Arbeit'}
            </span>
          </button>
        ) : (
          <div className="portal-phase-card portal-phase-card--locked">
            <span className="portal-phase-card__icon">◈</span>
            <span className="portal-phase-card__label">Website</span>
            <span className="portal-phase-card__stat">Nach Branding</span>
          </div>
        )}
      </div>
    </div>
  )
}
