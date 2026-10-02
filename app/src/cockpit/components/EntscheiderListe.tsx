import { useMemo, useState } from 'react'
import { useEntscheiderKandidaten } from '../../hooks/useEntscheiderKandidaten'
import { linkedinZiel, mitProfil, ohneProfil, type EntscheiderKandidat, type EntscheiderStatus } from '../lib/entscheider'
import { useActiveBrandOptional } from '../lib/activeBrand'
import { useAnfragenPause } from '../lib/useAnfragenPause'

/**
 * „Heute anfragen" — Geschäftsführer, die Kevin sich zuerst holen soll
 * (22.09.2026, „Entscheider zuerst").
 *
 * Der Runner legt sie an, wenn ein Angestellter derselben Firma in Kevins
 * Liste steht (Impressum nennt den GF, der Angestellte steht nicht drin). Die
 * Erstnachricht an den Angestellten ist so lange zurückgestellt. Kevin
 * vernetzt sich von Hand — hier gibt es nur den Weg zum Profil und zwei
 * Haken. Nichts wird an LinkedIn geschickt.
 *
 * Leer oder ohne Migration 0091 zeigt die Liste nichts: Sie steht unter dem
 * Anfragen-Zähler und soll dort nicht mit einem Hinweis Platz belegen.
 */
export function EntscheiderListe({ brandSlug }: { brandSlug?: string }) {
  const aktiv = useActiveBrandOptional()
  const q = useEntscheiderKandidaten(brandSlug ?? aktiv?.activeBrand?.slug)
  // Wochenlimit aufgebraucht: die Kandidaten bleiben offen, werden aber bis Montag nicht gezeigt.
  const { pausiert } = useAnfragenPause()
  if (pausiert || q.tableMissing || q.loading) return null
  return <EntscheiderListeAnsicht items={q.items} error={q.error} onStatus={(id, s) => void q.setzeStatus(id, s)} />
}

/** Die reine Ansicht — ohne Datenbank, damit sie sich mit Beispieldaten ansehen lässt. */
export function EntscheiderListeAnsicht({
  items,
  error,
  onStatus,
}: {
  items: EntscheiderKandidat[]
  error?: string | null
  onStatus: (id: string, status: EntscheiderStatus) => void
}) {
  const mit = useMemo(() => mitProfil(items), [items])
  const ohne = useMemo(() => ohneProfil(items), [items])
  if (!mit.length && !ohne.length) return null

  return (
    <>
      {mit.length ? (
        <Sektion
          titel="Heute anfragen"
          text="Geschäftsführer, deren LinkedIn-Profil gefunden ist. Erster Kontakt: vernetzen. Die Nachricht an ihre Mitarbeiter wartet, bis du hier entschieden hast."
          liste={mit}
          error={error}
          onStatus={onStatus}
          profilGefunden
        />
      ) : null}
      {ohne.length ? (
        <Sektion
          titel="Geschäftsführer suchen"
          text="Hier habe ich den Geschäftsführer nicht sicher auf LinkedIn gefunden oder im Impressum steht keiner. Schau selbst nach. Nach 14 Tagen ohne Annahme darf der Mitarbeiter doch angeschrieben werden."
          liste={ohne}
          error={mit.length ? null : error}
          onStatus={onStatus}
        />
      ) : null}
    </>
  )
}

function Sektion({
  titel,
  text,
  liste,
  error,
  onStatus,
  profilGefunden,
}: {
  titel: string
  text: string
  liste: EntscheiderKandidat[]
  error?: string | null
  onStatus: (id: string, status: EntscheiderStatus) => void
  profilGefunden?: boolean
}) {
  const [anzahl, setAnzahl] = useState(5)
  const sichtbar = liste.slice(0, anzahl)

  return (
    <section className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label={titel}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-text-1)' }}>{titel}</span>
        <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>{liste.length} offen</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--ck-text-2)' }}>{text}</p>

      {error ? <div style={{ fontSize: 11, color: 'var(--ck-warn)' }}>{error}</div> : null}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sichtbar.map((k) => (
          <li
            key={k.id}
            style={{
              background: 'var(--ck-panel-2)',
              borderRadius: 'var(--ck-radius-innen)',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-text-1)' }}>{k.gf_name}</span>
              {k.firma && k.suche_ergebnis !== 'unbekannt' ? <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}> · {k.firma}</span> : null}
              {k.grund ? <div style={{ fontSize: 12, color: 'var(--ck-text-2)', marginTop: 2 }}>{k.grund}</div> : null}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href={linkedinZiel(k)}
                target="_blank"
                rel="noreferrer"
                className={profilGefunden ? 'ck-btn ck-btn--primary' : 'ck-btn'}
                style={{ fontSize: 11, minHeight: 40, paddingInline: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                {k.linkedin_url ? 'Profil öffnen ↗' : 'Auf LinkedIn suchen ↗'}
              </a>
              <button type="button" className="ck-btn" style={{ fontSize: 11, minHeight: 40, paddingInline: 16 }} onClick={() => onStatus(k.id, 'angefragt')}>
                Angefragt
              </button>
              <button
                type="button"
                className="ck-btn"
                style={{ fontSize: 11, minHeight: 40, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
                title="Kommt nicht in Frage oder nicht auffindbar — der Mitarbeiter dieser Firma wird dann normal angeschrieben"
                onClick={() => onStatus(k.id, 'verworfen')}
              >
                {profilGefunden ? 'Verwerfen' : 'Nicht auffindbar'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {liste.length > sichtbar.length ? (
        <button type="button" className="ck-btn" style={{ fontSize: 10, alignSelf: 'flex-start' }} onClick={() => setAnzahl((n) => n + 5)}>
          5 weitere zeigen ({liste.length - sichtbar.length} übrig)
        </button>
      ) : null}
    </section>
  )
}
