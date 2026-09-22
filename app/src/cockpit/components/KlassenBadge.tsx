import type { LeadKlasse } from '../lib/leadKlasse'

/**
 * Das kleine A/B/C neben dem Namen (22.09.2026). Der Grund steht im Tooltip —
 * „Zahlt für Anzeigen, solide Firma, schwache Seite — Google-Ads seit 05/2026 ·
 * GmbH · seit 2008 · Team 6 · Seite schwach". Nur A ist farbig: Das ist der
 * Wunschkunde, nach dem Kevin die Liste überfliegt.
 */
const ERKLAERUNG: Record<LeadKlasse, string> = {
  A: 'Klasse A — zahlt für Anzeigen, solide Firma, schwache Seite',
  B: 'Klasse B — solide Firma oder schon Anzeigen',
  C: 'Klasse C — Einzelkämpfer, neu oder unklar',
}

export function KlassenBadge({ klasse, grund }: { klasse?: LeadKlasse; grund?: string }) {
  if (!klasse) return null
  const text = grund ? `Klasse ${klasse}: ${grund}` : ERKLAERUNG[klasse]
  return (
    <span
      title={text}
      aria-label={text}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 4px',
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
        cursor: 'help',
        border: `1px solid ${klasse === 'A' ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
        color: klasse === 'A' ? 'var(--ck-accent)' : klasse === 'B' ? 'var(--ck-text-2)' : 'var(--ck-text-3)',
        background: klasse === 'A' ? 'var(--ck-accent-dim)' : 'transparent',
      }}
    >
      {klasse}
    </span>
  )
}
