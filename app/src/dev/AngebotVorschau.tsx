import { useState } from 'react'
import { AngebotAnsicht } from '../pages/public/AngebotPublicPage'
import type { OeffentlichesAngebot } from '../cockpit/lib/angebotApi'

/**
 * Dev-Vorschau (nur DEV, ohne Login): die Seite, die der Makler sieht.
 *
 * Diese Seite ist die einzige im Projekt, die ein Fremder zu Gesicht bekommt —
 * und ohne diese Vorschau wäre sie nur mit einem echten Token an einem echten
 * verschickten Angebot zu betrachten. Alle vier Zustände nebeneinander, damit
 * der abgelaufene nicht erst auffällt, wenn er einem Kunden begegnet.
 *
 * **Sie unterschreibt nichts.** Der Knopf setzt hier nur den lokalen Zustand;
 * die echte Unterschrift geht durch die Edge Function und ist unumkehrbar.
 */

const BASIS: OeffentlichesAngebot = {
  titel: 'Eigentümer-Funnel',
  beschreibung:
    'Branding, Website, Landingpage, Werbekonto und Kampagnen-Setup. Festpreis, Umsetzung in 30 Tagen ab Freigabe.',
  betrag: 5000,
  retainer_titel: 'Kampagne + Nachfassen',
  retainer_betrag: 2000,
  gueltig_bis: '2026-10-05',
  status: 'versendet',
  signiert_am: null,
  signiert_name: null,
  firma: 'HERRMANN & CO.',
  empfaenger: 'MAINKA Real Estate',
}

const ZUSTAENDE: { titel: string; angebot: OeffentlichesAngebot | null }[] = [
  { titel: 'Offen — der Normalfall', angebot: BASIS },
  { titel: 'Ohne Retainer', angebot: { ...BASIS, retainer_titel: null, retainer_betrag: null } },
  {
    titel: 'Unterschrieben',
    angebot: {
      ...BASIS,
      status: 'signiert',
      signiert_am: '2026-09-20T14:12:00.000Z',
      signiert_name: 'Roman M. Mainka',
    },
  },
  { titel: 'Abgelaufen', angebot: { ...BASIS, status: 'abgelaufen', gueltig_bis: '2026-09-01' } },
  { titel: 'Gibt es nicht', angebot: null },
]

export function AngebotVorschau() {
  const [welcher, setWelcher] = useState(0)
  const [sendet, setSendet] = useState(false)
  const zustand = ZUSTAENDE[welcher]

  return (
    <div style={{ minHeight: '100dvh', background: '#060b1c' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: 12,
          background: '#0A1128',
          borderBottom: '1px solid rgba(197, 160, 89, 0.2)',
        }}
      >
        {ZUSTAENDE.map((z, i) => (
          <button
            key={z.titel}
            type="button"
            onClick={() => setWelcher(i)}
            style={{
              minHeight: 34,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(197, 160, 89, 0.25)',
              background: i === welcher ? '#C5A059' : 'transparent',
              color: i === welcher ? '#0A1128' : '#a3adc4',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {z.titel}
          </button>
        ))}
      </div>
      <AngebotAnsicht
        angebot={zustand.angebot}
        laedt={false}
        sendet={sendet}
        fehler={null}
        onSignieren={() => {
          setSendet(true)
          window.setTimeout(() => setSendet(false), 600)
        }}
      />
    </div>
  )
}
