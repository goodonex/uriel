import { useState } from 'react'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import { pruefLink, trennePruefHinweis } from '../../lib/erstnachrichtenPruefung'

/**
 * Stufe 0 „Prüfen" (01.10.2026): die Erstnachrichten mit PRÜFEN-Hinweis oder
 * ohne Website. Kevin schaut selbst nach (Website offen, sonst Google), setzt
 * den Haken, und der Text rückt in die Erstnachrichten-Stufe, wo er blind
 * rausgeht. Wer nicht passt, wird aussortiert.
 */
function PruefKarte({
  lead,
  onGeprueft,
  onAussortiert,
}: {
  lead: Erstnachricht
  onGeprueft: () => void
  onAussortiert: () => void
}) {
  const [textOffen, setTextOffen] = useState(false)
  const { firma, hinweis } = trennePruefHinweis(lead.firma)
  const ziel = pruefLink(lead)

  return (
    <section className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-text-1)' }}>{lead.name}</span>
        {firma ? <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}> · {firma}</span> : null}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-warn)' }}>
        {hinweis || 'Keine Website hinterlegt. Selbst nachsehen, ob es eine gibt.'}
      </div>

      <button
        type="button"
        className="ck-btn"
        style={{ fontSize: 11, alignSelf: 'flex-start', color: 'var(--ck-text-3)' }}
        aria-expanded={textOffen}
        onClick={() => setTextOffen((v) => !v)}
      >
        {textOffen ? 'Text ausblenden' : 'Text ansehen'}
      </button>
      {textOffen ? (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--ck-text-2)',
            whiteSpace: 'pre-wrap',
            background: 'var(--ck-panel-2)',
            borderRadius: 'var(--ck-radius-innen)',
            padding: 12,
          }}
        >
          {lead.nachricht}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a
          href={ziel.href}
          target="_blank"
          rel="noreferrer"
          className="ck-btn ck-btn--primary"
          style={{ fontSize: 11, minHeight: 40, paddingInline: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        >
          {ziel.label} ↗
        </a>
        <button type="button" className="ck-btn" style={{ fontSize: 11, minHeight: 40, paddingInline: 16 }} onClick={onGeprueft}>
          Geprüft, Text passt
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ fontSize: 11, minHeight: 40, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
          title="Der Text geht nicht raus"
          onClick={onAussortiert}
        >
          Aussortieren
        </button>
      </div>
    </section>
  )
}

export function PruefListe({
  leads,
  onGeprueft,
  onAussortiert,
}: {
  leads: Erstnachricht[]
  onGeprueft: (id: string) => void
  onAussortiert: (id: string) => void
}) {
  if (leads.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--ck-text-2)', lineHeight: 1.55 }}>
        Nichts zu prüfen. Alle Texte in den Erstnachrichten können blind raus.
      </p>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, color: 'var(--ck-text-2)', lineHeight: 1.55 }}>
        Diese {leads.length} Texte stehen erst bei den Erstnachrichten, wenn du die Seite selbst angesehen hast.
      </p>
      {leads.map((l) => (
        <PruefKarte key={l.id} lead={l} onGeprueft={() => onGeprueft(l.id)} onAussortiert={() => onAussortiert(l.id)} />
      ))}
    </div>
  )
}
