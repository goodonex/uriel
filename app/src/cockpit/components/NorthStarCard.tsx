import { useState } from 'react'
import { LIFE_TARGET, RETAINER_KUNDEN_KEY, formatEuro } from '../lib/goals'

/**
 * Nordstern-Karte (Zielplanung 2026 §5): der MRR-Meilenstein, der das Warum trägt.
 * Zeigt den Weg zu 20 Retainer-Kunden = 10.000 € MRR ("Freundin in Rente").
 * Ist-Stand der aktiven Retainer-Kunden wird v1 manuell gepflegt (localStorage) —
 * später an echte CRM-/Deliver-Daten hängen.
 */
export function NorthStarCard() {
  const [kunden, setKunden] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(RETAINER_KUNDEN_KEY)) || 0
    } catch {
      return 0
    }
  })

  const save = (next: number) => {
    const v = Math.max(0, next)
    setKunden(v)
    try {
      localStorage.setItem(RETAINER_KUNDEN_KEY, String(v))
    } catch {
      /* ohne localStorage nur für diese Session */
    }
  }

  const mrr = kunden * LIFE_TARGET.mrrProKunde
  const pct = Math.min(1, mrr / LIFE_TARGET.mrrMeilenstein)
  const reached = kunden >= LIFE_TARGET.retainerKundenZiel

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
            : `${kunden} / ${LIFE_TARGET.retainerKundenZiel} Retainer-Kunden`}
        </span>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button
            className="ck-btn"
            onClick={() => save(kunden - 1)}
            aria-label="Ein Retainer-Kunde weniger"
            style={{ fontSize: 13, padding: '2px 9px', lineHeight: 1 }}
          >
            −
          </button>
          <button
            className="ck-btn"
            onClick={() => save(kunden + 1)}
            aria-label="Ein Retainer-Kunde mehr"
            style={{ fontSize: 13, padding: '2px 9px', lineHeight: 1 }}
          >
            +
          </button>
        </span>
      </div>
    </section>
  )
}
