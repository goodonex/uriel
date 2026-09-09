import { useEffect, useMemo, useState } from 'react'
import type { Contact } from '../../../types/db'
import {
  DublettenFehler,
  erstelleRechnung,
  ladePakete,
  rechnungsUrl,
  type ErstellteRechnung,
  type RechnungsPaket,
} from '../../lib/rechnungApi'

/**
 * Rechnung am Lead (02.09.2026).
 *
 * Gebaut für genau einen Moment: Der Makler sagt im Call zu, und die Rechnung
 * mit GiroCode soll raus, solange die Zusage warm ist. Deshalb steht die
 * Anschrift hier direkt neben dem Knopf — sie fehlt bei einem LinkedIn-Lead
 * immer, und ein zweites Formular an anderer Stelle würde genau den Moment
 * kosten, um den es geht.
 *
 * **Drei Entscheidungen, die man kennen muss:**
 *
 * 1. *Der Knopf bleibt gesperrt, solange die Anschrift unvollständig ist.* Eine
 *    Rechnung ohne Empfängeranschrift ist nach §14 UStG keine Rechnung, und der
 *    Nummernkreis wäre für nichts verbraucht.
 * 2. *Kein automatischer zweiter Versuch.* Jeder Lauf zieht eine fortlaufende
 *    Nummer. Bleibt eine Antwort aus, wird nachgesehen, nicht nachgeschossen.
 * 3. *Die Dublettensperre fragt zurück, statt zu blocken.* Anzahlung und
 *    Restbetrag am selben Tag sind legitim — nur derselbe Betrag zweimal ist
 *    verdächtig, und dann entscheidet Kevin.
 */

type Felder = Pick<
  Contact,
  'rechnung_firma' | 'rechnung_strasse' | 'rechnung_plz' | 'rechnung_ort' | 'rechnung_email'
>

export function RechnungPanel({
  contact,
  onSpeichern,
}: {
  contact: Contact
  onSpeichern: (patch: Partial<Contact>) => void
}) {
  const [pakete, setPakete] = useState<RechnungsPaket[]>([])
  const [bereit, setBereit] = useState<boolean | null>(null)
  const [gewaehlt, setGewaehlt] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [nachfrage, setNachfrage] = useState<string | null>(null)
  const [fertig, setFertig] = useState<ErstellteRechnung | null>(null)
  /* Leer heisst: der Generator setzt das Rechnungsdatum ein. Das ist bei einem
     Festpreis richtig; nur bei Retainern will Kevin den Monat sehen. */
  const [zeitraum, setZeitraum] = useState('')

  // Der Entwurf lebt lokal, damit Tippen nicht bei jedem Zeichen speichert;
  // geschrieben wird beim Verlassen des Feldes.
  const [entwurf, setEntwurf] = useState<Felder>({
    rechnung_firma: contact.rechnung_firma || contact.company || contact.name || '',
    rechnung_strasse: contact.rechnung_strasse || '',
    rechnung_plz: contact.rechnung_plz || '',
    rechnung_ort: contact.rechnung_ort || '',
    rechnung_email: contact.rechnung_email || contact.email || '',
  })

  useEffect(() => {
    setEntwurf({
      rechnung_firma: contact.rechnung_firma || contact.company || contact.name || '',
      rechnung_strasse: contact.rechnung_strasse || '',
      rechnung_plz: contact.rechnung_plz || '',
      rechnung_ort: contact.rechnung_ort || '',
      rechnung_email: contact.rechnung_email || contact.email || '',
    })
    setFertig(null)
    setFehler(null)
    setNachfrage(null)
  }, [contact.id])

  useEffect(() => {
    let weg = false
    ladePakete()
      .then((a) => {
        if (weg) return
        setBereit(a.bereit)
        setPakete(a.pakete)
        setGewaehlt((v) => v || a.pakete[0]?.schluessel || '')
      })
      .catch(() => {
        if (!weg) setBereit(false)
      })
    return () => {
      weg = true
    }
  }, [])

  const paket = useMemo(() => pakete.find((p) => p.schluessel === gewaehlt) ?? null, [pakete, gewaehlt])
  /* Die Mailadresse fehlt hier bewusst: §14 UStG verlangt die Anschrift, nicht
     die Mail. Sie zur Pflicht zu machen wuerde den Knopf im Call sperren. */
  const vollstaendig =
    entwurf.rechnung_firma.trim() !== '' &&
    entwurf.rechnung_strasse.trim() !== '' &&
    entwurf.rechnung_plz.trim() !== '' &&
    entwurf.rechnung_ort.trim() !== ''

  function feldFertig(feld: keyof Felder) {
    const wert = entwurf[feld].trim()
    if (wert !== (contact[feld] ?? '')) onSpeichern({ [feld]: wert } as Partial<Contact>)
  }

  async function ausloesen(erzwingen = false) {
    if (!paket || !vollstaendig || laeuft) return
    setLaeuft(true)
    setFehler(null)
    setNachfrage(null)
    try {
      const r = await erstelleRechnung({
        kunde: {
          firma: entwurf.rechnung_firma.trim(),
          strasse: entwurf.rechnung_strasse.trim(),
          plz: entwurf.rechnung_plz.trim(),
          ort: entwurf.rechnung_ort.trim(),
          email: entwurf.rechnung_email.trim() || undefined,
        },
        paket: paket.schluessel,
        leistungszeitraum: zeitraum.trim() || undefined,
        erzwingen,
      })
      setFertig(r)
    } catch (e) {
      if (e instanceof DublettenFehler) setNachfrage(e.message)
      else setFehler(e instanceof Error ? e.message : 'Rechnung fehlgeschlagen')
    } finally {
      setLaeuft(false)
    }
  }

  /* `null` heisst: die Antwort steht noch aus. Lokal ist das ein Wimpernschlag,
     ueber den Auftragsweg bis zu 25 Sekunden — in der Zeit ein leeres Panel mit
     gesperrtem Knopf zu zeigen waere unruhiger als gar keins. Es erscheint,
     sobald die Pakete da sind. `false` heisst: kein Runner erreichbar. */
  if (bereit !== true) return null

  const feldStil: React.CSSProperties = {
    width: '100%',
    background: 'var(--ck-surface-2)',
    border: '1px solid var(--ck-line)',
    borderRadius: 6,
    color: 'var(--ck-text-1)',
    fontSize: 12.5,
    padding: '7px 9px',
  }

  return (
    <section className="ck-panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="ck-label">Rechnung</span>
        {paket ? (
          <span style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
            {paket.einzelpreis.toLocaleString('de-DE')} €{paket.wiederkehrend ? ' / Monat' : ''}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        <input
          style={feldStil}
          placeholder="Rechnungsempfänger"
          value={entwurf.rechnung_firma}
          onChange={(e) => setEntwurf((v) => ({ ...v, rechnung_firma: e.target.value }))}
          onBlur={() => feldFertig('rechnung_firma')}
        />
        <input
          style={feldStil}
          placeholder="Straße und Hausnummer"
          value={entwurf.rechnung_strasse}
          onChange={(e) => setEntwurf((v) => ({ ...v, rechnung_strasse: e.target.value }))}
          onBlur={() => feldFertig('rechnung_strasse')}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6 }}>
          <input
            style={feldStil}
            placeholder="PLZ"
            value={entwurf.rechnung_plz}
            onChange={(e) => setEntwurf((v) => ({ ...v, rechnung_plz: e.target.value }))}
            onBlur={() => feldFertig('rechnung_plz')}
          />
          <input
            style={feldStil}
            placeholder="Ort"
            value={entwurf.rechnung_ort}
            onChange={(e) => setEntwurf((v) => ({ ...v, rechnung_ort: e.target.value }))}
            onBlur={() => feldFertig('rechnung_ort')}
          />
        </div>
        <input
          style={feldStil}
          type="email"
          placeholder="Rechnungs-E-Mail (optional, oft die Buchhaltung)"
          value={entwurf.rechnung_email}
          onChange={(e) => setEntwurf((v) => ({ ...v, rechnung_email: e.target.value }))}
          onBlur={() => feldFertig('rechnung_email')}
        />
        <select style={feldStil} value={gewaehlt} onChange={(e) => setGewaehlt(e.target.value)}>
          {pakete.map((p) => (
            <option key={p.schluessel} value={p.schluessel}>
              {p.titel} · {p.einzelpreis.toLocaleString('de-DE')} €
            </option>
          ))}
        </select>
        {/* Nur beim Retainer: dort steht die Leistung fuer einen Monat, und ohne
            Angabe traegt die Rechnung das Rechnungsdatum. Beim Festpreis ist
            genau das richtig — deshalb kein Feld, das leer bleiben will. */}
        {paket?.wiederkehrend ? (
          <input
            style={feldStil}
            placeholder="Leistungszeitraum, z. B. September 2026"
            value={zeitraum}
            onChange={(e) => setZeitraum(e.target.value)}
          />
        ) : null}
      </div>

      <button
        type="button"
        className="ck-btn"
        disabled={!vollstaendig || laeuft || !paket}
        onClick={() => void ausloesen(false)}
        title={vollstaendig ? undefined : 'Anschrift fehlt noch'}
      >
        {laeuft ? 'Erstellt …' : 'Rechnung erstellen'}
      </button>

      {nachfrage ? (
        <div style={{ fontSize: 12, color: 'var(--ck-text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>{nachfrage}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="ck-btn" onClick={() => void ausloesen(true)}>
              Trotzdem erstellen
            </button>
            <button type="button" className="ck-btn" onClick={() => setNachfrage(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}

      {fertig ? (
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: 'var(--ck-text-1)' }}>
            {fertig.rechnungsnummer} · {Number(fertig.brutto).toLocaleString('de-DE')} €
          </span>
          {rechnungsUrl(fertig.dateiname) ? (
            <a
              href={rechnungsUrl(fertig.dateiname) as string}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--ck-accent-text)' }}
            >
              PDF öffnen und QR zeigen
            </a>
          ) : null}
        </div>
      ) : null}

      {fehler ? <span style={{ fontSize: 12, color: 'var(--ck-warn, #d98)' }}>{fehler}</span> : null}
    </section>
  )
}
