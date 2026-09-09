import type { Contact } from '../types/db'
import { RechnungPanel } from '../cockpit/components/sales/RechnungPanel'

/**
 * Dev-Vorschau (nur DEV, ohne Login): das Rechnungs-Panel am Lead.
 *
 * Ohne diese Seite wäre das Panel nur mit Session und an einem echten Lead zu
 * sehen — und der interessanteste Zustand (Anschrift fehlt, Knopf gesperrt)
 * ließe sich nur herstellen, indem man einen echten Kontakt leerräumt.
 * Gleiches Muster wie `SalesVorschau` und `RundeVorschau`.
 *
 * **Was diese Seite ausdrücklich nicht tut:** eine Rechnung erstellen. Der
 * Knopf ruft den echten Runner, und jeder Lauf verbraucht eine fortlaufende
 * Nummer. Hier wird die Oberfläche geprüft, nicht der Nummernkreis — für den
 * Weg bis ins PDF gibt es `scripts/verify-rechnung.ts` und einen Lauf gegen
 * eine Kopie der Maschine (`RECHNUNG_ROOT`).
 */

function lead(patch: Partial<Contact>): Contact {
  return {
    id: 'vorschau',
    name: 'Roman M. Mainka',
    company: 'MAINKA Real Estate',
    email: 'kontakt@mainka-immobilien.de',
    pipeline_stage: 'deal',
    rechnung_firma: '',
    rechnung_strasse: '',
    rechnung_plz: '',
    rechnung_ort: '',
    rechnung_email: '',
    ...patch,
  } as unknown as Contact
}

const LEER = lead({})
const VOLL = lead({
  rechnung_firma: 'MAINKA Real Estate GmbH',
  rechnung_strasse: 'Kaiserstraße 12',
  rechnung_plz: '60311',
  rechnung_ort: 'Frankfurt am Main',
  rechnung_email: 'buchhaltung@mainka-immobilien.de',
})

export function RechnungVorschau() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24 }}>
      <h1 style={{ color: 'var(--ck-text-1)', fontSize: 18, marginBottom: 4 }}>Rechnungs-Panel — Vorschau</h1>
      <p style={{ color: 'var(--ck-text-2)', fontSize: 12.5, marginTop: 0, marginBottom: 20 }}>
        Links frisch vom LinkedIn-Lead (Anschrift fehlt, Knopf gesperrt), rechts nach dem Call ausgefüllt. Der
        Leistungszeitraum erscheint erst, wenn ein Retainer gewählt ist. <strong>Nicht auf „Rechnung erstellen"
        drücken</strong> — das zieht eine echte Nummer.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, maxWidth: 900 }}>
        <RechnungPanel contact={LEER} onSpeichern={() => {}} />
        <RechnungPanel contact={VOLL} onSpeichern={() => {}} />
      </div>
    </div>
  )
}
