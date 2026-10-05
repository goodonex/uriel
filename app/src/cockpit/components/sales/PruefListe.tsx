import { useState } from 'react'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import { pruefEingabe, pruefEingabeKurz, pruefLink, trennePruefHinweis } from '../../lib/erstnachrichtenPruefung'
import { feedbackLink, FEEDBACK_SCHLUESSEL, type FeedbackSammlung } from '../../lib/erstnachrichtenFeedback'
import { useUiSetting } from '../../lib/uiSettings'
import { inZwischenablage } from '../../lib/zwischenablage'
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
  feedback,
  onFeedback,
}: {
  lead: Erstnachricht
  /** Kevins gespeichertes Feedback zu diesem Text (05.10.2026), noch nicht abgearbeitet. */
  feedback?: string
  onFeedback: (text: string | null) => void
  /** LinkedIn-Profil aus dem Netzwerk, per Name zugeordnet (05.10.2026). */
  profil?: string
  onGeprueft: () => void
  onAussortiert: () => void
  onNeuPruefen: (url: string) => Promise<boolean>
}) {
  const [textOffen, setTextOffen] = useState(false)
  const [url, setUrl] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [sendet, setSendet] = useState(false)
  const [nameKopiert, setNameKopiert] = useState(false)
  const { stand, runnerWeg, starteMit } = useRundeTor()

  const schicke = async () => {
    const eingabe = pruefEingabe(url)
    if (!eingabe) {
      setFehler('Adresse (sellavie.ch) oder ein kurzer Satz, zum Beispiel: ist Geschäftsführer, Text passt nur beim Bild nicht')
      return
    }
    setFehler(null)
    /**
     * Ein Satz ist Feedback (Kevin, 05.10.2026): Er wird gesammelt und von
     * einer Session gebündelt abgearbeitet, statt je Lead den Mini anzustoßen.
     * Nur eine Adresse geht weiter an den Mini, weil sie eine neue Recherche braucht.
     */
    if (eingabe.art === 'hinweis') {
      onFeedback(url.trim().slice(0, 1500))
      setUrl('')
      return
    }
    setSendet(true)
    const ok = await onNeuPruefen(eingabe.wert)
    setSendet(false)
    if (!ok) {
      setFehler('Konnte nicht gespeichert werden')
      return
    }
    setUrl('')
    // Mit erreichbarem Mini sofort anstoßen; auf der Live-Seite wartet der Auftrag auf die nächste Runde.
    if (!runnerWeg && stand && !stand.laeuft) starteMit({ nur: ['erstnachrichten'], anzahl: 1 })
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

      {feedback ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-accent)', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>Dein Feedback: „{feedback}"</span>
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 11, color: 'var(--ck-text-3)' }}
            onClick={() => {
              setUrl(feedback)
              onFeedback(null)
            }}
          >
            Ändern
          </button>
        </div>
      ) : null}

      {lead.pruef_url ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-accent)' }}>
          Wird mit {pruefEingabeKurz(lead.pruef_url)} neu geprüft. Der neue Text steht nach der nächsten Runde bei den Erstnachrichten (spätestens in ein paar Stunden).
        </div>
      ) : (
        <form
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          onSubmit={(e) => {
            e.preventDefault()
            void schicke()
          }}
        >
          <input
            type="text"
                        autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setFehler(null)
            }}
            placeholder="Feedback zum Text oder die richtige Website"
            aria-label={`Feedback oder Website für ${lead.name}`}
            style={{
              flex: 1,
              minWidth: 200,
              minHeight: 40,
              padding: '0 12px',
              fontSize: 13,
              color: 'var(--ck-text-1)',
              background: 'var(--ck-panel-2)',
              border: '1px solid var(--ck-border-strong)',
              borderRadius: 'var(--ck-radius-innen)',
            }}
          />
          <button type="submit" className="ck-btn" style={{ fontSize: 11, minHeight: 40, paddingInline: 16 }} disabled={sendet || !url.trim()}>
            {sendet ? 'Speichert …' : 'Speichern'}
          </button>
        </form>
      )}
      {fehler ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{fehler}</div> : null}

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
  const { wert: sammlung, setzen: setzeSammlung } = useUiSetting<FeedbackSammlung>(FEEDBACK_SCHLUESSEL, {})
  // Nur Einträge zu Texten, die noch hier stehen: Abgearbeitete verlassen die Liste, ihr Eintrag zählt nicht mehr.
  const mitFeedback = leads.filter((l) => sammlung[l.id]?.text).length
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
        Was am Text nicht passt, schreibst du ins Feld. Am Ende schickst du alles gesammelt an Claude.
      </p>
      {mitFeedback > 0 ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a
            href={feedbackLink(mitFeedback)}
            className="ck-btn ck-btn--primary"
            style={{ fontSize: 11, minHeight: 40, paddingInline: 16, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            title="Öffnet in der Claude-App eine Session, die alle Feedbacks abarbeitet und daraus die Regeln nachschärft"
          >
            {mitFeedback} {mitFeedback === 1 ? 'Feedback' : 'Feedbacks'} an Claude ↗
          </a>
          <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>Öffnet eine Session auf diesem Mac.</span>
        </div>
      ) : null}
      {leads.map((l) => (
        <PruefKarte
          key={l.id}
          lead={l}
          profil={profilVon?.(l.name)}
          feedback={sammlung[l.id]?.text}
          onFeedback={(text) => {
            const neu = { ...sammlung }
            if (text) neu[l.id] = { text, name: l.name, at: new Date().toISOString() }
            else delete neu[l.id]
            setzeSammlung(neu)
          }}
          onGeprueft={() => onGeprueft(l.id)}
          onAussortiert={() => onAussortiert(l.id)}
          onNeuPruefen={(url) => onNeuPruefen(l.id, url)}
        />
      ))}
    </div>
  )
}
