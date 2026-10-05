import { useState } from 'react'
import type { Erstnachricht } from '../../../hooks/useErstnachrichten'
import { normalisiereUrl, pruefLink, trennePruefHinweis } from '../../lib/erstnachrichtenPruefung'
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
}: {
  lead: Erstnachricht
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
    const sauber = normalisiereUrl(url)
    if (!sauber) {
      setFehler('Das ist keine Website-Adresse, zum Beispiel sellavie.ch')
      return
    }
    setFehler(null)
    setSendet(true)
    const ok = await onNeuPruefen(sauber)
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

      {lead.pruef_url ? (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ck-accent)' }}>
          Wird mit {lead.pruef_url.replace(/^https?:\/\//, '').replace(/\/$/, '')} neu geprüft. Der neue Text steht nach der nächsten Runde bei den Erstnachrichten (spätestens in ein paar Stunden).
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
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setFehler(null)
            }}
            placeholder="Richtige Website eintragen, z. B. sellavie.ch"
            aria-label={`Website für ${lead.name}`}
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
            {sendet ? 'Speichert …' : 'Neu prüfen'}
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
