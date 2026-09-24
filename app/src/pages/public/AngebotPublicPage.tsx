import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ladeOeffentlichesAngebot,
  signiereAngebot,
  type OeffentlichesAngebot,
} from '../../cockpit/lib/angebotApi'
import { datumDeutsch, formatEuro } from '../../cockpit/lib/angebotRegeln'
import '../portal/portal.css'

/**
 * Das Angebot, wie der Makler es sieht (20.09.2026, Blaupause
 * `docs/wargames/angebot-unterschrift.md`).
 *
 * **Diese Seite steht vor jedem Login.** Sie hängt an `/angebot/:token` auf
 * derselben Ebene wie `/book/...` und `/leads/...` — wer sie hinter die
 * Owner-Shell schiebt, schickt den Makler auf die Anmeldung, und das Angebot
 * ist damit tot.
 *
 * **Sie wird auf einem Telefon geöffnet**, aus LinkedIn heraus, oft im
 * In-App-Browser. Deshalb: eine Spalte, Knopf über 48 px, nichts, das Hover
 * braucht, und keine Schrift, ohne die der Text unlesbar würde.
 *
 * **Warum ein getippter Name und kein Gekritzel auf einem Canvas.** Für einen
 * Dienstleistungsvertrag zählt nicht das Bild einer Unterschrift, sondern der
 * nachweisbare Wille: wer, wann, wozu, von wo. Ein gemaltes Namenskürzel sieht
 * nach mehr aus und ist nach weniger wert — es lädt nur dazu ein, sich auf
 * seine Beweiskraft zu verlassen.
 */
export function AngebotPublicPage() {
  const { token = '' } = useParams()
  const [angebot, setAngebot] = useState<OeffentlichesAngebot | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sendet, setSendet] = useState(false)

  useEffect(() => {
    let abgebrochen = false
    setLaedt(true)
    ladeOeffentlichesAngebot(token)
      .then((a) => {
        if (!abgebrochen) setAngebot(a)
      })
      .catch(() => {
        // Ein Angebot, das es nicht gibt, und eines, das noch Entwurf ist,
        // sehen absichtlich gleich aus — deshalb hier keine Fehlermeldung,
        // sondern schlicht „nicht da".
        if (!abgebrochen) setAngebot(null)
      })
      .finally(() => {
        if (!abgebrochen) setLaedt(false)
      })
    return () => {
      abgebrochen = true
    }
  }, [token])

  const unterschreiben = useCallback(
    async (name: string) => {
      if (!angebot || sendet) return
      setSendet(true)
      setFehler(null)
      try {
        const ergebnis = await signiereAngebot(token, name)
        setAngebot({
          ...angebot,
          status: 'signiert',
          signiert_am: ergebnis.signiert_am,
          signiert_name: ergebnis.signiert_name,
        })
      } catch (e) {
        setFehler((e as Error).message)
      } finally {
        setSendet(false)
      }
    },
    [angebot, sendet, token],
  )

  return (
    <AngebotAnsicht
      angebot={angebot}
      laedt={laedt}
      sendet={sendet}
      fehler={fehler}
      onSignieren={unterschreiben}
    />
  )
}

/**
 * Die reine Darstellung — ohne Netz, ohne Router. Getrennt, damit
 * `/dev/angebot-vorschau` sie mit festen Daten zeigen kann: Diese Seite ist
 * die einzige im Projekt, die ein Fremder zu sehen bekommt, und sie soll nicht
 * erst im Ernstfall das erste Mal betrachtet werden.
 */
export function AngebotAnsicht({
  angebot,
  laedt,
  sendet,
  fehler,
  onSignieren,
}: {
  angebot: OeffentlichesAngebot | null
  laedt: boolean
  sendet: boolean
  fehler: string | null
  onSignieren: (name: string) => void
}) {
  const [name, setName] = useState('')
  const [bestaetigt, setBestaetigt] = useState(false)

  const huelle = (inhalt: React.ReactNode) => (
    <div
      className="portal-root"
      style={{
        minHeight: '100dvh',
        background: 'var(--portal-bg-verlauf)',
        color: 'var(--portal-text)',
        padding: '32px 16px 64px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>{inhalt}</div>
    </div>
  )

  if (laedt) {
    return huelle(<p style={{ color: 'var(--portal-text-secondary)', fontSize: 15 }}>Einen Moment …</p>)
  }

  // Ein Angebot, das es nicht gibt, sieht genauso aus wie eines, das noch nicht
  // verschickt ist — siehe Kopf der Edge Function.
  if (!angebot) {
    return huelle(
      <>
        <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 26, fontWeight: 500, margin: '0 0 10px' }}>
          Dieses Angebot gibt es nicht mehr
        </h1>
        <p style={{ color: 'var(--portal-text-secondary)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          Der Link ist entweder abgelaufen oder wurde ersetzt. Melden Sie sich bei
          Ihrem Ansprechpartner — er schickt Ihnen einen neuen.
        </p>
      </>,
    )
  }

  const gesperrt = !bestaetigt || name.trim().length < 3
  const istSigniert = angebot.status === 'signiert'
  const istZu = angebot.status === 'abgelehnt' || angebot.status === 'abgelaufen'
  const kannUnterschreiben = angebot.status === 'versendet'

  return huelle(
    <>
      <p
        style={{
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--portal-gold-text)',
          margin: '0 0 6px',
        }}
      >
        {angebot.firma}
      </p>
      <h1
        style={{
          fontFamily: 'var(--portal-display)',
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.2,
          margin: '0 0 6px',
        }}
      >
        Angebot{angebot.empfaenger ? ` für ${angebot.empfaenger}` : ''}
      </h1>
      <p style={{ color: 'var(--portal-text-tertiary)', fontSize: 13, margin: '0 0 28px' }}>
        Gültig bis {datumDeutsch(angebot.gueltig_bis)}
      </p>

      <section
        style={{
          background: 'var(--portal-surface)',
          border: '1px solid var(--portal-border)',
          borderRadius: 18,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{angebot.titel}</h2>
        {angebot.beschreibung ? (
          <p style={{ color: 'var(--portal-text-secondary)', fontSize: 15, lineHeight: 1.65, margin: '0 0 18px' }}>
            {angebot.beschreibung}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            paddingTop: 14,
            borderTop: '1px solid var(--portal-border)',
          }}
        >
          <span style={{ color: 'var(--portal-text-secondary)', fontSize: 14 }}>Einmalig</span>
          <span style={{ fontSize: 22, fontWeight: 600, fontFamily: 'var(--portal-display)' }}>
            {formatEuro(angebot.betrag)}
          </span>
        </div>

        {/* Der Retainer ist eine zweite Zahl, keine Addition: Er läuft
            monatlich weiter, und eine Summe aus beidem gäbe es nicht. */}
        {angebot.retainer_betrag != null ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
              marginTop: 10,
            }}
          >
            <span style={{ color: 'var(--portal-text-secondary)', fontSize: 14 }}>
              Danach monatlich{angebot.retainer_titel ? ` — ${angebot.retainer_titel}` : ''}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--portal-display)' }}>
              {formatEuro(angebot.retainer_betrag)}
            </span>
          </div>
        ) : null}

        <p style={{ color: 'var(--portal-text-tertiary)', fontSize: 12, margin: '14px 0 0', lineHeight: 1.5 }}>
          Alle Preise zzgl. gesetzlicher Umsatzsteuer. Das Werbebudget zahlen Sie
          direkt an Meta.
        </p>
      </section>

      {istSigniert ? (
        <section
          style={{
            background: 'var(--portal-surface)',
            border: '1px solid rgba(197, 160, 89, 0.32)',
            borderRadius: 18,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--portal-gold-text)' }}>
            Angenommen
          </h2>
          <p style={{ color: 'var(--portal-text-secondary)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            {angebot.signiert_name} hat dieses Angebot am{' '}
            {angebot.signiert_am ? datumDeutsch(angebot.signiert_am.slice(0, 10)) : 'heute'} angenommen.
            Sie hören von uns — die Unterlagen und der Zugang zu Ihrem Projekt
            kommen per E-Mail.
          </p>
        </section>
      ) : istZu ? (
        <section
          style={{
            background: 'var(--portal-surface)',
            border: '1px solid var(--portal-border)',
            borderRadius: 18,
            padding: 20,
          }}
        >
          <p style={{ color: 'var(--portal-text-secondary)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
            {angebot.status === 'abgelaufen'
              ? `Dieses Angebot war bis zum ${datumDeutsch(angebot.gueltig_bis)} gültig. Melden Sie sich, wenn es weiterhin interessant ist — wir stellen es neu aus.`
              : 'Dieses Angebot wurde zurückgezogen.'}
          </p>
        </section>
      ) : kannUnterschreiben ? (
        <section
          style={{
            background: 'var(--portal-surface)',
            border: '1px solid var(--portal-border)',
            borderRadius: 18,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: '0 0 14px' }}>Angebot annehmen</h2>

          <label style={{ display: 'block', marginBottom: 14 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--portal-text-secondary)', marginBottom: 6 }}>
              Ihr vollständiger Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Vorname Nachname"
              style={{
                width: '100%',
                minHeight: 48,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--portal-border)',
                background: 'rgba(10, 17, 40, 0.6)',
                color: 'var(--portal-text)',
                fontSize: 16,
                fontFamily: 'inherit',
              }}
            />
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={bestaetigt}
              onChange={(e) => setBestaetigt(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: 'var(--portal-gold)' }}
            />
            <span style={{ fontSize: 14, color: 'var(--portal-text-secondary)', lineHeight: 1.55 }}>
              Ich nehme dieses Angebot zu den genannten Konditionen verbindlich an.
            </span>
          </label>

          <button
            type="button"
            onClick={() => onSignieren(name.trim())}
            disabled={gesperrt || sendet}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 14,
              // Der gesperrte Knopf trägt NICHT dieselbe dunkle Schrift wie der
              // freigegebene: Auf der abgeblendeten Goldfläche wäre sie kaum
              // zu lesen, und ein Knopf, dessen Beschriftung man raten muss,
              // sieht nach Fehler aus statt nach „da fehlt noch etwas".
              background: gesperrt ? 'rgba(197, 160, 89, 0.10)' : 'var(--portal-gold)',
              color: gesperrt ? 'var(--portal-text-tertiary)' : 'var(--portal-auf-akzent)',
              border: gesperrt ? '1px solid var(--portal-border)' : 'none',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: gesperrt || sendet ? 'not-allowed' : 'pointer',
            }}
          >
            {sendet ? 'Einen Moment …' : 'Angebot verbindlich annehmen'}
          </button>

          {fehler ? (
            <p style={{ color: '#e5948a', fontSize: 13, margin: '12px 0 0', lineHeight: 1.5 }}>
              Das hat nicht geklappt. Versuchen Sie es noch einmal oder melden Sie
              sich bei Ihrem Ansprechpartner.
            </p>
          ) : null}

          <p style={{ color: 'var(--portal-text-tertiary)', fontSize: 12, margin: '14px 0 0', lineHeight: 1.5 }}>
            Mit dem Klick werden Ihr Name, der Zeitpunkt und Ihre IP-Adresse
            gespeichert — als Nachweis der Annahme.
          </p>
        </section>
      ) : null}
    </>,
  )
}
