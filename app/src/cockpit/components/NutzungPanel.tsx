import { useCallback, useEffect, useState } from 'react'
import { alterText, fetchNutzung, tokenText, usdText, type NutzungsStand, type NutzungsZeile } from '../lib/auftraegeApi'

/**
 * Nutzung der letzten 30 Tage (25.09.2026): wofür die Tokens draufgegangen
 * sind — je Programm getrennt nach **Bauen** (Kevins Sitzungen im Programm,
 * Mini-Aufträge) und **Betrieb** (was das Programm über seine Routinen selbst
 * verbraucht). Darunter die Arbeit ohne Programm: Vault, Kundenordner.
 *
 * Gerechnet wird je Rechner aus den Sitzungsprotokollen
 * (`runner/tokenBuch.mjs`), hier nur zusammengezählt. Die Dollarwerte sind
 * Listenpreise — was dieselben Tokens über die API kosten würden.
 */

const FARBE = {
  bauen: 'var(--ck-accent)',
  betrieb: 'var(--ck-text-2)',
  arbeit: 'var(--ck-idle)',
} as const

const summe = (z: NutzungsZeile) => z.bauen.tokens + z.betrieb.tokens + z.arbeit.tokens
const summeUsd = (z: NutzungsZeile) => z.bauen.usd + z.betrieb.usd + z.arbeit.usd

/** `vorgabe`: fester Stand ohne Abruf — nur für die Dev-Vorschau. */
export function NutzungPanel({ vorgabe }: { vorgabe?: NutzungsStand } = {}) {
  const [stand, setStand] = useState<NutzungsStand | null>(vorgabe ?? null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [jetzt, setJetzt] = useState(() => Date.now())

  const laden = useCallback(async () => {
    try {
      setStand(await fetchNutzung())
      setJetzt(Date.now())
      setFehler(null)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (vorgabe) return
    void laden()
    const t = window.setInterval(() => void laden(), 120_000)
    return () => window.clearInterval(t)
  }, [laden, vorgabe])

  if (!stand) {
    return fehler ? (
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Nutzung · letzte 30 Tage</h2>
        <div className="ck-panel" style={{ padding: '11px 13px', fontSize: 12.5, color: 'var(--ck-text-2)' }}>{fehler}</div>
      </section>
    ) : null
  }

  const programme = stand.zeilen.filter((z) => z.programm)
  const sonst = stand.zeilen.filter((z) => !z.programm)
  const gesamt = (art: 'bauen' | 'betrieb' | 'arbeit') =>
    stand.zeilen.reduce((n, z) => ({ tokens: n.tokens + z[art].tokens, usd: n.usd + z[art].usd }), { tokens: 0, usd: 0 })
  const max = Math.max(1, ...stand.zeilen.map(summe))
  const ohneLaptop = stand.rechner.length < 2

  return (
    <section aria-labelledby="nutzung-titel" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 id="nutzung-titel" style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          Nutzung · letzte 30 Tage
        </h2>
        <span className="ck-label">
          {stand.rechner.map((r) => `${r.name} vor ${alterText(r.stand, jetzt)}`).join(' · ') || 'noch keine Meldung'}
        </span>
      </div>

      <div className="ck-panel" style={{ padding: '14px 15px' }}>
        {/* Drei Summen: wofür insgesamt */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 16 }}>
          <Summe titel="Bauen" farbe={FARBE.bauen} wert={gesamt('bauen')} erklaerung="Programme entstehen und wachsen" />
          <Summe titel="Betrieb" farbe={FARBE.betrieb} wert={gesamt('betrieb')} erklaerung="Routinen der Programme, von selbst" />
          <Summe titel="Arbeit ohne Programm" farbe={FARBE.arbeit} wert={gesamt('arbeit')} erklaerung="Vault, Kundenordner, Einzelfragen" />
        </div>

        <div className="ck-label" style={{ marginBottom: 6 }}>Je Programm</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {programme.map((z) => (
            <Zeile key={z.projekt} zeile={z} max={max} />
          ))}
        </div>

        {sonst.length ? (
          <>
            <div className="ck-label" style={{ margin: '14px 0 6px' }}>Arbeit ohne Programm</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sonst.map((z) => (
                <Zeile key={z.projekt} zeile={z} max={max} />
              ))}
            </div>
          </>
        ) : null}

        <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 12, lineHeight: 1.5 }}>
          Tokens inklusive Cache-Lesen · Dollar zum Listenpreis.
          {ohneLaptop ? ' Bisher meldet nur ein Rechner — die Sitzungen vom anderen fehlen noch.' : ''}
        </div>
      </div>
    </section>
  )
}

function Summe({ titel, farbe, wert, erklaerung }: { titel: string; farbe: string; wert: { tokens: number; usd: number }; erklaerung: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: farbe }} />
        <span className="ck-label">{titel}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 3 }}>{usdText(wert.usd) || '0 $'}</div>
      <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
        {tokenText(wert.tokens)} Tokens · {erklaerung}
      </div>
    </div>
  )
}

function Zeile({ zeile: z, max }: { zeile: NutzungsZeile; max: number }) {
  const teile = (['bauen', 'betrieb', 'arbeit'] as const).filter((art) => z[art].tokens > 0)
  const beschreibung = teile
    .map((art) => `${art === 'bauen' ? 'Bauen' : art === 'betrieb' ? 'Betrieb' : 'Arbeit'} ${tokenText(z[art].tokens)} (${usdText(z[art].usd)})`)
    .join(' · ')
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--ck-border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {z.projekt}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, whiteSpace: 'nowrap' }}>{usdText(summeUsd(z))}</span>
        <span className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, whiteSpace: 'nowrap', minWidth: 72, textAlign: 'right' }}>
          {tokenText(summe(z))}
        </span>
      </div>
      <div
        role="img"
        aria-label={beschreibung}
        title={beschreibung}
        style={{ display: 'flex', height: 6, marginTop: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--ck-border)' }}
      >
        {teile.map((art) => (
          <div key={art} style={{ width: `${(z[art].tokens / max) * 100}%`, background: FARBE[art] }} />
        ))}
      </div>
      <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 4 }}>
        {beschreibung}
      </div>
    </div>
  )
}
