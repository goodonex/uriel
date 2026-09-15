import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alsSchalter, istAn, useSiteContent } from '../../hooks/useSiteContent'
import type { SiteContentField } from '../../hooks/useSiteContent'
import { supabase } from '../../lib/supabase'

/**
 * Website-Studio im Kundenportal: links die Felder, rechts die echte Seite.
 *
 * Der Unterschied zum alten Formular ist nicht die Optik, sondern die
 * Reihenfolge der Erkenntnis. Vorher: tippen, speichern, hoffen, Seite in
 * einem anderen Tab neu laden, nachsehen. Jetzt: tippen und sofort auf der
 * eigenen Seite sehen, was passiert — und erst danach entscheiden, ob das
 * live gehen soll.
 *
 * Technisch hängt das an zwei Nachrichten an den Rahmen (`postMessage`,
 * Gegenstück in `cms.js` der Kundenseite):
 *   { typ: 'entwurf', werte }   → Seite zeigt die Entwurfswerte an,
 *                                 veröffentlicht ist dabei nichts
 *   { typ: 'zeigeFeld', key }   → Seite markiert die Stelle und scrollt hin
 * Die Seite meldet einmal zurück, welche Felder sie überhaupt anzeigt; Felder,
 * die auf dieser Seite nicht vorkommen, bekommen einen Hinweis statt einer
 * stillen Wirkungslosigkeit.
 *
 * Geschrieben wird ausschließlich `value_draft` — ob daraus sofort der
 * Live-Wert wird, entscheidet die Datenbank anhand von `cms_autopublish`
 * (Migration 0084). Deshalb gibt es hier nur einen Schreibweg und zwei
 * Beschriftungen.
 */

interface Props {
  projectId: string
  /** deliver_projects.cms_autopublish — der Kunde schaltet selbst live. */
  autopublish: boolean
  /** Adresse der echten Seite. Ohne sie gibt es keine Vorschau. */
  liveUrl?: string
}

type Entwuerfe = Record<string, string>

const NACHRICHT_QUELLE = 'uriel-cms'

/**
 * Die Aktion (Balken/Popup) ist keine gewöhnliche Feldgruppe, sondern ein
 * Bauteil der CMS-Laufzeit: `cms.js` baut sie auf jeder Seite selbst. Deshalb
 * darf die Oberfläche ihre drei Sonderfelder kennen — das ist kein Sonderfall
 * je Kunde, sondern gilt überall gleich.
 */
const AKTION_FORM = 'aktion.form'
const AKTION_DATUM = ['aktion.von', 'aktion.bis']
const FORM_WAHL: Array<{ wert: string; text: string }> = [
  { wert: 'balken', text: 'Balken oben' },
  { wert: 'popup', text: 'Popup' },
  { wert: 'beides', text: 'Beides' },
]

function originVon(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/* ── Einzelfeld ───────────────────────────────────────────────────────── */

function Feld({
  field,
  wert,
  geaendert,
  aufDerSeite,
  onChange,
  onFokus,
  projectId,
}: {
  field: SiteContentField
  wert: string
  geaendert: boolean
  aufDerSeite: boolean | null
  onChange: (wert: string) => void
  onFokus: () => void
  projectId: string
}) {
  const dateiRef = useRef<HTMLInputElement | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const hochladen = async (datei: File) => {
    if (!supabase) return
    setLaedt(true)
    setFehler(null)
    try {
      const pfad = `${projectId}/${Date.now()}-${datei.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`
      const { error } = await supabase.storage.from('site-assets').upload(pfad, datei)
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('site-assets').getPublicUrl(pfad)
      onChange(data.publicUrl)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setLaedt(false)
    }
  }

  return (
    <div className="studio-feld" data-feld={field.field_key} data-geaendert={geaendert ? '1' : undefined}>
      <div className="studio-feld__kopf">
        {/* Bildfelder haben kein Eingabefeld mit dieser id — ein htmlFor ins
            Leere wäre für Screenreader schlechter als gar keins. */}
        {field.field_type === 'image' ? (
          <span className="studio-feld__label">{field.label}</span>
        ) : (
          <label className="studio-feld__label" htmlFor={`f-${field.id}`}>
            {field.label}
          </label>
        )}
        {geaendert ? <span className="studio-chip studio-chip--neu">geändert</span> : null}
        {aufDerSeite === false ? (
          <span className="studio-chip studio-chip--fern" title="Dieses Feld kommt auf der angezeigten Seite nicht vor — es wirkt auf einer Unterseite.">
            andere Seite
          </span>
        ) : null}
      </div>

      {field.field_key === AKTION_FORM ? (
        <div className="studio-wahl" role="group" aria-label={field.label}>
          {FORM_WAHL.map((o) => (
            <button
              key={o.wert}
              type="button"
              className={wert === o.wert ? 'studio-wahl__knopf is-an' : 'studio-wahl__knopf'}
              onClick={() => { onFokus(); onChange(o.wert) }}
            >
              {o.text}
            </button>
          ))}
        </div>
      ) : AKTION_DATUM.includes(field.field_key) ? (
        <input
          id={`f-${field.id}`}
          className="studio-eingabe"
          type="date"
          value={wert}
          onFocus={onFokus}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.field_type === 'boolean' ? (
        <label className="studio-schalter">
          <input
            id={`f-${field.id}`}
            type="checkbox"
            checked={istAn(wert)}
            onFocus={onFokus}
            onChange={(e) => onChange(alsSchalter(e.target.checked))}
          />
          <span>{istAn(wert) ? 'Wird angezeigt' : 'Wird nicht angezeigt'}</span>
        </label>
      ) : field.field_type === 'image' ? (
        <div className="studio-bild">
          {wert ? <img src={wert} alt={field.label} /> : <div className="studio-bild__leer">Kein Bild</div>}
          <button type="button" className="portal-btn" onClick={() => dateiRef.current?.click()} disabled={laedt}>
            {laedt ? 'Lädt…' : wert ? 'Bild ersetzen' : 'Bild wählen'}
          </button>
          <input
            ref={dateiRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void hochladen(f)
              e.target.value = ''
            }}
          />
          {fehler ? <span className="studio-fehler">{fehler}</span> : null}
        </div>
      ) : field.field_type === 'textarea' ? (
        <textarea
          id={`f-${field.id}`}
          className="studio-eingabe"
          autoComplete="off"
          rows={4}
          value={wert}
          onFocus={onFokus}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={`f-${field.id}`}
          className="studio-eingabe"
          type={field.field_type === 'url' ? 'url' : 'text'}
          inputMode={field.field_type === 'url' ? 'url' : undefined}
          autoComplete="off"
          spellCheck={field.field_type !== 'url'}
          placeholder={field.field_type === 'url' ? 'https://…' : undefined}
          value={wert}
          onFocus={onFokus}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

/* ── Studio ───────────────────────────────────────────────────────────── */

export function PortalWebsiteStudio({ projectId, autopublish, liveUrl }: Props) {
  const { sections, fields, loading, error, saveDraft, reload } = useSiteContent(projectId)
  const [entwuerfe, setEntwuerfe] = useState<Entwuerfe>({})
  const [seitenKeys, setSeitenKeys] = useState<string[] | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const [popupOffen, setPopupOffen] = useState(false)
  const [aktionVorschau, setAktionVorschau] = useState(false)
  const [aktionOffen, setAktionOffen] = useState(false)
  const [vorschauGeladen, setVorschauGeladen] = useState(false)
  const [gemeldet, setGemeldet] = useState<string | null>(null)
  const rahmenRef = useRef<HTMLIFrameElement | null>(null)

  const zielOrigin = useMemo(() => originVon(liveUrl), [liveUrl])

  const wertVon = useCallback(
    (f: SiteContentField) => entwuerfe[f.field_key] ?? f.value_published ?? '',
    [entwuerfe],
  )

  /** Alle aktuell gültigen Werte — Live-Stand mit den Entwürfen darüber. */
  const alleWerte = useMemo(() => {
    const w: Record<string, string> = {}
    for (const f of fields) w[f.field_key] = entwuerfe[f.field_key] ?? f.value_published ?? ''
    return w
  }, [fields, entwuerfe])

  const senden = useCallback(
    (nachricht: Record<string, unknown>) => {
      const fenster = rahmenRef.current?.contentWindow
      if (!fenster || !zielOrigin) return
      fenster.postMessage({ quelle: NACHRICHT_QUELLE, ...nachricht }, zielOrigin)
    },
    [zielOrigin],
  )

  /* Die Seite meldet sich, sobald sie bereit ist, und sagt welche Felder sie
     anzeigt. Erst danach hat es Sinn, ihr Entwürfe zu schicken. */
  useEffect(() => {
    if (!zielOrigin) return
    const zuhoerer = (ereignis: MessageEvent) => {
      if (ereignis.origin !== zielOrigin) return
      const n = ereignis.data as { quelle?: string; typ?: string; keys?: string[]; key?: string }
      if (n?.quelle !== 'uriel-cms-seite') return
      if (n.typ === 'bereit') {
        setVorschauGeladen(true)
        setSeitenKeys(Array.isArray(n.keys) ? n.keys : [])
        senden({ typ: 'entwurf', werte: alleWerte })
      } else if (n.typ === 'feldGewaehlt' && n.key) {
        // Klick auf der Seite → links das passende Feld holen. Das ist die
        // Richtung, die der Kunde zuerst probiert: er zeigt auf die Stelle,
        // die er meint, statt eine Feldliste zu durchsuchen.
        setGewaehlt(n.key)
      }
    }
    window.addEventListener('message', zuhoerer)
    return () => window.removeEventListener('message', zuhoerer)
  }, [zielOrigin, senden, alleWerte])

  /* Beim Tippen nicht bei jedem Zeichen funken. */
  useEffect(() => {
    if (seitenKeys === null) return
    const t = window.setTimeout(() => senden({ typ: 'entwurf', werte: alleWerte }), 140)
    return () => window.clearTimeout(t)
  }, [alleWerte, seitenKeys, senden])

  /* Ein von der Seite gemeldetes Feld in den Blick holen und den Cursor
     hineinsetzen — sonst müsste der Kunde die Liste absuchen. */
  useEffect(() => {
    if (!gewaehlt) return
    const el = document.querySelector<HTMLElement>(`[data-feld="${CSS.escape(gewaehlt)}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const ein = el.querySelector<HTMLElement>('input, textarea, button')
    ein?.focus({ preventScroll: true })
    setGewaehlt(null)
  }, [gewaehlt])

  /* Was am eingeklappten Block steht. Der Kunde soll nicht aufklappen müssen,
     um zu wissen, ob gerade eine Aktion auf seiner Seite läuft. */
  const aktionsStand = useMemo(() => {
    if (!istAn(alleWerte['aktion.an'] ?? '')) return 'aus'
    const bis = alleWerte['aktion.bis']
    if (!bis) return 'läuft'
    const ende = new Date(bis + 'T23:59:59')
    if (Number.isNaN(ende.getTime())) return 'läuft'
    const datum = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(ende)
    return ende < new Date() ? `abgelaufen am ${datum}` : `läuft bis ${datum}`
  }, [alleWerte])

  const offen = useMemo(
    () => fields.filter((f) => entwuerfe[f.field_key] != null && entwuerfe[f.field_key] !== (f.value_published ?? '')),
    [fields, entwuerfe],
  )

  const verwerfen = () => {
    setEntwuerfe({})
    setGemeldet(null)
    senden({ typ: 'verwerfen' })
  }

  const liveSchalten = async () => {
    if (offen.length === 0) return
    setSpeichert(true)
    setGemeldet(null)
    for (const f of offen) {
      await saveDraft(f.id, entwuerfe[f.field_key])
    }
    await reload()
    setEntwuerfe({})
    setSpeichert(false)
    setGemeldet(
      autopublish
        ? 'Steht jetzt auf deiner Website.'
        : 'Abgeschickt — wir schauen kurz drüber und schalten es frei.',
    )
    // Die Seite im Rahmen holt sich den neuen Live-Stand selbst.
    if (rahmenRef.current && liveUrl) rahmenRef.current.src = liveUrl
  }

  /* Ein Feld, überall gleich verdrahtet — die Aktion steckt in einem
     eigenen Block, soll sich aber genauso verhalten wie jedes andere Feld. */
  const feldFuer = (f: SiteContentField) => (
    <Feld
      key={f.id}
      field={f}
      projectId={projectId}
      wert={wertVon(f)}
      geaendert={offen.some((o) => o.id === f.id)}
      aufDerSeite={seitenKeys === null ? null : seitenKeys.includes(f.field_key)}
      onChange={(v) => setEntwuerfe((c) => ({ ...c, [f.field_key]: v }))}
      onFokus={() => {
        // Wer ein Aktions-Feld anfasst, soll Balken bzw. Popup sehen, auch
        // wenn die Aktion noch aus ist. Reine Vorschau — veröffentlicht wird
        // dadurch nichts.
        const gehoertZurAktion = f.field_key.startsWith('aktion.')
        if (gehoertZurAktion !== aktionVorschau) {
          setAktionVorschau(gehoertZurAktion)
          senden({ typ: 'aktionVorschau', an: gehoertZurAktion })
        }
        senden({ typ: 'zeigeFeld', key: f.field_key })
      }}
    />
  )

  const aktionsAbschnitt = sections.find((a) => a.fields.every((f) => f.field_key.startsWith('aktion.')))
  const seitenAbschnitte = sections.filter((a) => a !== aktionsAbschnitt)

  if (loading) return null
  if (fields.length === 0) return null

  const keineVorschau = !liveUrl || !zielOrigin

  return (
    <section className="studio">
      <header className="studio__kopf">
        <div>
          <h2 className="studio__titel">Deine Website</h2>
          <p className="studio__meta">
            {autopublish
              ? 'Links ändern, rechts sofort sehen. Live geht es erst, wenn du unten drückst.'
              : 'Links ändern, rechts sofort sehen. Abschicken geht an uns zur kurzen Prüfung.'}
          </p>
        </div>
        {liveUrl ? (
          <a className="studio__extern" href={liveUrl} target="_blank" rel="noopener noreferrer">
            In neuem Tab öffnen ↗
          </a>
        ) : null}
      </header>

      {error ? <p className="studio-fehler">{error}</p> : null}

      <div className={keineVorschau ? 'studio__buehne studio__buehne--ohne' : 'studio__buehne'}>
        <div className="studio__felder">
          {/* Die Aktion ist kein Abschnitt der Seite, sondern etwas, das sich
              darüberlegt. Eingeklappt sieht man auf einen Blick, dass es sie
              gibt und ob sie läuft — und die Seite fängt sichtbar darunter an,
              statt sich an zehn Feldern vorbeizuschieben. */}
          {aktionsAbschnitt ? (
            <details
              className="studio__aktion"
              open={aktionOffen}
              onToggle={(e) => setAktionOffen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="studio__aktion-kopf">
                <span className="studio__aktion-titel">Banner &amp; Popup</span>
                <span className="studio__aktion-stand">{aktionsStand}</span>
              </summary>
              <div className="studio__aktion-inhalt">
                {aktionsAbschnitt.fields.map((f) => feldFuer(f))}
              </div>
            </details>
          ) : null}

          {seitenAbschnitte.length > 0 ? (
            <div className="studio__trenner">Inhalte der Seite</div>
          ) : null}

          {seitenAbschnitte.map(({ section, fields: sf }) => (
            <div key={section} className="studio__gruppe">
              <div className="studio__gruppe-titel">{section}</div>
              {sf.map((f) => feldFuer(f))}
            </div>
          ))}
        </div>

        {keineVorschau ? null : (
          <div className="studio__vorschau">
            <div className="studio__vorschau-leiste">
              <span className="studio__punkt" />
              <span className="studio__adresse">
                {liveUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </span>
              {aktionVorschau && !istAn(alleWerte['aktion.an'] ?? '') ? (
                <span className="studio__nurvorschau">Aktion nur in der Vorschau</span>
              ) : null}
              {/* Ein Popup zeigt sich von allein nur einmal pro Besuch. Ohne
                  diesen Schalter bekäme der Kunde seine eigene Aktion nie zu
                  sehen, solange er sie baut. */}
              <button
                type="button"
                className={popupOffen ? 'studio__popupknopf is-an' : 'studio__popupknopf'}
                aria-pressed={popupOffen}
                onClick={() => {
                  const neu = !popupOffen
                  setPopupOffen(neu)
                  senden({ typ: 'popupZeigen', an: neu })
                }}
              >
                Popup zeigen
              </button>
            </div>
            {/* Eine echte Seite braucht ein paar Sekunden. Ohne Hinweis sieht
                die weisse Flaeche so lange aus, als waere etwas kaputt. */}
            {vorschauGeladen ? null : (
              <div className="studio__laedt">Vorschau wird geladen …</div>
            )}
            <iframe
              ref={rahmenRef}
              title="Vorschau deiner Website"
              src={liveUrl}
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => {
                // Notbremse: eine Seite ohne cms.js meldet sich nie. Dann
                // soll der Hinweis trotzdem verschwinden statt ewig zu stehen.
                window.setTimeout(() => setVorschauGeladen(true), 4000)
              }}
            />
          </div>
        )}
      </div>

      <footer className="studio__fuss">
        <span className="studio__stand" aria-live="polite">
          {offen.length === 0
            ? gemeldet ?? 'Alles gespeichert.'
            : `${offen.length} ${offen.length === 1 ? 'Änderung' : 'Änderungen'} noch nicht live`}
        </span>
        <div className="studio__knoepfe">
          <button type="button" className="portal-btn portal-btn-ghost" onClick={verwerfen} disabled={offen.length === 0 || speichert}>
            Verwerfen
          </button>
          <button
            type="button"
            className="portal-btn portal-btn-primary"
            onClick={() => void liveSchalten()}
            disabled={offen.length === 0 || speichert}
          >
            {speichert ? 'Einen Moment…' : autopublish ? 'Live schalten' : 'Zur Prüfung schicken'}
          </button>
        </div>
      </footer>
    </section>
  )
}
