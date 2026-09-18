import { useMemo, useState } from 'react'
import {
  coachAuswertung,
  coachText,
  datumKurz,
  formatWert,
  type Bewertung,
  type CoachEingabe,
  type CoachZeile,
} from '../../lib/coachAuswertung'

/**
 * Die Coach-Auswertung als Tafel (17.09.2026).
 *
 * Eine Tabelle je Block, in der Reihenfolge des Outreach-Tracker-Sheets. Zwei
 * Wertspalten: die Woche und der Vier-Wochen-Wert — der Coach liest Quoten
 * ausdrücklich über mehrere Wochen, eine einzelne Woche springt zu stark.
 *
 * „Kopieren" gibt denselben Stand als Klartext mit, damit Kevin ihn in den
 * Chat mit dem Coach oder ins Sheet legen kann, ohne abzutippen.
 */

/** Wie weit zurück geblättert werden darf: Das Ladefenster der Tageszahlen reicht 45 Tage. */
const MAX_ZURUECK = 2

const FARBE: Record<Exclude<Bewertung, null>, string> = {
  unter: 'var(--ck-warn)',
  im_ziel: 'var(--ck-accent)',
  stark: 'var(--ck-accent)',
}

function Zeile({ z }: { z: CoachZeile }) {
  const quote = z.art === 'quote'
  const farbe = z.bewertung ? FARBE[z.bewertung] : 'var(--ck-text-1)'
  return (
    <tr style={{ borderTop: '1px solid var(--ck-border)' }}>
      <td
        style={{
          padding: '7px 8px 7px 0',
          fontSize: 13,
          color: quote ? 'var(--ck-text-2)' : 'var(--ck-text-1)',
          paddingLeft: quote ? 12 : 0,
        }}
      >
        {z.label}
      </td>
      <td style={{ padding: '7px 8px', fontSize: 14, textAlign: 'right', whiteSpace: 'nowrap', color: quote ? 'var(--ck-text-2)' : 'var(--ck-text-1)', fontWeight: quote ? 400 : 600 }}>
        {formatWert(z.art, z.woche)}
      </td>
      <td style={{ padding: '7px 8px', fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', color: quote ? farbe : 'var(--ck-text-3)' }}>
        {formatWert(z.art, z.schnitt)}
      </td>
      <td style={{ padding: '7px 0 7px 8px', fontSize: 12, textAlign: 'right', color: z.ziel ? (quote ? 'var(--ck-text-3)' : farbe) : 'var(--ck-text-3)' }}>
        {z.ziel?.text ?? ''}
      </td>
    </tr>
  )
}

export function CoachAuswertungTafel({ eingabe }: { eingabe: CoachEingabe }) {
  const [zurueck, setZurueck] = useState(0)
  const [kopiert, setKopiert] = useState(false)
  const auswertung = useMemo(() => coachAuswertung(eingabe, zurueck), [eingabe, zurueck])
  const { woche } = auswertung

  const kopieren = () => {
    void navigator.clipboard
      .writeText(coachText(auswertung))
      .then(() => {
        setKopiert(true)
        setTimeout(() => setKopiert(false), 1800)
      })
      .catch(() => undefined)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ck-btn"
          style={{ minHeight: 40, minWidth: 40 }}
          aria-label="Woche davor"
          disabled={zurueck >= MAX_ZURUECK}
          onClick={() => setZurueck((z) => Math.min(MAX_ZURUECK, z + 1))}
        >
          ‹
        </button>
        <div style={{ fontSize: 14, color: 'var(--ck-text-1)', minWidth: 170, textAlign: 'center' }}>
          KW {woche.kw} · {datumKurz(woche.von)}–{datumKurz(woche.bis)}
        </div>
        <button
          type="button"
          className="ck-btn"
          style={{ minHeight: 40, minWidth: 40 }}
          aria-label="Woche danach"
          disabled={zurueck === 0}
          onClick={() => setZurueck((z) => Math.max(0, z - 1))}
        >
          ›
        </button>
        <button type="button" className="ck-btn" style={{ minHeight: 40, marginLeft: 'auto' }} onClick={kopieren}>
          {kopiert ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ck-text-3)', margin: 0 }}>
        Freitag bis Donnerstag. Die zweite Spalte ist der Wert über vier Wochen (ab {datumKurz(auswertung.schnittVon)}) —
        Zahlen als Wochenschnitt, Quoten über die ganze Spanne. Eingefärbt wird eine Quote am Vier-Wochen-Wert:
        orange unter Ziel, grün im Ziel.
      </p>

      {auswertung.bloecke.map((b) => (
        <section key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="ck-label">{b.titel}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }}>
              <thead>
                <tr style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
                  <th style={{ textAlign: 'left', fontWeight: 400, padding: '2px 0' }} />
                  <th style={{ textAlign: 'right', fontWeight: 400, padding: '2px 8px', width: 64 }}>Woche</th>
                  <th style={{ textAlign: 'right', fontWeight: 400, padding: '2px 8px', width: 72 }}>4 Wochen</th>
                  <th style={{ textAlign: 'right', fontWeight: 400, padding: '2px 0 2px 8px', width: 72 }}>Ziel</th>
                </tr>
              </thead>
              <tbody>
                {b.zeilen.map((z) => (
                  <Zeile key={z.label} z={z} />
                ))}
              </tbody>
            </table>
          </div>
          {b.hinweis ? <p style={{ fontSize: 12, color: 'var(--ck-text-3)', margin: '2px 0 0' }}>{b.hinweis}</p> : null}
        </section>
      ))}
    </div>
  )
}
