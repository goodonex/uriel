import type { CSSProperties } from 'react'
import {
  areaProgress,
  deliverablesForArea,
  isLeadGenAreaVisible,
  isWebsiteAreaVisible,
} from '../../lib/deliverableCatalog'
import type { DeliverProject, DeliverableArea } from '../../types/db'
import { PortalDeliverableCard } from './PortalDeliverableCard'
import { PortalLeadDashboard } from './PortalLeadDashboard'
import { PortalLeadGenDashboard } from './PortalLeadGenDashboard'

const AREA_META: Record<
  DeliverableArea,
  { icon: string; title: string; lockedHint?: string }
> = {
  branding: { icon: '◆', title: 'Branding' },
  website: {
    icon: '◈',
    title: 'Website',
    lockedHint: 'Startet nach Abschluss des Brandings',
  },
  leadgen: { icon: '📈', title: 'Lead Generation' },
}

interface PortalProgressiveDeliveryProps {
  project: DeliverProject
  accentColor: string
}

function AreaSection({
  area,
  project,
  accentColor,
  locked = false,
  lockedHint,
}: {
  area: DeliverableArea
  project: DeliverProject
  accentColor: string
  locked?: boolean
  lockedHint?: string
}) {
  const meta = AREA_META[area]
  const items = deliverablesForArea(project.deliverables, area)
  const { ready, total } = areaProgress(items)

  return (
    <section
      className={`portal-area${locked ? ' portal-area--locked' : ''}`}
      style={{ '--portal-accent': accentColor } as CSSProperties}
    >
      <header className="portal-area__header">
        <div className="portal-area__icon">{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="portal-area__title">{meta.title}</h2>
          <p className="portal-area__meta">
            {locked
              ? lockedHint ?? meta.lockedHint ?? 'Wird bald freigeschaltet'
              : `${ready} von ${total} Elementen fertig`}
          </p>
          {!locked ? (
            <div className="portal-area__progress">
              <div
                className="portal-area__progress-fill"
                style={{
                  width: total > 0 ? `${(ready / total) * 100}%` : '0%',
                  background: accentColor,
                }}
              />
            </div>
          ) : null}
        </div>
      </header>

      {!locked ? (
        <div className="portal-deliverable-grid">
          {items.map((item) => (
            <PortalDeliverableCard
              key={item.id}
              item={item}
              clientStage={project.client_stage}
              accentColor={accentColor}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function PortalProgressiveDelivery({
  project,
  accentColor,
}: PortalProgressiveDeliveryProps) {
  const websiteVisible = isWebsiteAreaVisible(project.client_stage)
  const leadsVisible = isLeadGenAreaVisible(project.client_stage)

  return (
    <>
      <AreaSection area="branding" project={project} accentColor={accentColor} />

      <AreaSection
        area="website"
        project={project}
        accentColor={accentColor}
        locked={!websiteVisible}
        lockedHint="Startet nach Abschluss des Brandings"
      />

      <PortalLeadGenDashboard
        projectId={project.id}
        accentColor={accentColor}
        stageDurations={project.stage_durations}
        visible={leadsVisible}
      />

      {leadsVisible ? (
        <PortalLeadDashboard projectId={project.id} accentColor={accentColor} variant="crm" />
      ) : (
        <section className="portal-area portal-area--locked">
          <header className="portal-area__header">
            <div className="portal-area__icon">👥</div>
            <div>
              <h2 className="portal-area__title">Ihre Leads</h2>
              <p className="portal-area__meta">
                Startet nach Website-Launch — ca. {project.stage_durations.execute}
              </p>
            </div>
          </header>
        </section>
      )}
    </>
  )
}
