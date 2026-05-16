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

export function NodePalette({
  onPickType,
}: {
  onPickType: (type: FunnelNodeType) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxWidth: 140,
        pointerEvents: 'auto',
      }}
    >
      {PALETTE.map((t) => (
        <button
          key={t}
          type="button"
          draggable
          onDragStart={(ev) => {
            ev.dataTransfer.setData('application/x-funnel-node', t)
            ev.dataTransfer.effectAllowed = 'copy'
          }}
          onClick={() => onPickType(t)}
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.04em',
            textAlign: 'left',
            padding: '6px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(10,10,20,0.75)',
            backdropFilter: 'blur(12px)',
            color: 'var(--text-secondary)',
            cursor: 'grab',
            whiteSpace: 'nowrap',
          }}
        >
          {nodeTypeEmoji(t)} {nodeTypeLabel(t)}
        </button>
      ))}
    </div>
  )
}

export function paletteDefaultLabel(type: FunnelNodeType): string {
  return defaultLabelForType(type)
}
