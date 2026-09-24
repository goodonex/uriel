import { useMemo, useState } from 'react'
import { funnelPhasen, phasenSumme, type Phase, type PhasenId } from '../../lib/funnelPhasen'
import type { FunnelKarte } from '../../lib/funnelKarten'

/**
 * Der Phasen-Ring (20.09.2026, Kevins Auftrag: „ein Kreisdiagramm, wo ich
 * einfach sehe, wie viele Leute wo in welcher Stage sind").
 *
 * **Er zeigt, er rechnet nicht.** Die Zahlen kommen als fertige Karten herein
 * und werden in `lib/funnelPhasen.ts` nur summiert. Der Ring ist damit eine
 * zweite Ansicht derselben Wahrheit, keine zweite Wahrheit — die Summe der
 * Stücke ist buchstäblich der Bestand des Funnels.
 *
 * **Die Aussortierten sind kein Tortenstück.** Bei 1.788 Leads im Kosmos
 * stecken die meisten nicht in der Zielgruppe; als Segment wäre der Ring zu
 * zwei Dritteln grau und die Stufen, an denen gearbeitet wird, wären Splitter.
 * Sie stehen deshalb als Zeile unter dem Ring — dieselbe Behandlung wie im
 * `FunnelCanvas` und aus demselben Grund (die Lehre vom 19.08.: sichtbar
 * lassen, damit ein Filterfehler auffällt, aber nicht zwischen die Arbeit
 * mischen). Die Zeile nennt beide Zahlen, die Rechnung geht auf.
 *
 * **Eine Farbe, sechs Stufen.** Die Phasen sind geordnet, nicht verschieden —
 * sie verdienen keine sechs Farben, sondern eine Salbei-Rampe, die Richtung
 * „Kunde" heller wird. Die Stufen sind mit dem Palette-Validator geprüft
 * (ordinal, dunkle Fläche): monotone Helligkeit, sichtbare Abstände, eine Hue.
 * Weil Nachbarstufen sich ähneln, trägt **jede Zeile ihre Zahl im Text** —
 * die Farbe ist die Zugabe, nicht die Information.
 */

const GROESSE = 168
const DICKE = 20
const RADIUS = (GROESSE - DICKE) / 2
const UMFANG = 2 * Math.PI * RADIUS
/** Die 2-px-Fuge zwischen zwei Stücken — sonst verschwimmen Nachbarstufen. */
const FUGE = 2

export interface PhasenRingProps {
  karten: FunnelKarte[]
  /** Klick auf eine Karte in einer aufgeklappten Phase. */
  onKarteOeffnen?: (karte: FunnelKarte) => void
  /** Welche Karte sich öffnen lässt. Ohne Angabe: alles mit Bestand. */
  oeffenbar?: (karte: FunnelKarte) => boolean
}

interface Stueck {
  phase: Phase
  laenge: number
  versatz: number
}

export function PhasenRing({ karten, onKarteOeffnen, oeffenbar }: PhasenRingProps) {
  const [offen, setOffen] = useState<PhasenId | null>(null)
  const [betont, setBetont] = useState<PhasenId | null>(null)

  const alle = useMemo(() => funnelPhasen(karten), [karten])
  const imFunnel = useMemo(() => alle.filter((p) => p.imFunnel && p.bestand > 0), [alle])
  const aussortiert = alle.find((p) => !p.imFunnel) ?? null

  const gesamt = phasenSumme(imFunnel)
  const kosmos = gesamt + (aussortiert?.bestand ?? 0)

  /**
   * Die Stücke entstehen als Striche auf EINEM Kreis (`stroke-dasharray`) statt
   * als Pfade — ein Segment ist damit eine Zahl, kein Bogen-Kommando, und ein
   * Rundungsfehler kann den Ring nicht aufbrechen.
   */
  const stuecke = useMemo<Stueck[]>(() => {
    if (gesamt === 0) return []
    let gelaufen = 0
    return imFunnel.map((phase) => {
      const voll = (phase.bestand / gesamt) * UMFANG
      const versatz = gelaufen
      gelaufen += voll
      // Die Fuge geht vom Stück ab, nicht vom Kreis — sonst summieren sich die
      // Lücken auf und das letzte Stück steht schief.
      return { phase, laenge: Math.max(voll - FUGE, 0.5), versatz }
    })
  }, [imFunnel, gesamt])

  const darfOeffnen = oeffenbar ?? ((k: FunnelKarte) => k.bestand > 0)

  if (gesamt === 0) {
    return (
      <div
        className="ck-panel"
        style={{ padding: '22px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}
      >
        Noch niemand im Funnel — oder die Daten laden.
      </div>
    )
  }

  const beschreibung = imFunnel
    .map((p) => `${p.titel}: ${p.bestand}`)
    .join(', ')

  return (
    <div className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="ck-karten-titel">Wer steckt wo</span>
        <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
          {gesamt.toLocaleString('de-DE')} im Funnel
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ position: 'relative', width: GROESSE, height: GROESSE, flexShrink: 0 }}>
          <svg
            width={GROESSE}
            height={GROESSE}
            viewBox={`0 0 ${GROESSE} ${GROESSE}`}
            role="img"
            aria-label={`Leads je Phase — ${beschreibung}.`}
            style={{ display: 'block', transform: 'rotate(-90deg)' }}
          >
            {/* Die Bahn darunter: ohne sie franst der Ring bei kleinen Stücken aus. */}
            <circle
              cx={GROESSE / 2}
              cy={GROESSE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--ck-border)"
              strokeWidth={DICKE}
            />
            {stuecke.map(({ phase, laenge, versatz }) => (
              <circle
                key={phase.id}
                cx={GROESSE / 2}
                cy={GROESSE / 2}
                r={RADIUS}
                fill="none"
                stroke={phase.farbe}
                strokeWidth={DICKE}
                strokeDasharray={`${laenge} ${UMFANG - laenge}`}
                strokeDashoffset={-versatz}
                style={{
                  cursor: 'pointer',
                  opacity: betont == null || betont === phase.id ? 1 : 0.35,
                  transition: 'opacity 140ms ease-out',
                }}
                onMouseEnter={() => setBetont(phase.id)}
                onMouseLeave={() => setBetont(null)}
                onClick={() => setOffen((v) => (v === phase.id ? null : phase.id))}
              >
                <title>{`${phase.titel}: ${phase.bestand} — ${phase.bedeutung}`}</title>
              </circle>
            ))}
          </svg>
          {/* Die Zahl in der Mitte ist die Summe der Stücke, nicht eine siebte
              Zahl daneben. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              className="ck-zahl ck-serif"
              style={{ fontSize: 30, lineHeight: 1.1, color: 'var(--ck-text-1)' }}
            >
              {gesamt.toLocaleString('de-DE')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>im Funnel</span>
          </div>
        </div>

        {/* Die Legende trägt die Zahlen im Text — Nachbarstufen einer Rampe
            sind mit dem Auge allein nicht sicher zu trennen. */}
        <ul
          style={{
            flex: '1 1 200px',
            minWidth: 190,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {imFunnel.map((phase) => {
            const anteil = Math.round((phase.bestand / gesamt) * 100)
            const istOffen = offen === phase.id
            return (
              <li key={phase.id}>
                <button
                  type="button"
                  onClick={() => setOffen((v) => (v === phase.id ? null : phase.id))}
                  onMouseEnter={() => setBetont(phase.id)}
                  onMouseLeave={() => setBetont(null)}
                  aria-expanded={istOffen}
                  title={phase.bedeutung}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    minHeight: 32,
                    padding: '4px 6px',
                    borderRadius: 10,
                    border: '1px solid transparent',
                    background: betont === phase.id || istOffen ? 'var(--ck-panel-2)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                    transition: 'background 140ms ease-out',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 4,
                      background: phase.farbe,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      color: 'var(--ck-text-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {phase.titel}
                  </span>
                  {phase.heuteFaellig > 0 ? (
                    <span
                      style={{ fontSize: 11, color: 'var(--ck-accent-text)', flexShrink: 0 }}
                      title={`${phase.heuteFaellig} davon sind heute dran`}
                    >
                      {phase.heuteFaellig} heute
                    </span>
                  ) : null}
                  <span
                    className="ck-zahl"
                    style={{ fontSize: 13, color: 'var(--ck-text-2)', flexShrink: 0, minWidth: 34, textAlign: 'right' }}
                  >
                    {phase.bestand.toLocaleString('de-DE')}
                  </span>
                  <span
                    style={{ fontSize: 11, color: 'var(--ck-text-3)', flexShrink: 0, minWidth: 32, textAlign: 'right' }}
                  >
                    {anteil}%
                  </span>
                </button>

                {/* Aufgeklappt: die Karten, aus denen die Phase besteht — und
                    von dort in die Namen, über dieselbe Maschinerie wie im
                    Funnel darunter. Keine eigene Liste. */}
                {istOffen ? (
                  <ul style={{ listStyle: 'none', margin: '2px 0 6px', padding: '0 0 0 19px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {phase.karten
                      .filter((k) => k.bestand > 0)
                      .map((karte) => {
                        const klickbar = onKarteOeffnen != null && darfOeffnen(karte)
                        const inhalt = (
                          <>
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {karte.titel}
                            </span>
                            <span className="ck-zahl" style={{ flexShrink: 0 }}>
                              {karte.bestand}
                            </span>
                          </>
                        )
                        const flaeche = {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          minHeight: 30,
                          padding: '4px 8px',
                          borderRadius: 8,
                          fontSize: 12,
                          color: 'var(--ck-text-2)',
                          textAlign: 'left' as const,
                        }
                        return (
                          <li key={karte.id}>
                            {klickbar ? (
                              <button
                                type="button"
                                onClick={() => onKarteOeffnen?.(karte)}
                                style={{
                                  ...flaeche,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  font: 'inherit',
                                  fontSize: 12,
                                }}
                              >
                                {inhalt}
                              </button>
                            ) : (
                              <div style={flaeche}>{inhalt}</div>
                            )}
                          </li>
                        )
                      })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Die Gegenprobe zum Filter: nicht im Ring, aber auf der Seite. */}
      {aussortiert && aussortiert.bestand > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            paddingTop: 8,
            borderTop: '1px solid var(--ck-border)',
            fontSize: 12,
            color: 'var(--ck-text-3)',
          }}
          title={aussortiert.bedeutung}
        >
          <span
            aria-hidden="true"
            style={{ width: 12, height: 12, borderRadius: 4, background: aussortiert.farbe, flexShrink: 0 }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            {aussortiert.titel} — nicht im Ring
          </span>
          <span className="ck-zahl" style={{ flexShrink: 0 }}>
            {aussortiert.bestand.toLocaleString('de-DE')}
          </span>
          <span style={{ flexShrink: 0 }}>
            von {kosmos.toLocaleString('de-DE')}
          </span>
        </div>
      ) : null}
    </div>
  )
}
