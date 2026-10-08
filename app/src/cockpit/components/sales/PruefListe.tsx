import { useState } from 'react'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import { pruefEingabe, pruefEingabeKurz, pruefLink, trennePruefHinweis } from '../../lib/erstnachrichtenPruefung'
import { inZwischenablage } from '../../lib/zwischenablage'
import { BeiClaude, ClaudeFeedback } from '../ClaudeFeedback'
import { useRundeTor } from '../RundeTor'

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
  onNeuPruefen,
  profil,
}: {
  lead: Erstnachricht
  /** LinkedIn-Profil aus dem Netzwerk, per Name zugeordnet (05.10.2026). */
  profil?: string
  onGeprueft: () => void
  onAussortiert: () => void
  onNeuPruefen: (url: string) => Promise<boolean>
}) {
  const [textOffen, setTextOffen] = useState(false)
  const [nameKopiert, setNameKopiert] = useState(false)
  const { stand, runnerWeg, starteMit } = useRundeTor()

  /**
   * Eine reine Website-Adresse geht wie bisher an den Mini, weil sie eine neue
   * Recherche braucht. Alles andere ist Feedback und landet bei Claude
   * (`ClaudeFeedback`, 08.10.2026).
   */
  const websiteAbfangen = async (text: string): Promise<boolean> => {
    const eingabe = pruefEingabe(text)
    if (eingabe?.art !== 'url') return false
    const ok = await onNeuPruefen(eingabe.wert)
    // Mit erreichbarem Mini sofort anstoßen; auf der Live-Seite wartet der Auftrag auf die nächste Runde.
    if (ok && !runnerWeg && stand && !stand.laeuft) starteMit({ nur: ['erstnachrichten'], anzahl: 1 })
    return ok
  }
  const { firma, hinweis } = trennePruefHinweis(lead.firma)
  const ziel = pruefLink(lead)

  return (
    <section className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        {/* Wie in der Arbeitsliste: Tipp auf den Namen kopiert ihn für die LinkedIn-Suche (Kevin, 05.10.2026). */}
        <button
          type="button"
          title={`${lead.name} kopieren`}
          onClick={() =>
            void inZwischenablage(lead.name).then((ok) => {
              if (!ok) return
              setNameKopiert(true)
              window.setTimeout(() => setNameKopiert(false), 2000)
            })
          }
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: 'var(--ck-text-1)' }}
        >
          {lead.name}
        </button>
        {nameKopiert ? <span style={{ fontSize: 12, color: 'var(--ck-accent)' }}> ✓ kopiert</span> : null}
        {firma ? <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}> · {firma}</span> : null}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-warn)' }}>
        {hinweis || 'Keine Website hinterlegt. Selbst nachsehen, ob es eine gibt.'}
      </div>

      {lead.pruef_url ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-accent)' }}>
          Wird mit {pruefEingabeKurz(lead.pruef_url)} neu geprüft. Der neue Text steht nach der nächsten Runde bei den Erstnachrichten (spätestens in ein paar Stunden).
        </div>
      ) : null}

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

      {lead.pruef_url ? null : (
        <ClaudeFeedback
          schluessel={`erstnachricht:${lead.id}`}
          eintrag={{ stufe: 'pruefen', name: lead.name, firma: firma || undefined, nachricht: lead.nachricht }}
          abfangen={websiteAbfangen}
        />
      )}

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
        {profil ? (
          <a
            href={profil}
            target="_blank"
            rel="noreferrer"
            className="ck-btn"
            style={{ fontSize: 11, minHeight: 40, paddingInline: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            LinkedIn ↗
          </a>
        ) : null}
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
  onNeuPruefen,
  profilVon,
}: {
  leads: Erstnachricht[]
  profilVon?: (name: string) => string | undefined
  onGeprueft: (id: string) => void
  onAussortiert: (id: string) => void
  onNeuPruefen: (id: string, url: string) => Promise<boolean>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <BeiClaude stufen={['pruefen']} />
      {leads.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--ck-text-2)', lineHeight: 1.55 }}>
          Nichts zu prüfen. Alle Texte in den Erstnachrichten können blind raus.
        </p>
      ) : (
        <p style={{ margin: 0, color: 'var(--ck-text-2)', lineHeight: 1.55 }}>
          Diese {leads.length} Texte stehen erst bei den Erstnachrichten, wenn du die Seite selbst angesehen hast.
          Was am Text nicht passt, gibst du an Claude.
        </p>
      )}
      {leads.map((l) => (
        <PruefKarte
          key={l.id}
          lead={l}
          profil={profilVon?.(l.name)}
          onGeprueft={() => onGeprueft(l.id)}
          onAussortiert={() => onAussortiert(l.id)}
          onNeuPruefen={(url) => onNeuPruefen(l.id, url)}
        />
      ))}
    </div>
  )
}
