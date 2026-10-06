import { useState } from 'react'
import { AnfragenAnDich } from '../cockpit/components/sales/AnfragenAnDich'
import { TagesListe } from '../cockpit/components/sales/TagesListe'
import { anfragenZeilenText, teileAnfragen, type Anfrage, type AnfrageStatus } from '../cockpit/lib/anfragenAnDich'
import type { FlowZeileDef } from '../cockpit/pages/SalesDashboard'

/**
 * Dev-Vorschau (nur DEV, ohne Login): „Anfragen an dich" mit erfundenen
 * Anfragen — die Zeile in der Tagesliste (auch im Fehlerfall) und die Liste
 * dahinter. Gleiches Muster wie `CoachVorschau`. Die Logik prüft
 * `scripts/verify-anfragen-an-dich.ts`.
 */

const vor = (stunden: number) => new Date(Date.now() - stunden * 3_600_000).toISOString()

const basis: Omit<Anfrage, 'id' | 'profil_key' | 'name'> = {
  headline: '',
  profile_url: 'https://www.linkedin.com/in/beispiel/',
  notiz: '',
  gemeinsame: '',
  eingegangen_at: vor(3),
  nicht_mehr_da_at: null,
  icp_urteil: 'kern',
  icp_grund: 'immobilienmakler',
  ausgeblendet_grund: null,
  firma: '',
  website: '',
  entwurf: null,
  entwurf_at: null,
  entwurf_versuche: 0,
  status: 'offen',
  status_at: null,
}

const START: Anfrage[] = [
  {
    ...basis,
    id: '1',
    profil_key: 'jana-beispiel',
    name: 'Jana Beispiel',
    headline: 'Immobilienmaklerin | Inhaberin Beispiel Immobilien Kiel',
    firma: 'Beispiel Immobilien',
    notiz: 'Hi Kevin, ich lese deine Posts zu Eigentümer-Leads seit ein paar Wochen mit. Würde mich gern vernetzen.',
    entwurf: 'Moin Jana,\n\ndanke für die Anfrage. Freut mich, dass die Posts bei dir ankommen.\n\nWas davon trifft bei euch in Kiel gerade einen Nerv?',
    entwurf_versuche: 1,
  },
  {
    ...basis,
    id: '2',
    profil_key: 'thomas-probe',
    name: 'Thomas Probe',
    headline: 'Geschäftsführer bei Probe & Partner Immobilien GmbH',
    firma: 'Probe & Partner Immobilien',
    eingegangen_at: vor(30),
    entwurf:
      'Moin Thomas,\n\ndanke für deine Anfrage. Hab gesehen, dass ihr bei Mehrfamilienhäusern im Ruhrgebiet seit über zwanzig Jahren unterwegs seid.\n\nWas hat dich zu mir geführt?',
    entwurf_versuche: 1,
  },
  { ...basis, id: '3', profil_key: 'lena-test', name: 'Lena Test', headline: 'Immobilienberaterin bei Test Immobilien', eingegangen_at: vor(1) },
  {
    ...basis,
    id: '4',
    profil_key: 'carl-coach',
    name: 'Carl Coach',
    headline: 'Business Coach für Immobilienmakler',
    icp_urteil: 'off',
    icp_grund: 'coach für immobilienmakler',
    ausgeblendet_grund: 'Nicht deine Zielgruppe laut Profil („coach für immobilienmakler")',
  },
  { ...basis, id: '5', profil_key: 'dora-gesendet', name: 'Dora Gesendet', status: 'gesendet', status_at: vor(1) },
]

const ruhig = (titel: string, kennzahl: string, nummer: number): FlowZeileDef => ({
  id: titel,
  titel,
  nummer,
  zustand: 'offen',
  kennzahl,
})

export function AnfragenVorschau() {
  const [items, setItems] = useState(START)
  const aufteilung = teileAnfragen(items, { threads: [], netzwerk: [{ profil_key: 'thomas-probe', status: 'angenommen' }] })
  const onStatus = (id: string, status: AnfrageStatus) =>
    setItems((cur) => cur.map((a) => (a.id === id ? { ...a, status, status_at: status === 'offen' ? null : new Date().toISOString() } : a)))

  const zeile = (t: ReturnType<typeof anfragenZeilenText>): FlowZeileDef => ({
    id: 'anfragen-an-dich',
    titel: 'Anfragen an dich',
    zustand: t.zustand,
    kennzahl: t.kennzahl,
    kennzahlFarbe: t.warnung ? 'var(--ck-warn)' : undefined,
    unterzeile: t.unterzeile,
  })
  const rest = [ruhig('Vernetzungsanfragen', '12 von 30', 1), ruhig('Erstnachrichten · LinkedIn', '4 von 20', 2)]
  const ok = zeile(anfragenZeilenText({ laedt: false, tabelleFehlt: false, fehler: null, aufteilung }))
  const kaputt = zeile(anfragenZeilenText({ laedt: false, tabelleFehlt: false, fehler: 'JWT expired', aufteilung: null }))

  return (
    <div className="ck-root" style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 16, pointerEvents: 'auto' }}>
      <div style={{ width: 'min(1100px, 100%)', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ck-label">Tagesliste</div>
          <TagesListe zeilen={[ok, ...rest]} onOeffnen={() => {}} fortschritt={{ erledigt: 1, gesamt: 5 }} laedt={false} />
          <div className="ck-label">Wenn das Laden scheitert</div>
          {/* Eigene Kennungen: zwei Listen mit derselben `layoutId` geistern ineinander (HANDOFF, Falle 9). */}
          <TagesListe
            zeilen={[kaputt, ...rest].map((z) => ({ ...z, id: `fehler-${z.id}` }))}
            onOeffnen={() => {}}
            fortschritt={{ erledigt: 1, gesamt: 5 }}
            laedt={false}
          />
        </div>
        <div className="ck-panel" style={{ flex: '1 1 340px', maxWidth: 640, padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)', marginBottom: 12 }}>Anfragen an dich</div>
          <AnfragenAnDich aufteilung={aufteilung} onStatus={onStatus} />
        </div>
      </div>
    </div>
  )
}
