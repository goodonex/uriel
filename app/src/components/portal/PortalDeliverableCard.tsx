import {
  DELIVERABLE_STATUS_LABEL,
  type DeliverableItem,
  type DeliverProjectStage,
} from '../../types/db'
import { placeholderHint } from '../../lib/deliverableCatalog'

interface PortalDeliverableCardProps {
  item: DeliverableItem
  clientStage: DeliverProjectStage
  accentColor: string
  dimmed?: boolean
}

export function PortalDeliverableCard({
  item,
  clientStage,
  accentColor,
  dimmed = false,
}: PortalDeliverableCardProps) {
  const ready = item.status === 'fertig'
  const inProgress = item.status === 'in_arbeit'
  const opacity = dimmed ? 0.55 : ready ? 1 : inProgress ? 0.92 : 0.72

  return (
    <div
      className="portal-deliverable-card"
      style={{
        opacity,
        borderColor: ready
          ? `color-mix(in srgb, ${accentColor} 35%, var(--portal-border))`
          : undefined,
      }}
    >
      <div className="portal-deliverable-card__head">
        <h3 className="portal-deliverable-card__title">{item.title}</h3>
        <span
          className={`portal-deliverable-badge portal-deliverable-badge--${item.status}`}
          style={
            ready
              ? { background: `color-mix(in srgb, ${accentColor} 12%, #fff)`, color: accentColor }
              : undefined
          }
        >
          {ready ? '✓ ' : ''}
          {DELIVERABLE_STATUS_LABEL[item.status]}
        </span>
      </div>

      {item.description ? (
        <p className="portal-deliverable-card__desc">{item.description}</p>
      ) : null}

      {item.type === 'website_development' ? (
        <div className="portal-deliverable-progress">
          <div
            className="portal-deliverable-progress__bar"
            style={{
              width: `${item.progress ?? 0}%`,
              background: accentColor,
            }}
          />
        </div>
      ) : null}

      {item.type === 'color_palette' && ready && item.url ? (
        <div className="portal-color-swatches">
          {item.url.split(/[,;\s]+/).filter((c) => /^#?[0-9a-f]{3,8}$/i.test(c)).slice(0, 8).map((c) => {
            const hex = c.startsWith('#') ? c : `#${c}`
            return (
              <span
                key={hex}
                className="portal-color-swatch"
                style={{ background: hex }}
                title={hex}
              />
            )
          })}
        </div>
      ) : null}

      {ready && item.url && item.type !== 'color_palette' ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="portal-deliverable-link"
          style={{ color: accentColor }}
        >
          {item.type === 'website_live_url' ? 'Website öffnen →' : 'Ansehen / Download →'}
        </a>
      ) : null}

      {!ready ? (
        <div className="portal-deliverable-placeholder">
          <span aria-hidden>◇</span>
          {placeholderHint(item.type, clientStage)}
        </div>
      ) : null}

      {ready && item.added_at ? (
        <div className="portal-deliverable-added">
          Hinzugefügt am {new Date(item.added_at).toLocaleDateString('de-DE')}
        </div>
      ) : null}
    </div>
  )
}
