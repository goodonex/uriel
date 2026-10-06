import { useState } from 'react'
import type { AnfrageStatus, AnfrageZeile, AnfragenAufteilung } from '../../lib/anfragenAnDich'
import { inZwischenablage } from '../../lib/zwischenablage'

/**
 * „Anfragen an dich" (06.10.2026): wer aus Kevins Zielgruppe ihn von sich aus
 * angefragt hat, mit vorbereitetem Text. Kevin nimmt auf LinkedIn selbst an,
 * kopiert den Text, schickt ihn und hakt hier ab. Uriel klickt auf LinkedIn
 * nichts.
 *
 * Reine Ansicht: Daten und Aktionen kommen von außen, damit sie sich ohne
 * Datenbank ansehen lässt.
 */
export function AnfragenAnDich({
  aufteilung,
  fehler,
  onStatus,
}: {
  aufteilung: AnfragenAufteilung
  fehler?: string | null
  onStatus: (id: string, status: AnfrageStatus) => void
}) {
  const [zuletzt, setZuletzt] = useState<{ id: string; name: string; status: AnfrageStatus } | null>(null)
  const { offen, ausgeblendet } = aufteilung

  const setze = (a: AnfrageZeile, status: AnfrageStatus) => {
    onStatus(a.id, status)
    setZuletzt({ id: a.id, name: a.name, status })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ck-text-2)' }}>
        Sie kamen auf dich zu. Auf LinkedIn annehmen, Text kopieren und schicken, dann hier abhaken.
      </p>

      {fehler ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{fehler}</div> : null}

      {zuletzt ? (
        <div
          role="status"
          style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ck-text-3)', minHeight: 32 }}
        >
          <span>
            {zuletzt.name} {zuletzt.status === 'gesendet' ? 'als gesendet abgehakt' : 'verworfen'}
          </span>
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 11, minHeight: 32, paddingInline: 12 }}
            onClick={() => {
              onStatus(zuletzt.id, 'offen')
              setZuletzt(null)
            }}
          >
            Rückgängig
          </button>
        </div>
      ) : null}

      {offen.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ck-text-3)' }}>
          Gerade wartet niemand aus deiner Zielgruppe auf eine Antwort.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {offen.map((a) => (
            <AnfrageKarte key={a.id} anfrage={a} onStatus={(s) => setze(a, s)} />
          ))}
        </ul>
      )}

      {ausgeblendet.length > 0 ? (
        <details>
          <summary
            style={{ fontSize: 12, color: 'var(--ck-text-3)', cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}
          >
            {ausgeblendet.length} {ausgeblendet.length === 1 ? 'weitere Anfrage' : 'weitere Anfragen'}, nicht deine Zielgruppe
          </summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ausgeblendet.map((a) => (
              <li
                key={a.id}
                style={{
                  background: 'var(--ck-panel-2)',
                  borderRadius: 'var(--ck-radius-innen)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <a
                    href={a.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--ck-text-1)', textDecoration: 'none' }}
                  >
                    {a.name} ↗
                  </a>
                  {a.headline ? <div style={{ fontSize: 12, color: 'var(--ck-text-3)', overflowWrap: 'anywhere' }}>{a.headline}</div> : null}
                  <div style={{ fontSize: 12, color: 'var(--ck-text-2)', marginTop: 2 }}>
                    {a.ausgeblendet_grund ?? 'Nicht deine Zielgruppe laut Profil'}
                  </div>
                </div>
                <button
                  type="button"
                  className="ck-btn"
                  style={{ fontSize: 11, minHeight: 36, paddingInline: 12, color: 'var(--ck-text-3)', flexShrink: 0 }}
                  onClick={() => setze(a, 'verworfen')}
                >
                  Weg
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

function AnfrageKarte({ anfrage: a, onStatus }: { anfrage: AnfrageZeile; onStatus: (s: AnfrageStatus) => void }) {
  const [kopiert, setKopiert] = useState<'ja' | 'nein' | null>(null)
  const firma = a.firma || a.headline

  return (
    <li
      style={{
        background: 'var(--ck-panel-2)',
        borderRadius: 'var(--ck-radius-innen)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-text-1)' }}>{a.name}</span>
          {firma ? (
            <div style={{ fontSize: 12, color: 'var(--ck-text-3)', marginTop: 2, overflowWrap: 'anywhere' }}>{firma}</div>
          ) : null}
        </div>
        <span style={{ fontSize: 11, color: a.angenommen ? 'var(--ck-accent)' : 'var(--ck-text-3)', flexShrink: 0 }}>
          {a.angenommen ? 'schon angenommen' : seitText(a.eingegangen_at)}
        </span>
      </div>

      {a.notiz ? (
        <div>
          <div className="ck-label" style={{ marginBottom: 4 }}>
            Notiz zur Anfrage
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ck-text-2)', whiteSpace: 'pre-wrap' }}>{a.notiz}</p>
        </div>
      ) : null}

      {a.entwurf ? (
        <div>
          <div className="ck-label" style={{ marginBottom: 4 }}>
            Dein Text
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--ck-text-1)',
              whiteSpace: 'pre-wrap',
              background: 'var(--ck-card)',
              border: '1px solid var(--ck-card-border)',
              borderRadius: 'var(--ck-radius-innen)',
              padding: 12,
            }}
          >
            {a.entwurf}
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ck-text-3)' }}>
          {a.entwurf_versuche >= 3
            ? 'Hier kam kein Text zustande. Schreib ihm kurz selbst.'
            : 'Der Text wird vorbereitet. Der Mini schreibt ihn beim nächsten Lauf.'}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={a.profile_url}
          target="_blank"
          rel="noreferrer"
          className="ck-btn"
          style={{ fontSize: 11, minHeight: 40, paddingInline: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          Profil öffnen ↗
        </a>
        {a.entwurf ? (
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 11, minHeight: 40, paddingInline: 14 }}
            onClick={async () => {
              const ok = await inZwischenablage(a.entwurf ?? '')
              setKopiert(ok ? 'ja' : 'nein')
              window.setTimeout(() => setKopiert(null), 2000)
            }}
          >
            {kopiert === 'ja' ? 'Kopiert' : kopiert === 'nein' ? 'Kopieren ging nicht' : 'Text kopieren'}
          </button>
        ) : null}
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          style={{ fontSize: 11, minHeight: 40, paddingInline: 14 }}
          onClick={() => onStatus('gesendet')}
        >
          Angenommen & gesendet
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ fontSize: 11, minHeight: 40, paddingInline: 14, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
          title="Kein Text von dir nötig. Verschwindet aus der Liste."
          onClick={() => onStatus('verworfen')}
        >
          Verwerfen
        </button>
      </div>
    </li>
  )
}

/** „heute", „gestern", „vor 3 Tagen" — LinkedIn nennt kein Datum, das hier ist der erste Sichttag. */
function seitText(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const tage = Math.floor((Date.now() - t) / 86_400_000)
  if (tage <= 0) return 'heute'
  if (tage === 1) return 'gestern'
  return `vor ${tage} Tagen`
}
