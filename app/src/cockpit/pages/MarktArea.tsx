import { useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { useWettbewerber, useWettbewerberReferenzen, type WettbewerberFelder } from '../../hooks/useWettbewerber'
import { useActiveBrand } from '../lib/activeBrand'
import {
  domainAusLink,
  namensVorschlag,
  QUELLE_LABEL,
  QUELLEN,
  STATUS,
  STATUS_LABEL,
  TYP_LABEL,
  TYPEN,
  type ReferenzQuelle,
  type Wettbewerber,
  type WettbewerberStatus,
  type WettbewerberTyp,
} from '../lib/markt'

/**
 * Marktkarte, Phase 1 (03.10.2026): Konkurrenz-Agenturen als Liste, ein Link
 * reicht zum Anlegen, an jedem Eintrag hängen Referenzkunden. Tabellen
 * `wettbewerber*` (Migration 0097). Plan: docs/MARKTKARTE-PLAN.md.
 *
 * Bewusst schlank: kein Lauf im Hintergrund, keine Auswertung — das sind
 * spätere Phasen. Hier wird eingesammelt und von Hand gepflegt.
 */
export function MarktArea() {
  const { activeBrand } = useActiveBrand()
  const q = useWettbewerber(activeBrand?.slug)
  return (
    <Routes>
      <Route index element={<MarktListe q={q} />} />
      <Route path=":id" element={<MarktDetail q={q} brandSlug={activeBrand?.slug} />} />
    </Routes>
  )
}

type Q = ReturnType<typeof useWettbewerber>

function Fehlend() {
  return (
    <div className="ck-panel" style={{ padding: 14, fontSize: 13, color: 'var(--ck-text-2)', lineHeight: 1.5 }}>
      Die Tabellen für die Marktkarte gibt es in der Datenbank noch nicht. Sobald die Migration eingespielt ist, erscheint hier
      die Liste.
    </div>
  )
}

function MarktListe({ q }: { q: Q }) {
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [quelle, setQuelle] = useState('')
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const einwerfen = async () => {
    const domain = domainAusLink(link)
    if (!domain) {
      setHinweis('Das sieht nicht nach einer Webadresse aus.')
      return
    }
    setHinweis(null)
    setBusy(true)
    const neu = await q.anlegen({ domain, name: namensVorschlag(domain), quelle: quelle.trim() || link.trim() })
    setBusy(false)
    if (neu) {
      setLink('')
      setQuelle('')
      navigate(`/markt/${neu.id}`)
    }
  }

  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Markt</div>
        <div style={{ fontSize: 12, color: 'var(--ck-text-3)', marginTop: 2 }}>
          Wettbewerber und ihre Referenzkunden. Link einwerfen, den Rest pflegst du im Eintrag.
        </div>
      </div>

      <form
        className="ck-panel"
        style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
        onSubmit={(e) => {
          e.preventDefault()
          void einwerfen()
        }}
      >
        <label htmlFor="markt-link" style={{ fontSize: 13, fontWeight: 600 }}>
          Link einwerfen
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            id="markt-link"
            className="ck-input"
            style={{ flex: '2 1 220px', minWidth: 0 }}
            placeholder="realagency.at oder ganzer Link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <input
            className="ck-input"
            style={{ flex: '1 1 160px', minWidth: 0 }}
            placeholder="Wo gefunden (optional)"
            aria-label="Wo gefunden"
            value={quelle}
            onChange={(e) => setQuelle(e.target.value)}
          />
          <button type="submit" className="ck-btn ck-btn--primary" disabled={busy || !link.trim() || q.tableMissing}>
            Anlegen
          </button>
        </div>
        {hinweis || q.error ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{hinweis ?? q.error}</div> : null}
      </form>

      {q.tableMissing ? (
        <Fehlend />
      ) : q.loading ? (
        <div style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Lädt …</div>
      ) : q.items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>Noch kein Wettbewerber. Wirf oben den ersten Link ein.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.items.map((w) => (
            <li key={w.id}>
              <Link
                to={`/markt/${w.id}`}
                className="ck-panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 14px',
                  textDecoration: 'none',
                  color: 'inherit',
                  minHeight: 44,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-text-1)' }}>{w.name || w.domain}</span>
                  <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
                    {' · '}
                    {w.domain}
                    {' · '}
                    {TYP_LABEL[w.typ]}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: w.status === 'neu' ? 'var(--ck-accent)' : 'var(--ck-text-3)', flexShrink: 0 }}>
                  {STATUS_LABEL[w.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Textfeld, das beim Verlassen speichert (nur wenn sich der Wert geändert hat). */
function Feld(props: FeldProps) {
  // Neuer Wert von außen (z. B. nach Neuladen) → Feld frisch aufsetzen.
  return <FeldInnen key={props.wert} {...props} />
}

interface FeldProps {
  label: string
  wert: string
  onSpeichern: (v: string) => void
  mehrzeilig?: boolean
}

function FeldInnen({
  label,
  wert,
  onSpeichern,
  mehrzeilig,
}: {
  label: string
  wert: string
  onSpeichern: (v: string) => void
  mehrzeilig?: boolean
}) {
  const [text, setText] = useState(wert)
  const speichern = () => {
    if (text !== wert) onSpeichern(text)
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ck-text-3)' }}>
      {label}
      {mehrzeilig ? (
        <textarea
          className="ck-input"
          rows={6}
          style={{ resize: 'vertical', lineHeight: 1.5 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={speichern}
        />
      ) : (
        <input className="ck-input" value={text} onChange={(e) => setText(e.target.value)} onBlur={speichern} />
      )}
    </label>
  )
}

function MarktDetail({ q, brandSlug }: { q: Q; brandSlug: string | undefined }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const w = q.items.find((x) => x.id === id)

  if (q.loading) return <div style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Lädt …</div>
  if (!w) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>Diesen Eintrag gibt es nicht (mehr).</div>
        <Link to="/markt" className="ck-btn">
          Zurück zur Liste
        </Link>
      </div>
    )
  }

  const setze = (felder: WettbewerberFelder) => void q.aendern(w.id, felder)

  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <Link to="/markt" style={{ fontSize: 12, color: 'var(--ck-text-3)', textDecoration: 'none' }}>
          ← Markt
        </Link>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{w.name || w.domain}</div>
        <a
          href={`https://${w.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--ck-accent)' }}
        >
          {w.domain}
        </a>
      </div>

      {q.error ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{q.error}</div> : null}

      <section className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Stammdaten">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Feld label="Name" wert={w.name} onSpeichern={(v) => setze({ name: v })} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ck-text-3)' }}>
            Typ
            <select
              className="ck-select"
              value={w.typ}
              onChange={(e) => setze({ typ: e.target.value as WettbewerberTyp })}
            >
              {TYPEN.map((t) => (
                <option key={t} value={t}>
                  {TYP_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ck-text-3)' }}>
            Status
            <select
              className="ck-select"
              value={w.status}
              onChange={(e) => setze({ status: e.target.value as WettbewerberStatus })}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ck-text-3)' }}>
            Kundengewinnung sichtbar
            <select
              className="ck-select"
              value={w.kundengewinnung === null ? '' : w.kundengewinnung ? 'ja' : 'nein'}
              onChange={(e) => setze({ kundengewinnung: e.target.value === '' ? null : e.target.value === 'ja' })}
            >
              <option value="">Noch nicht geprüft</option>
              <option value="ja">Ja</option>
              <option value="nein">Nein</option>
            </select>
          </label>
        </div>
        <Feld label="Zielgruppe" wert={w.zielgruppe} onSpeichern={(v) => setze({ zielgruppe: v })} />
        <Feld label="Einstiegsangebot / Preis" wert={w.einstiegsangebot} onSpeichern={(v) => setze({ einstiegsangebot: v })} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Feld label="Instagram" wert={w.instagram} onSpeichern={(v) => setze({ instagram: v })} />
          <Feld label="LinkedIn" wert={w.linkedin} onSpeichern={(v) => setze({ linkedin: v })} />
          <Feld label="Wo gefunden" wert={w.quelle} onSpeichern={(v) => setze({ quelle: v })} />
        </div>
        <Feld label="Notizen" wert={w.notizen} onSpeichern={(v) => setze({ notizen: v })} mehrzeilig />
      </section>

      <Referenzen brandSlug={brandSlug} wettbewerber={w} />

      <div>
        <button
          type="button"
          className="ck-btn"
          onClick={() => {
            if (window.confirm(`„${w.name || w.domain}" mit allen Referenzen löschen?`)) {
              void q.loeschen(w.id).then(() => navigate('/markt'))
            }
          }}
        >
          Eintrag löschen
        </button>
      </div>
    </div>
  )
}

function Referenzen({ brandSlug, wettbewerber }: { brandSlug: string | undefined; wettbewerber: Wettbewerber }) {
  const r = useWettbewerberReferenzen(brandSlug, wettbewerber.id)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [quelle, setQuelle] = useState<ReferenzQuelle>('referenzseite')
  const [tiefe, setTiefe] = useState(0)

  const hinzufuegen = async () => {
    const d = domain.trim() ? domainAusLink(domain) : ''
    if (d === null) return
    if (!name.trim() && !d) return
    const ok = await r.anlegen({ kunde_name: name.trim(), kunde_domain: d, quelle, tiefe })
    if (ok) {
      setName('')
      setDomain('')
    }
  }

  return (
    <section className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Referenzen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Referenzkunden</span>
        <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>{r.items.length}</span>
      </div>
      {r.error ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{r.error}</div> : null}

      {r.loading ? (
        <div style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>Lädt …</div>
      ) : r.items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--ck-text-2)' }}>Noch keine Referenzen eingetragen.</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {r.items.map((x) => (
            <li
              key={x.id}
              style={{
                background: 'var(--ck-panel-2)',
                borderRadius: 'var(--ck-radius-innen)',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ minWidth: 0, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{x.kunde_name || x.kunde_domain}</span>
                {x.kunde_name && x.kunde_domain ? (
                  <span style={{ color: 'var(--ck-text-3)' }}> · {x.kunde_domain}</span>
                ) : null}
                <span style={{ color: 'var(--ck-text-3)' }}>
                  {' · '}
                  {QUELLE_LABEL[x.quelle]}
                  {x.tiefe > 0 ? ` · Stufe ${x.tiefe}` : ''}
                </span>
              </span>
              <button
                type="button"
                className="ck-btn"
                style={{ minHeight: 36 }}
                onClick={() => void r.loeschen(x.id)}
                aria-label={`Referenz ${x.kunde_name || x.kunde_domain} entfernen`}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault()
          void hinzufuegen()
        }}
      >
        <input
          className="ck-input"
          style={{ flex: '1 1 150px', minWidth: 0 }}
          placeholder="Kunde (Name)"
          aria-label="Name des Kunden"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="ck-input"
          style={{ flex: '1 1 150px', minWidth: 0 }}
          placeholder="Domain (optional)"
          aria-label="Domain des Kunden"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
        />
        <select
          className="ck-select"
          aria-label="Quelle der Referenz"
          value={quelle}
          onChange={(e) => setQuelle(e.target.value as ReferenzQuelle)}
        >
          {QUELLEN.map((s) => (
            <option key={s} value={s}>
              {QUELLE_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="ck-select"
          aria-label="Tiefe"
          value={tiefe}
          onChange={(e) => setTiefe(Number(e.target.value))}
        >
          <option value={0}>Direkt</option>
          <option value={1}>Stufe 1</option>
          <option value={2}>Stufe 2</option>
        </select>
        <button type="submit" className="ck-btn ck-btn--primary" disabled={!name.trim() && !domain.trim()}>
          Hinzufügen
        </button>
      </form>
    </section>
  )
}
