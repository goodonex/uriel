import type { LeadQuality } from '../../types/db'
import { nextLeadQuality } from '../../lib/funnelEconomics'

const META: Record<
  LeadQuality,
  { label: string; bg: string; color: string; border: string }
> = {
  unqualified: {
    label: 'Unqual.',
    bg: 'rgba(120,120,140,0.2)',
    color: 'var(--text-tertiary)',
    border: 'rgba(140,140,160,0.35)',
  },
  good: {
    label: 'Gut',
    bg: 'color-mix(in srgb, var(--accent-teal) 18%, transparent)',
    color: 'var(--accent-teal)',
    border: 'color-mix(in srgb, var(--accent-teal) 45%, transparent)',
  },
  bad: {
    label: 'Schlecht',
    bg: 'color-mix(in srgb, var(--accent-coral) 15%, transparent)',
    color: 'var(--accent-coral)',
    border: 'color-mix(in srgb, var(--accent-coral) 45%, transparent)',
  },
}

export function LeadQualityBadge({
  quality,
  onChange,
  size = 'sm',
}: {
  quality: LeadQuality
  onChange: (next: LeadQuality) => void
  size?: 'sm' | 'md'
}) {
  const m = META[quality] ?? META.unqualified
  return (
    <button
      type="button"
      title="Lead-Qualität wechseln"
      className="font-mono"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onChange(nextLeadQuality(quality))
      }}
      style={{
        fontSize: size === 'md' ? 10 : 8,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: size === 'md' ? '4px 8px' : '3px 6px',
        borderRadius: 6,
        border: `1px solid ${m.border}`,
        background: m.bg,
        color: m.color,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {m.label}
    </button>
  )
}
