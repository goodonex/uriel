import { useRef, useState } from 'react'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import { pruefEingabe, pruefEingabeKurz, pruefLink, trennePruefHinweis } from '../../lib/erstnachrichtenPruefung'
import { bilderLoeschen, bildSpeichern, feedbackLink, FEEDBACK_SCHLUESSEL, type FeedbackEintrag, type FeedbackSammlung } from '../../lib/erstnachrichtenFeedback'
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
  feedback?: FeedbackEintrag
  /** Text setzen (`null` = Text weg), Bilder anhängen oder alle Bilder entfernen. */
  onFeedback: (aenderung: { text?: string | null; bildDazu?: string; bilderWeg?: true }) => void
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
  const [vorschauen, setVorschauen] = useState<string[]>([])
  const [laedtBild, setLaedtBild] = useState(false)

  /** Screenshot per ⌘V ins Feld oder über den Knopf (Kevin, 05.10.2026). */
  const bilderAnhaengen = async (dateien: Blob[]) => {
    if (!dateien.length) return
    setLaedtBild(true)
    setFehler(null)
    for (const d of dateien) {
      const gespeichert = await bildSpeichern(d).catch(() => null)
      if (!gespeichert) {
        setFehler('Screenshot konnte nicht gespeichert werden')
        continue
      }
      onFeedback({ bildDazu: gespeichert.schluessel })
      setVorschauen((v) => [...v, gespeichert.vorschau])
    }
    setLaedtBild(false)
  }
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
      onFeedback({ text: url.trim().slice(0, 1500) })
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

      {feedback?.text ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-accent)', display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>Dein Feedback: „{feedback.text}"</span>
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 11, color: 'var(--ck-text-3)' }}
            onClick={() => {
              setUrl(feedback.text)
              onFeedback({ text: null })
            }}
          >
            Ändern
          </button>
        </div>
      ) : null}
      {feedback?.bilder?.length ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {vorschauen.map((v, i) => (
            <img key={i} src={v} alt="" style={{ height: 56, borderRadius: 6, border: '1px solid var(--ck-border-strong)' }} />
          ))}
          <span style={{ fontSize: 12, color: 'var(--ck-accent)' }}>
            {feedback.bilder.length} {feedback.bilder.length === 1 ? 'Screenshot' : 'Screenshots'} angehängt
          </span>
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 11, color: 'var(--ck-text-3)' }}
            onClick={() => {
              onFeedback({ bilderWeg: true })
              setVorschauen([])
            }}
          >
            Entfernen
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
            onPaste={(e) => {
              const bilder = Array.from(e.clipboardData.items)
                .filter((i) => i.type.startsWith('image/'))
                .map((i) => i.getAsFile())
                .filter((f): f is File => f !== null)
              if (!bilder.length) return
              e.preventDefault()
              void bilderAnhaengen(bilder)
            }}
            placeholder="Feedback zum Text oder die richtige Website · Screenshot mit ⌘V einfügen"
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
          <label className="ck-btn" style={{ fontSize: 11, minHeight: 40, paddingInline: 16, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            {laedtBild ? 'Lädt …' : 'Screenshot'}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void bilderAnhaengen(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </label>
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
  const aktuell = useRef(sammlung)
  aktuell.current = sammlung
  // Nur Einträge zu Texten, die noch hier stehen: Abgearbeitete verlassen die Liste, ihr Eintrag zählt nicht mehr.
  const mitFeedback = leads.filter((l) => sammlung[l.id]?.text || sammlung[l.id]?.bilder?.length).length
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
          feedback={sammlung[l.id]}
          onFeedback={(aenderung) => {
            // Funktional über `aktuell`, weil mehrere Screenshots kurz hintereinander eintreffen.
            const alt = aktuell.current[l.id]
            const text = aenderung.text === undefined ? (alt?.text ?? '') : (aenderung.text ?? '')
            let bilder = alt?.bilder ?? []
            if (aenderung.bilderWeg) {
              void bilderLoeschen(bilder)
              bilder = []
            }
            if (aenderung.bildDazu) bilder = [...bilder, aenderung.bildDazu]
            const neu = { ...aktuell.current }
            if (text || bilder.length) neu[l.id] = { text, name: l.name, at: new Date().toISOString(), bilder }
            else delete neu[l.id]
            aktuell.current = neu
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
