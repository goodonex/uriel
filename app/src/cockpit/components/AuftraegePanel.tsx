import { useCallback, useEffect, useState } from 'react'
import {
  alterText,
  datumText,
  fetchAuftraege,
  tokenText,
  usdText,
  zustandText,
  type Auftrag,
  type AuftraegeStand,
  type AuftragPhase,
  type AuftragZustand,
} from '../lib/auftraegeApi'

/**
 * Aufträge auf dem Mini (24.09.2026): je Projekt die Kette der Phasen — was
 * durch ist, wo es steht, was noch kommt — und daneben die Tokens, verbraucht
 * gegen geplant. Darunter, woran sonst in den letzten sieben Tagen gearbeitet
 * wurde.
 *
 * Farben nach DESIGN-TOKENS: Salbei für Fortschritt, Gold für „liegt", Rot
 * nur für echte Fehler, Grau für Ruhe.
 */

const ZUSTAND_FARBE: Record<AuftragZustand, string> = {
  laeuft: 'var(--ck-accent)',
  pausiert: 'var(--ck-idle)',
  brach: 'var(--ck-warn)',
  gestoppt: 'var(--ck-warn)',
  fertig: 'var(--ck-accent)',
}

const POLL_MS = 30_000

/** `vorgabe`: fester Stand ohne Abruf — nur für die Dev-Vorschau. */
export function AuftraegePanel({ vorgabe }: { vorgabe?: AuftraegeStand } = {}) {
  const [stand, setStand] = useState<AuftraegeStand | null>(vorgabe ?? null)
  const [fehler, setFehler] = useState<string | null>(null)
  /** „Jetzt" für alle Altersangaben — beim Laden gesetzt, nicht beim Rendern. */
  const [jetzt, setJetzt] = useState(() => Date.now())

  const laden = useCallback(async () => {
    try {
      setStand(await fetchAuftraege())
      setJetzt(Date.now())
      setFehler(null)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    if (vorgabe) return
    void laden()
    const t = window.setInterval(() => void laden(), POLL_MS)
    return () => window.clearInterval(t)
  }, [laden, vorgabe])

  const offen = stand?.auftraege.filter((a) => a.zustand !== 'fertig') ?? []
  const fertig = stand?.auftraege.filter((a) => a.zustand === 'fertig') ?? []

  return (
    <section aria-labelledby="auftraege-titel" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <h2 id="auftraege-titel" style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          Aufträge auf dem Mini
        </h2>
        <span className="ck-label">
          {stand
            ? `${offen.length} offen${fertig.length ? ` · ${fertig.length} kürzlich fertig` : ''}${
                stand.stand ? ` · Stand vor ${alterText(stand.stand, jetzt)}` : ''
              }`
            : fehler
              ? ''
              : 'Lade…'}
        </span>
      </div>

      {fehler && !stand ? (
        <div className="ck-panel" style={{ padding: '11px 13px', fontSize: 12.5, color: 'var(--ck-text-2)' }}>
          {fehler} Sobald der Runner auf dem Mini den neuen Stand hat, erscheint hier die Übersicht.
        </div>
      ) : null}

      {stand && offen.length === 0 && fertig.length === 0 ? (
        <div className="ck-panel" style={{ padding: '11px 13px', fontSize: 12.5, color: 'var(--ck-text-2)' }}>
          Kein Projekt mit Phasenplan. Ein Auftrag erscheint hier, sobald im Projektordner eine{' '}
          <code>FORTSCHRITT.json</code> oder eine <code>STAND.md</code> mit Phasen-Checkliste liegt.
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[...offen, ...fertig].map((a) => (
          <AuftragKarte key={`${a.projekt}:${a.titel}`} auftrag={a} jetzt={jetzt} />
        ))}
      </div>

      {stand?.hinweise.length ? (
        <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 10, lineHeight: 1.5 }}>
          Ohne lesbare Phasen: {stand.hinweise.map((h) => `${h.projekt} (${h.grund})`).join(' · ')}
        </div>
      ) : null}
    </section>
  )
}

function AuftragKarte({ auftrag: a, jetzt }: { auftrag: Auftrag; jetzt: number }) {
  const farbe = ZUSTAND_FARBE[a.zustand]
  const akt = a.aktuell != null ? a.phasen[a.aktuell] : null
  const danach = a.aktuell != null ? a.phasen.slice(a.aktuell + 1).filter((p) => p.status !== 'fertig') : []
  const fertigZahl = a.phasen.filter((p) => p.status === 'fertig').length

  return (
    <article
      className="ck-panel"
      style={{
        padding: '14px 15px',
        borderColor: a.zustand === 'brach' || a.zustand === 'gestoppt' ? 'var(--ck-warn)' : undefined,
      }}
    >
      {/* Kopf: Projekt, Kette, Zustand */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{a.projekt}</div>
          <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ck-text-2)', marginTop: 2 }}>
            {a.titel}
            {a.gestartet ? ` · seit ${datumText(a.gestartet)}` : ''}
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 99,
            border: `1px solid ${farbe}`,
            color: farbe,
            whiteSpace: 'nowrap',
          }}
        >
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: farbe }} />
          {zustandText(a, jetzt)}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px 22px',
          marginTop: 12,
        }}
      >
        {/* Links: die Kette der Phasen */}
        <div style={{ minWidth: 0 }}>
          <PhasenLeiste phasen={a.phasen} />
          <div style={{ marginTop: 9, fontSize: 13, lineHeight: 1.45 }}>
            {a.fertig ? (
              <span>
                <span style={{ fontWeight: 600 }}>Alle {a.phasen.length} Phasen abgeschlossen.</span>
                <span style={{ color: 'var(--ck-text-2)' }}> Die nächste Kette ist noch nicht geplant.</span>
              </span>
            ) : akt ? (
              <>
                <span style={{ fontWeight: 600 }}>
                  Phase {a.aktuell! + 1} von {a.phasen.length}: {akt.titel || akt.id}
                </span>
                <span style={{ color: 'var(--ck-text-2)' }}>
                  {' · '}
                  {akt.prozent == null ? 'Stand noch offen' : `${akt.prozent} %${akt.geschaetzt ? ' (geschätzt)' : ''}`}
                </span>
                {akt.schritt ? <div style={{ color: 'var(--ck-text-2)', fontSize: 12.5 }}>{akt.schritt}</div> : null}
              </>
            ) : null}
          </div>
          <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 4, lineHeight: 1.45 }}>
            {fertigZahl} fertig
            {danach.length ? ` · danach: ${danach.slice(0, 3).map((p) => p.titel || p.id).join(', ')}${danach.length > 3 ? ` und ${danach.length - 3} weitere` : ''}` : ''}
          </div>
        </div>

        {/* Rechts: Tokens */}
        <TokenBlock auftrag={a} />
      </div>

      {a.waechter ? <WaechterZeile auftrag={a} jetzt={jetzt} /> : null}
      {a.notiz ? (
        <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ck-text-2)' }}>{a.notiz}</div>
      ) : null}
    </article>
  )
}

/** Ein Segment je Phase: voll = fertig, anteilig = läuft, leer = kommt noch. */
function PhasenLeiste({ phasen }: { phasen: AuftragPhase[] }) {
  return (
    <div role="list" aria-label="Phasen" style={{ display: 'flex', gap: 4 }}>
      {phasen.map((p, i) => {
        const fertig = p.status === 'fertig'
        const laeuft = p.status === 'laeuft'
        const fehler = p.status === 'fehler'
        const fuellung = fertig ? 100 : laeuft ? (p.prozent ?? 0) : 0
        const beschriftung = `${p.id} ${p.titel}: ${
          fertig ? 'fertig' : laeuft ? (p.prozent == null ? 'läuft' : `${p.prozent} %`) : fehler ? 'Fehler' : 'kommt noch'
        }`
        return (
          <div
            key={`${p.id}-${i}`}
            role="listitem"
            aria-label={beschriftung}
            title={beschriftung}
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <div
              style={{
                position: 'relative',
                height: 8,
                borderRadius: 99,
                overflow: 'hidden',
                background: laeuft ? 'var(--ck-accent-dim)' : 'transparent',
                border: `1px solid ${fehler ? 'var(--ck-danger)' : fertig || laeuft ? 'var(--ck-accent)' : 'var(--ck-border-strong)'}`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${fuellung}%`,
                  background: 'var(--ck-accent)',
                  transition: 'width 600ms ease',
                }}
              />
            </div>
            <span
              className="ck-label"
              style={{
                fontSize: 9.5,
                textAlign: 'center',
                color: laeuft ? 'var(--ck-text-1)' : fertig ? 'var(--ck-accent)' : 'var(--ck-text-3)',
                overflow: 'hidden',
                textOverflow: 'clip',
                whiteSpace: 'nowrap',
              }}
            >
              {fertig ? '✓' : p.id}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function TokenBlock({ auftrag: a }: { auftrag: Auftrag }) {
  const { verbraucht, geplant, geplantArt, usd } = a.tokens
  const anteil = geplant ? Math.min(100, Math.round((verbraucht / geplant) * 100)) : null
  const ueber = geplant != null && verbraucht > geplant
  return (
    <div style={{ minWidth: 0 }}>
      <div className="ck-label" style={{ marginBottom: 4 }}>Tokens</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>
        {tokenText(verbraucht)}
        {geplant && !a.fertig ? (
          <span style={{ fontWeight: 400, color: 'var(--ck-text-2)' }}>
            {' '}
            von {geplantArt === 'hochrechnung' ? '~' : ''}
            {tokenText(geplant)}
          </span>
        ) : null}
      </div>
      {anteil != null && !a.fertig ? (
        <div
          aria-hidden
          style={{ marginTop: 6, height: 6, borderRadius: 99, background: 'var(--ck-border)', overflow: 'hidden' }}
        >
          <div style={{ width: `${anteil}%`, height: '100%', background: ueber ? 'var(--ck-warn)' : 'var(--ck-accent)' }} />
        </div>
      ) : null}
      <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 6, lineHeight: 1.45 }}>
        {a.fertig
          ? `gesamt für die Kette${a.tokens.schnittJePhase ? ` · Ø ${tokenText(a.tokens.schnittJePhase)} je Phase` : ''}`
          : geplantArt === 'vorgabe'
          ? 'geplant laut Auftrag'
          : geplantArt === 'hochrechnung'
            ? `hochgerechnet aus ${tokenText(a.tokens.schnittJePhase)} je fertiger Phase`
            : 'Hochrechnung ab der ersten fertigen Phase mit Messung'}
        {ueber ? ` · ${tokenText(verbraucht - geplant!)} über Plan` : ''}
        {usd > 0 ? ` · ${usdText(usd)} Listenpreis` : ''}
      </div>
    </div>
  )
}

function WaechterZeile({ auftrag: a, jetzt }: { auftrag: Auftrag; jetzt: number }) {
  const w = a.waechter!
  const teile: string[] = []
  if (w.jobs != null) teile.push(`Job ${w.jobs}${w.maxJobs ? ` von höchstens ${w.maxJobs}` : ''}`)
  if (w.stichtag) teile.push(`Stichtag ${datumText(w.stichtag)}`)
  if (w.fehlschlaege > 0) teile.push(`${w.fehlschlaege} Fehlschlag${w.fehlschlaege > 1 ? 'e' : ''} in Folge`)
  if (w.ruheBis && new Date(w.ruheBis).getTime() > jetzt) teile.push(`Pause bis ${new Date(w.ruheBis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`)
  if (!teile.length) return null
  return (
    <div className="ck-label" style={{ textTransform: 'none', letterSpacing: 0, marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--ck-border)' }}>
      Wächter: {teile.join(' · ')}
    </div>
  )
}
