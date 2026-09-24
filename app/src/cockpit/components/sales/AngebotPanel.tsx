import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Angebot, Contact } from '../../../types/db'
import {
  erstelleAngebot,
  ladeAngebote,
  markiereAbgelehnt,
  markiereVersendet,
  angebotUrl,
} from '../../lib/angebotApi'
import {
  ANGEBOT_STATUS_TITEL,
  angebotHalbsatz,
  angezeigterStatus,
  formatEuro,
  offeneAngebote,
} from '../../lib/angebotRegeln'
import { ladePakete, type RechnungsPaket } from '../../lib/rechnungApi'

/**
 * Das Angebot am Lead (20.09.2026, Blaupause
 * `docs/wargames/angebot-unterschrift.md`).
 *
 * Gebaut für den Moment direkt nach dem Call: Der Makler hat zugesagt, und
 * bevor die Zusage kalt wird, soll der Link raus, den er unterschreiben kann.
 * Deshalb steht das Panel über dem Rechnungs-Panel und nicht daneben — die
 * Reihenfolge auf dem Bildschirm ist die Reihenfolge im Verkauf: erst das Ja,
 * dann das Geld.
 *
 * **Zwei Schritte, nicht einer.** „Anlegen" macht einen Entwurf, „Ist raus"
 * macht ihn unterschreibbar. Ein Entwurf, den Kevin noch einmal anschaut, darf
 * nicht schon signierbar im Netz stehen — und die Edge Function signiert
 * ausschliesslich aus `versendet` heraus, dieser zweite Klick ist also die
 * Freigabe und keine Buchhaltung.
 *
 * **Ein offenes Angebot fragt zurück.** Zwei offene Links heissen, dass der
 * Makler den falschen unterschreibt. Dieselbe Haltung wie die Dublettensperre
 * bei der Rechnung: zurückfragen, nicht blocken — es gibt legitime zweite
 * Angebote, nur keine versehentlichen.
 */

/** Die Retainer aus `pakete.json`, in Kevins Reihenfolge: 2.000 ist der Default. */
const RETAINER_SCHLUESSEL = ['retainer-2000', 'retainer-1000'] as const

export function AngebotPanel({
  contact,
  leadId,
}: {
  contact: Contact
  /** Der LinkedIn-Lead, falls es einen gibt — dann wandert er beim Signieren auf „Kunde". */
  leadId?: string | null
}) {
  const [angebote, setAngebote] = useState<Angebot[]>([])
  const [pakete, setPakete] = useState<RechnungsPaket[]>([])
  const [runnerBereit, setRunnerBereit] = useState<boolean | null>(null)
  const [gewaehlt, setGewaehlt] = useState('')
  const [retainer, setRetainer] = useState('')
  const [tage, setTage] = useState(14)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [nachfrage, setNachfrage] = useState(false)
  const [kopiert, setKopiert] = useState<string | null>(null)

  const jetzt = useMemo(() => new Date(), [angebote])

  /** Derselbe Feld-Stil wie im Rechnungs-Panel daneben — die zwei stehen
   *  nebeneinander und dürfen nicht aus zwei Bausätzen aussehen. */
  const feldStil: React.CSSProperties = {
    width: '100%',
    minHeight: 40,
    background: 'var(--ck-panel-2)',
    border: '1px solid var(--ck-border)',
    borderRadius: 8,
    color: 'var(--ck-text-1)',
    fontSize: 13,
    padding: '8px 10px',
    font: 'inherit',
  }

  const laden = useCallback(async () => {
    try {
      setAngebote(await ladeAngebote(contact.id))
    } catch (e) {
      setFehler((e as Error).message)
    }
  }, [contact.id])

  useEffect(() => {
    setFehler(null)
    setNachfrage(false)
    setKopiert(null)
    void laden()
  }, [laden])

  useEffect(() => {
    let weg = false
    ladePakete()
      .then((a) => {
        if (weg) return
        setRunnerBereit(a.bereit)
        setPakete(a.pakete)
        // Der Festpreis ist der Normalfall — er steht vorn.
        setGewaehlt((v) => v || a.pakete.find((p) => p.schluessel === 'funnel')?.schluessel || a.pakete[0]?.schluessel || '')
      })
      .catch(() => {
        if (!weg) setRunnerBereit(false)
      })
    return () => {
      weg = true
    }
  }, [])

  const einmalPakete = useMemo(
    () => pakete.filter((p) => !p.wiederkehrend),
    [pakete],
  )
  const retainerPakete = useMemo(
    () =>
      RETAINER_SCHLUESSEL.map((s) => pakete.find((p) => p.schluessel === s)).filter(
        (p): p is RechnungsPaket => p != null,
      ),
    [pakete],
  )

  const paket = useMemo(() => pakete.find((p) => p.schluessel === gewaehlt) ?? null, [pakete, gewaehlt])
  const retainerPaket = useMemo(
    () => (retainer ? pakete.find((p) => p.schluessel === retainer) ?? null : null),
    [pakete, retainer],
  )

  const offen = useMemo(() => offeneAngebote(angebote, jetzt), [angebote, jetzt])

  const anlegen = useCallback(async () => {
    if (!paket || laeuft) return
    // Erst zurückfragen, wenn schon eines offen ist — siehe Kopf.
    if (offen.length > 0 && !nachfrage) {
      setNachfrage(true)
      return
    }
    setLaeuft(true)
    setFehler(null)
    try {
      await erstelleAngebot({
        brand_id: contact.brand_id,
        contact_id: contact.id,
        lead_id: leadId ?? null,
        paket: paket.schluessel,
        titel: paket.titel,
        beschreibung: paket.beschreibung,
        betrag: paket.einzelpreis,
        retainer_paket: retainerPaket?.schluessel ?? null,
        retainer_betrag: retainerPaket?.einzelpreis ?? null,
        gueltig_tage: tage,
      })
      setNachfrage(false)
      await laden()
    } catch (e) {
      setFehler((e as Error).message)
    } finally {
      setLaeuft(false)
    }
  }, [contact.brand_id, contact.id, laden, laeuft, leadId, nachfrage, offen.length, paket, retainerPaket, tage])

  const kopieren = useCallback(async (angebot: Angebot) => {
    try {
      await navigator.clipboard.writeText(angebotUrl(angebot.token))
      setKopiert(angebot.id)
      window.setTimeout(() => setKopiert(null), 2000)
    } catch {
      setFehler('Der Link liess sich nicht kopieren.')
    }
  }, [])

  return (
    <div className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="ck-label">Angebot</span>
        {angebote.length > 0 ? (
          <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
            {angebote.length} {angebote.length === 1 ? 'Stück' : 'Stück'}
          </span>
        ) : null}
      </div>

      {runnerBereit === false ? (
        <p style={{ fontSize: 12, color: 'var(--ck-text-3)', margin: 0, lineHeight: 1.5 }}>
          Die Pakete kommen vom Runner — auf diesem Gerät ist er gerade nicht
          erreichbar. Bestehende Angebote stehen trotzdem unten.
        </p>
      ) : (
        <>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ck-text-3)', marginBottom: 4 }}>
              Leistung
            </span>
            <select
              value={gewaehlt}
              onChange={(e) => setGewaehlt(e.target.value)}
              style={feldStil}
            >
              {einmalPakete.map((p) => (
                <option key={p.schluessel} value={p.schluessel}>
                  {p.titel} — {formatEuro(p.einzelpreis)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ck-text-3)', marginBottom: 4 }}>
              Retainer danach
            </span>
            <select
              value={retainer}
              onChange={(e) => setRetainer(e.target.value)}
              style={feldStil}
            >
              <option value="">kein Retainer</option>
              {retainerPakete.map((p) => (
                <option key={p.schluessel} value={p.schluessel}>
                  {p.titel} — {formatEuro(p.einzelpreis)} / Monat
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ck-text-3)', marginBottom: 4 }}>
              Gültig für
            </span>
            <select
              value={tage}
              onChange={(e) => setTage(Number(e.target.value))}
              style={feldStil}
            >
              <option value={7}>7 Tage</option>
              <option value={14}>14 Tage</option>
              <option value={30}>30 Tage</option>
            </select>
          </label>

          {nachfrage ? (
            <p style={{ fontSize: 12, color: 'var(--ck-warn)', margin: 0, lineHeight: 1.5 }}>
              Für {contact.name} ist schon ein Angebot offen. Noch einmal klicken,
              wenn du trotzdem ein zweites willst — der Makler sieht dann zwei Links.
            </p>
          ) : null}

          <button
            type="button"
            className="ck-btn"
            onClick={() => void anlegen()}
            disabled={!paket || laeuft}
            style={{ minHeight: 44 }}
          >
            {laeuft ? 'Einen Moment …' : nachfrage ? 'Trotzdem anlegen' : 'Angebot anlegen'}
          </button>
        </>
      )}

      {fehler ? (
        <p style={{ fontSize: 12, color: 'var(--ck-danger)', margin: 0, lineHeight: 1.5 }}>{fehler}</p>
      ) : null}

      {angebote.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {angebote.map((a) => {
            const status = angezeigterStatus(a, jetzt)
            return (
              <li
                key={a.id}
                style={{
                  border: '1px solid var(--ck-border)',
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ck-text-1)' }}>{a.titel}</span>
                  <span className="ck-zahl" style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>
                    {formatEuro(a.betrag)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className="ck-chip"
                    style={{
                      fontSize: 11,
                      color: status === 'signiert' ? 'var(--ck-accent-text)' : 'var(--ck-text-3)',
                    }}
                  >
                    {ANGEBOT_STATUS_TITEL[status]}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ck-text-3)', flex: 1, minWidth: 0 }}>
                    {angebotHalbsatz(a, jetzt)}
                  </span>
                </div>

                {a.retainer_betrag != null ? (
                  <span style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
                    danach {formatEuro(a.retainer_betrag)} / Monat
                  </span>
                ) : null}

                {status === 'entwurf' || status === 'versendet' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 36, fontSize: 12 }}
                      onClick={() => void kopieren(a)}
                    >
                      {kopiert === a.id ? 'Kopiert' : 'Link kopieren'}
                    </button>
                    {status === 'entwurf' ? (
                      <button
                        type="button"
                        className="ck-btn"
                        style={{ minHeight: 36, fontSize: 12 }}
                        onClick={() =>
                          void markiereVersendet(a.id)
                            .then(laden)
                            .catch((e: Error) => setFehler(e.message))
                        }
                        title="Erst danach kann der Makler unterschreiben"
                      >
                        Ist raus
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ck-btn"
                      style={{ minHeight: 36, fontSize: 12, color: 'var(--ck-text-3)' }}
                      onClick={() =>
                        void markiereAbgelehnt(a.id, 'Von Hand zurückgezogen')
                          .then(laden)
                          .catch((e: Error) => setFehler(e.message))
                      }
                    >
                      Zurückziehen
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
