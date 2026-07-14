import type { FunnelNodeType } from '../../types/funnel'
import { defaultLabelForType, nodeTypeEmoji, nodeTypeLabel } from './funnelNodeConfig'

const PALETTE: FunnelNodeType[] = [
  'ad',
  'content',
  'landing_page',
  'lead_form',
  'email_sequence',
  'mail_flow',
  'booking_link',
  'retargeting',
  'goal',
]

/** Schwebende Einzel-Bausteine oben links — nicht am unteren Viewport-Rand. */
export function NodePalette({
  onPickType,
}: {
  onPickType: (type: FunnelNodeType) => void
}) {
  return (
    <div
      className="funnel-node-palette"
      onWheel={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 14,
        top: 14,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {PALETTE.map((t) => (
        <button
          key={t}
          type="button"
          title={nodeTypeLabel(t)}
          aria-label={nodeTypeLabel(t)}
          draggable
          onDragStart={(ev) => {
            ev.dataTransfer.setData('application/x-funnel-node', t)
            ev.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => onPickType(t)}
          style={{
            pointerEvents: 'auto',
            width: 42,
            height: 42,
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--glass-border-2) 88%, transparent)',
            background: 'var(--surface-popover)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
            fontSize: 17,
            lineHeight: 1,
            padding: 0,
            display: 'grid',
            placeItems: 'center',
            cursor: 'grab',
            flexShrink: 0,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
        >
          {nodeTypeEmoji(t)}
        </button>
      ))}
    </div>
  )
}

export function paletteDefaultLabel(type: FunnelNodeType): string {
  return defaultLabelForType(type)
}
