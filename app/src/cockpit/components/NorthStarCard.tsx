import { useMemo } from 'react'
import { computeMrrMetrics } from '../../lib/performanceMetrics'
import type { Contact } from '../../types/db'
import { LIFE_TARGET, formatEuro } from '../lib/goals'

/**
 * Nordstern-Karte (Zielplanung 2026 §5): der MRR-Meilenstein, der das Warum trägt.
 * Zeigt den Weg zu 20 Retainer-Kunden = 10.000 € MRR ("Freundin in Rente").
 * Ist-Stand jetzt ECHT aus dem CRM (IDEAS-2026 H7): aktive Retainer =
 * Kontakte in Stage "deal" mit potenzial_typ "monatlich", nicht verloren.
 */
export function NorthStarCard({ contacts }: { contacts: Contact[] }) {
  const { activeRetainers, currentMrr } = useMemo(
    () => computeMrrMetrics(contacts),
    [contacts],
  )

  // Wenn noch keine monatlichen Deals getaggt sind, zeigt currentMrr 0 — dann
  // den Meilenstein-Fortschritt über die Kundenzahl schätzen (Fallback), damit
  // die Karte nicht leer wirkt, solange potenzial_betrag ungepflegt ist.
  const mrr = currentMrr > 0 ? currentMrr : activeRetainers * LIFE_TARGET.mrrProKunde
  const pct = Math.min(1, mrr / LIFE_TARGET.mrrMeilenstein)
  const reached = activeRetainers >= LIFE_TARGET.retainerKundenZiel

  return (
    <section
      className="ck-panel"
      aria-label="Nordstern — Traumleben & MRR-Meilenstein"
      style={{ padding: '12px 14px', borderColor: 'color-mix(in srgb, var(--ck-accent) 28%, transparent)' }}
    >
      <div className="ck-label" style={{ color: 'var(--ck-accent)' }}>
        ☾ Nordstern · Traumleben
      </div>
      <div style={{ fontSize: 13, color: 'var(--ck-text-3)', margin: '2px 0 10px' }}>
        {formatEuro(LIFE_TARGET.nettoMonat)} netto/Mt · ~{LIFE_TARGET.neukundenProMonat} Neukunden/Mt
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.1 }}>
          {formatEuro(mrr)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>
          / {formatEuro(LIFE_TARGET.mrrMeilenstein)} MRR
        </span>
      </div>

      <div
        style={{
          height: 4,
          background: 'var(--ck-border)',
          borderRadius: 2,
          overflow: 'hidden',
          margin: '8px 0 8px',
        }}
      >
        <div style={{ width: `${pct * 100}%`, height: '100%', background: 'var(--ck-accent)' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: reached ? 'var(--ck-accent)' : 'var(--ck-text-2)' }}>
          {reached
            ? '✓ Freundin kann aufhören'
            : `${activeRetainers} / ${LIFE_TARGET.retainerKundenZiel} Retainer-Kunden`}
        </span>
        <span className="ck-label" style={{ color: 'var(--ck-text-3)' }}>
          aus CRM
        </span>
      </div>
    </section>
  )
}
