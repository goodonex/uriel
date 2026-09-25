import { useCallback, useEffect, useState } from 'react'
import {
  MIN_ANTEIL_HOCHRECHNUNG,
  alterText,
  fetchNutzung,
  planRechnung,
  tokenText,
  usdText,
  type NutzungsStand,
  type NutzungsZeile,
} from '../lib/auftraegeApi'

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
  // Balken nach Dollar — dieselbe Größe, nach der die Liste sortiert ist.
  const max = Math.max(1, ...stand.zeilen.map(summeUsd))
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

      <PlanBlock stand={stand} />

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
          <div key={art} style={{ width: `${(z[art].usd / max) * 100}%`, background: FARBE[art] }} />
        ))}
      </div>
      <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 4 }}>
        {beschreibung}
      </div>
    </div>
  )
}

const RESET = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const UHR = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const DOLLAR = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const dollar = (n: number | null) => (n == null ? '–' : `${DOLLAR.format(n)} $`)

/**
 * Was der Max-Plan hergibt (25.09.2026). Die Prozente kommen von Anthropic,
 * die Dollar sind hochgerechnet: Verbrauch seit Wochenstart ÷ Wochenanteil.
 */
function PlanBlock({ stand }: { stand: NutzungsStand }) {
  const r = planRechnung(stand)
  if (r.wocheAnteil == null) {
    return (
      <div className="ck-panel" style={{ padding: '11px 13px', marginBottom: 10, fontSize: 12.5, color: 'var(--ck-text-2)' }}>
        Max-Plan: noch keine Messung. Sie kommt mit dem nächsten Lauf auf dem Mini.
      </div>
    )
  }
  const woche = Math.round(r.wocheAnteil * 100)
  const fuenf = r.fuenfAnteil != null ? Math.round(r.fuenfAnteil * 100) : null
  const monatAnteil = r.monatKapazitaetUsd ? Math.round((r.monatGenutztUsd / r.monatKapazitaetUsd) * 100) : null
  return (
    <div className="ck-panel" style={{ padding: '14px 15px', marginBottom: 10 }}>
      <div className="ck-label" style={{ marginBottom: 10 }}>Max-Plan · was zur Verfügung steht</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px 22px' }}>
        <Fenster
          titel="Diese Woche"
          anteil={r.wocheAnteil}
          gross={r.wocheKapazitaetUsd != null ? `${dollar(r.wocheVerbrauchtUsd)} von ≈ ${dollar(r.wocheKapazitaetUsd)}` : `${woche} % verbraucht`}
          klein={`${woche} % · frei ≈ ${r.wocheKapazitaetUsd != null ? dollar(r.wocheKapazitaetUsd - (r.wocheVerbrauchtUsd ?? 0)) : '–'} · neu ab ${r.wocheReset ? RESET.format(new Date(r.wocheReset)) : '–'}`}
        />
        <Fenster
          titel="30 Tage"
          anteil={monatAnteil != null ? monatAnteil / 100 : null}
          gross={r.monatKapazitaetUsd != null ? `${dollar(r.monatGenutztUsd)} von ≈ ${dollar(r.monatKapazitaetUsd)}` : `${dollar(r.monatGenutztUsd)} genutzt`}
          klein={monatAnteil != null ? `≈ ${monatAnteil} % des Möglichen ausgeschöpft` : 'Hochrechnung folgt'}
        />
        {fuenf != null ? (
          <Fenster
            titel="5-Stunden-Fenster"
            anteil={r.fuenfAnteil}
            gross={`${fuenf} % verbraucht`}
            klein={`neu ab ${r.fuenfReset ? UHR.format(new Date(r.fuenfReset)) : '–'} Uhr`}
          />
        ) : null}
      </div>
      <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 12, lineHeight: 1.5 }}>
        Die Prozente meldet Anthropic, eine Dollar-Grenze nennt es nicht. Die Dollar sind hochgerechnet: Verbrauch
        seit Wochenstart geteilt durch den Wochenanteil, zum API-Listenpreis.
        {r.wocheKapazitaetUsd == null
          ? ` Die Hochrechnung startet ab ${Math.round(MIN_ANTEIL_HOCHRECHNUNG * 100)} % Wochenverbrauch — darunter wäre sie Raten.`
          : ' Früh in der Woche ist sie grob, sie wird mit jedem Tag genauer.'}
      </div>
    </div>
  )
}

function Fenster({ titel, anteil, gross, klein }: { titel: string; anteil: number | null; gross: string; klein: string }) {
  const voll = anteil != null && anteil >= 0.8
  return (
    <div style={{ minWidth: 0 }}>
      <div className="ck-label">{titel}</div>
      <div style={{ fontSize: 17, fontWeight: 600, marginTop: 3 }}>{gross}</div>
      {anteil != null ? (
        <div aria-hidden style={{ marginTop: 6, height: 6, borderRadius: 99, background: 'var(--ck-border)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, Math.round(anteil * 100))}%`, height: '100%', background: voll ? 'var(--ck-warn)' : 'var(--ck-accent)' }} />
        </div>
      ) : null}
      <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 5 }}>
        {klein}
      </div>
    </div>
  )
}
