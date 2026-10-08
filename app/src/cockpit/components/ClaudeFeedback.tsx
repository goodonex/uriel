import { useEffect, useRef, useState } from 'react'
import {
  abarbeitenLink,
  abarbeitenPrompt,
  bilderLoeschen,
  bildSpeichern,
  gibFeedback,
  holeZurueck,
  STUFEN_NAME,
  useNachrichtenFeedback,
  type FeedbackEintrag,
  type FeedbackStufe,
} from '../lib/nachrichtenFeedback'
import { inZwischenablage } from '../lib/zwischenablage'

/**
 * „Claude sagen, was nicht passt" (08.10.2026) — dieselbe Fläche an jeder
 * Nachricht, immer direkt über der Knopfreihe. Ersetzt „Neu prüfen ↗" (eine
 * Session je Nachricht) und das Feedback-Feld in „Prüfen".
 *
 * Abgeben nimmt die Nachricht vorerst als erledigt aus der Liste; eine Session
 * arbeitet später alle gesammelt ab (`lib/nachrichtenFeedback.ts`).
 */

function Funke({ groesse = 14 }: { groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.5c.4 3.1 1.6 4.9 5.5 6.5-3.9 1.6-5.1 3.4-5.5 6.5-.4-3.1-1.6-4.9-5.5-6.5C6.4 6.4 7.6 4.6 8 1.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function ClaudeFeedback({
  schluessel,
  eintrag,
  abfangen,
  gross = false,
}: {
  /** Die Posten-ID (`erstnachricht:<id>`, `thread:<id>`, `loom:<id>`, `anfrage:<id>`). */
  schluessel: string
  eintrag: Pick<FeedbackEintrag, 'stufe' | 'name' | 'firma' | 'nachricht'>
  /**
   * Wird vor dem Abgeben gefragt; `true` heißt „anders erledigt". In „Prüfen"
   * geht eine reine Website-Adresse so weiter an den Mini, der neu recherchiert.
   */
  abfangen?: (text: string) => Promise<boolean>
  /** Arbeitsmodus am Handy: größere Trefferflächen. */
  gross?: boolean
}) {
  const [offen, setOffen] = useState(false)
  const [text, setText] = useState('')
  const [bilder, setBilder] = useState<{ schluessel: string; vorschau: string }[]>([])
  const [laedtBild, setLaedtBild] = useState(false)
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const feld = useRef<HTMLTextAreaElement>(null)
  const knopfHoehe = gross ? 48 : 40

  useEffect(() => {
    if (offen) feld.current?.focus()
  }, [offen])

  const bilderAnhaengen = async (dateien: Blob[]) => {
    if (!dateien.length) return
    setLaedtBild(true)
    setFehler(null)
    for (const d of dateien) {
      const gespeichert = await bildSpeichern(d).catch(() => null)
      if (gespeichert) setBilder((b) => [...b, gespeichert])
      else setFehler('Screenshot konnte nicht gespeichert werden')
    }
    setLaedtBild(false)
  }

  const schliessen = () => {
    void bilderLoeschen(bilder.map((b) => b.schluessel))
    setBilder([])
    setText('')
    setFehler(null)
    setOffen(false)
  }

  const abgeben = async () => {
    const satz = text.trim()
    if (!satz && !bilder.length) {
      setFehler('Ein Satz oder ein Screenshot, was nicht passt')
      return
    }
    setSendet(true)
    setFehler(null)
    if (abfangen && !bilder.length && (await abfangen(satz))) {
      setSendet(false)
      setText('')
      setOffen(false)
      return
    }
    const ok = await gibFeedback(schluessel, { ...eintrag, text: satz.slice(0, 2000), bilder: bilder.map((b) => b.schluessel) })
    setSendet(false)
    if (!ok) {
      setFehler('Konnte nicht gespeichert werden. Nochmal versuchen.')
      return
    }
    // Die Nachricht verlässt ihre Liste ohnehin; zu für den Fall, dass eine Ansicht sie stehen lässt.
    setText('')
    setBilder([])
    setOffen(false)
  }

  if (!offen) {
    return (
      <div className="ck-feedback">
        <button type="button" className="ck-feedback__griff" style={{ minHeight: gross ? 48 : 44 }} onClick={() => setOffen(true)}>
          <span className="ck-feedback__zeichen">
            <Funke />
          </span>
          Claude sagen, was nicht passt
          <span className="ck-feedback__neben">Text oder Screenshot</span>
        </button>
      </div>
    )
  }

  return (
    <div className="ck-feedback ck-feedback--offen">
      <div className="ck-feedback__inhalt">
        <div className="ck-feedback__kopf">
          <span className="ck-feedback__zeichen">
            <Funke />
          </span>
          An Claude zu {eintrag.name}
        </div>
        <textarea
          ref={feld}
          className="ck-feedback__feld"
          value={text}
          rows={3}
          placeholder="Was stimmt nicht? Screenshot mit ⌘V einfügen."
          aria-label={`Was an der Nachricht an ${eintrag.name} nicht passt`}
          onChange={(e) => {
            setText(e.target.value)
            setFehler(null)
          }}
          onPaste={(e) => {
            const dateien = Array.from(e.clipboardData.items)
              .filter((i) => i.type.startsWith('image/'))
              .map((i) => i.getAsFile())
              .filter((f): f is File => f !== null)
            if (!dateien.length) return
            e.preventDefault()
            void bilderAnhaengen(dateien)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') schliessen()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void abgeben()
          }}
        />
        {bilder.length || laedtBild ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {bilder.map((b) => (
              <img key={b.schluessel} src={b.vorschau} alt="Angehängter Screenshot" className="ck-feedback__bild" />
            ))}
            {laedtBild ? <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>Lädt …</span> : null}
          </div>
        ) : null}
        {fehler ? <div style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{fehler}</div> : null}
        <div className="ck-feedback__fuss">
          <span className="ck-feedback__hinweis">Zählt vorerst als erledigt. Kommt mit neuem Text zurück, sobald Claude dran war.</span>
          <label className="ck-btn" style={{ minHeight: knopfHoehe, paddingInline: 14, fontSize: 11 }}>
            Screenshot
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
          <button type="button" className="ck-btn" style={{ minHeight: knopfHoehe, paddingInline: 14, fontSize: 11, color: 'var(--ck-text-3)' }} onClick={schliessen}>
            Abbrechen
          </button>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ minHeight: knopfHoehe, paddingInline: 16, fontSize: 11 }}
            disabled={sendet || laedtBild || (!text.trim() && !bilder.length)}
            onClick={() => void abgeben()}
          >
            {sendet ? 'Gibt ab …' : 'An Claude geben'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Die Leiste über einer Liste: wer aus dieser Liste gerade bei Claude liegt und
 * deshalb vorerst als erledigt zählt. Mit „Zurückholen" je Name und einem
 * Knopf, der die Session zum Abarbeiten öffnet.
 */
export function BeiClaude({ stufen }: { stufen: FeedbackStufe[] }) {
  const sammlung = useNachrichtenFeedback()
  const [auf, setAuf] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const hier = Object.entries(sammlung).filter(([, e]) => stufen.includes(e.stufe))
  if (!hier.length) return null
  const alle = Object.keys(sammlung).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      <div className="ck-bei-claude">
        <span className="ck-feedback__zeichen">
          <Funke />
        </span>
        <span style={{ flex: '1 1 200px', minWidth: 0 }}>
          {hier.length} bei Claude
          <span style={{ color: 'var(--ck-text-3)' }}> · zählt vorerst als erledigt</span>
        </span>
        <button type="button" className="ck-btn" style={{ minHeight: 36, fontSize: 11, paddingInline: 12 }} aria-expanded={auf} onClick={() => setAuf((x) => !x)}>
          {auf ? 'Zuklappen' : 'Ansehen'}
        </button>
        {/* Der Auftrag liegt zusätzlich in der Zwischenablage: Öffnet der Browser den App-Link nicht (Safari), geht es per ⌘V. */}
        <a
          className="ck-btn ck-btn--primary"
          style={{ minHeight: 36, fontSize: 11, paddingInline: 12, textDecoration: 'none' }}
          href={abarbeitenLink(alle)}
          title="Öffnet in der Claude-App eine Session, die alle Rückmeldungen abarbeitet"
          onClick={() => void inZwischenablage(abarbeitenPrompt(alle)).then(setKopiert)}
        >
          Jetzt abarbeiten ↗
        </a>
      </div>
      {kopiert ? (
        <div style={{ fontSize: 12, color: 'var(--ck-text-3)', paddingInline: 4 }}>
          Auftrag kopiert. Öffnet sich keine Session, in der Claude-App eine neue im Ordner „uriel" starten und mit ⌘V einfügen.
        </div>
      ) : null}
      {auf
        ? hier.map(([k, e]) => (
            <div
              key={k}
              style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 4px 6px 14px', fontSize: 13, borderBottom: '1px solid var(--ck-border)' }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--ck-text-1)' }}>{e.name}</span>
                {stufen.length > 1 ? <span style={{ color: 'var(--ck-text-3)' }}> · {STUFEN_NAME[e.stufe]}</span> : null}
                <span style={{ color: 'var(--ck-text-2)' }}>
                  {' '}
                  {e.text ? `„${e.text.length > 140 ? `${e.text.slice(0, 140)}…` : e.text}"` : ''}
                  {e.bilder?.length ? ` (${e.bilder.length} ${e.bilder.length === 1 ? 'Screenshot' : 'Screenshots'})` : ''}
                </span>
              </span>
              <button
                type="button"
                className="ck-btn"
                style={{ minHeight: 32, fontSize: 11, paddingInline: 12, color: 'var(--ck-text-3)', flexShrink: 0 }}
                title="Ohne Änderung zurück in die Liste"
                onClick={() => void holeZurueck(k)}
              >
                Zurückholen
              </button>
            </div>
          ))
        : null}
    </div>
  )
}
