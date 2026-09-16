import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alsSchalter, istAn, useSiteContent } from '../../hooks/useSiteContent'
import type { SiteContentField } from '../../hooks/useSiteContent'
import { bildAufbereiten } from '../../lib/bildAufbereiten'
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
 * ── Was sich mit Migration 0086 geändert hat ──────────────────────────────
 * Vorher lagen die Änderungen des Kunden ausschließlich im Browser-Tab und
 * wurden erst beim Druck auf den Knopf geschrieben — Tab zu, Stunde weg. Der
 * Grund war die Datenbank: mit `cms_autopublish` war jeder gespeicherte
 * Entwurf sofort der Live-Wert, ein Zwischenstand also unmöglich.
 *
 * Jetzt gibt es drei Zustände (draft · pending · published), und daraus folgt
 * der Aufbau hier:
 *
 *   `puffer`   = die letzten Tastenanschläge, noch nicht geschrieben. Lebt
 *                keine Sekunde, wird automatisch gesichert.
 *   value_draft = der Entwurf. Überlebt Tab, Rechner und eine Woche Pause.
 *   value_published = was draußen steht.
 *
 * Deshalb zeigt die Oberfläche `value_draft` und nicht mehr `value_published`:
 * Wer zurückkommt, findet seinen Stand wieder, statt auf den alten Text zu
 * starren. Und der Weg nach draußen ist ein eigener, benannter Vorgang —
 * einer für das ganze Projekt, alles oder nichts, statt Feld für Feld.
 */

interface Props {
  projectId: string
  /** deliver_projects.cms_autopublish — der Kunde darf selbst live schalten. */
  autopublish: boolean
  /** Adresse der echten Seite. Ohne sie gibt es keine Vorschau. */
  liveUrl?: string
  /**
   * Die Einreichung als Projekt-Nachricht wegschicken. Kommt von außen, weil
   * der Sendeweg samt Benachrichtigung in der Hülle wohnt — das Studio soll
   * keine zweite Kopie davon bekommen.
   */
  onEinreichung?: (anzahl: number, notiz: string) => Promise<boolean>
}

type Entwuerfe = Record<string, string>

const NACHRICHT_QUELLE = 'uriel-cms'

/**
 * Die Aktion (Balken/Popup) ist keine gewöhnliche Feldgruppe, sondern ein
 * Bauteil der CMS-Laufzeit: `cms.js` baut sie auf jeder Seite selbst. Deshalb
 * darf die Oberfläche ihre Sonderfelder kennen — das ist kein Sonderfall
 * je Kunde, sondern gilt überall gleich.
 */
const AKTION_FORM = 'aktion.form'
const AKTION_DATUM = ['aktion.von', 'aktion.bis']
const FORM_WAHL: Array<{ wert: string; text: string }> = [
  { wert: 'balken', text: 'Balken oben' },
  { wert: 'popup', text: 'Popup' },
  { wert: 'beides', text: 'Beides' },
]

/**
 * Beschriftungen, die die Oberfläche überschreibt.
 *
 * Die Feldliste wird aus der gebauten Seite erzeugt und trägt dort technische
 * Reste. Zwei davon waren echte Fallen: Der Block heißt im Portal „Banner &
 * Popup", die Felder darin sprachen aber weiter von einer „Aktion" — und das
 * START-Datum hieß „Läuft ab (TT.MM.JJJJ als 2026-04-01)", was jeder als
 * Enddatum liest. Wer dort sein Ende einträgt, dessen Banner erscheint nie.
 * Der Formathinweis war ohnehin gegenstandslos, seit dort ein Kalender steht.
 */
const BESCHRIFTUNG: Record<string, string> = {
  'aktion.an': 'Banner bzw. Popup anzeigen',
  'aktion.form': 'Wo soll es erscheinen?',
  'aktion.von': 'Ab wann sichtbar — leer heißt sofort',
  'aktion.bis': 'Bis wann sichtbar — danach verschwindet es von allein',
}

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
  const beschriftung = BESCHRIFTUNG[field.field_key] ?? field.label

  const hochladen = async (roh: File) => {
    if (!supabase) return
    setLaedt(true)
    setFehler(null)
    try {
      // Erst prüfen und verkleinern, dann erst hochladen: ein HEIC-Foto vom
      // iPhone sähe sonst für den Kunden richtig aus und für seine Besucher
      // kaputt (siehe lib/bildAufbereiten.ts).
      const fertig = await bildAufbereiten(roh)
      if (!fertig.ok) {
        setFehler(fertig.grund)
        return
      }
      const datei = fertig.datei
      const pfad = `${projectId}/${Date.now()}-${datei.name.replace(/[^a-zA-Z0-9._-]+/g, '-')}`
      const { error } = await supabase.storage.from('site-assets').upload(pfad, datei)
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('site-assets').getPublicUrl(pfad)
      onChange(data.publicUrl)
    } catch {
      setFehler('Das Bild konnte nicht hochgeladen werden. Versuch es noch einmal.')
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
          <span className="studio-feld__label">{beschriftung}</span>
        ) : (
          <label className="studio-feld__label" htmlFor={`f-${field.id}`}>
            {beschriftung}
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
        <div className="studio-wahl" role="group" aria-label={beschriftung}>
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
          {wert ? <img src={wert} alt={beschriftung} /> : <div className="studio-bild__leer">Kein Bild</div>}
          <button type="button" className="portal-btn" onClick={() => dateiRef.current?.click()} disabled={laedt}>
            {laedt ? 'Lädt…' : wert ? 'Bild ersetzen' : 'Bild wählen'}
          </button>
          <input
            ref={dateiRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void hochladen(f)
              e.target.value = ''
            }}
          />
          {fehler ? <p className="studio-fehler">{fehler}</p> : null}
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

type Frage = null | 'live' | 'verwerfen' | 'schicken' | 'zurueck'

/** „Mo, 15.09.2026, 14:20" — ohne Sekunden, mit Wochentag: so datiert man mündlich. */
function standDatum(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unbekannt'
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function PortalWebsiteStudio({ projectId, autopublish, liveUrl, onEinreichung }: Props) {
  const {
    sections,
    fields,
    loading,
    error,
    saveDraft,
    reload,
    liveSchalten,
    einreichen,
    verwerfenOffen,
    versionen,
    versionZurueck,
  } = useSiteContent(projectId)

  /** Die letzten Tastenanschläge, noch nicht in der Datenbank. Lebt < 1 s. */
  const [puffer, setPuffer] = useState<Entwuerfe>({})
  const [speicherStand, setSpeicherStand] = useState<'ruhe' | 'speichert' | 'fehler'>('ruhe')
  const [seitenKeys, setSeitenKeys] = useState<string[] | null>(null)
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const [popupOffen, setPopupOffen] = useState(false)
  const [aktionVorschau, setAktionVorschau] = useState(false)
  const [aktionOffen, setAktionOffen] = useState(false)
  const [vorschauGeladen, setVorschauGeladen] = useState(false)
  const [frage, setFrage] = useState<Frage>(null)
  const [zurueckId, setZurueckId] = useState<string | null>(null)
  const [staendeOffen, setStaendeOffen] = useState(false)
  const [notiz, setNotiz] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [gemeldet, setGemeldet] = useState<string | null>(null)
  const nachgeladen = useRef(false)
  const rahmenRef = useRef<HTMLIFrameElement | null>(null)

  const zielOrigin = useMemo(() => originVon(liveUrl), [liveUrl])

  /* Refs, weil der Sicherungslauf in einem Timer sitzt und dort sonst mit
     eingefrorenen Werten arbeiten würde. */
  const pufferRef = useRef<Entwuerfe>({})
  const fieldsRef = useRef<SiteContentField[]>([])
  const sichertGerade = useRef(false)
  useEffect(() => { pufferRef.current = puffer }, [puffer])
  useEffect(() => { fieldsRef.current = fields }, [fields])

  /**
   * Was in einem Feld steht: das zuletzt Getippte, sonst der gespeicherte
   * Entwurf, sonst der Live-Wert. Die mittlere Stufe ist die eigentliche
   * Neuerung — ohne sie sah ein Kunde nach dem Einreichen wieder den alten
   * Text und hielt seine Arbeit für verloren.
   */
  const wertVon = useCallback(
    (f: SiteContentField) => puffer[f.field_key] ?? f.value_draft ?? f.value_published ?? '',
    [puffer],
  )

  /** Alle aktuell gültigen Werte — für die Vorschau im Rahmen. */
  const alleWerte = useMemo(() => {
    const w: Record<string, string> = {}
    for (const f of fields) w[f.field_key] = puffer[f.field_key] ?? f.value_draft ?? f.value_published ?? ''
    return w
  }, [fields, puffer])

  /** Felder, die anders aussehen als das, was draußen steht. */
  const offen = useMemo(
    () =>
      fields.filter(
        (f) => (puffer[f.field_key] ?? f.value_draft ?? f.value_published ?? '') !== (f.value_published ?? ''),
      ),
    [fields, puffer],
  )

  const eingereicht = useMemo(() => fields.some((f) => f.status === 'pending'), [fields])

  const senden = useCallback(
    (nachricht: Record<string, unknown>) => {
      const fenster = rahmenRef.current?.contentWindow
      if (!fenster || !zielOrigin) return
      fenster.postMessage({ quelle: NACHRICHT_QUELLE, ...nachricht }, zielOrigin)
    },
    [zielOrigin],
  )

  /* ── Automatisch sichern ────────────────────────────────────────────── */

  /**
   * Den Puffer in die Entwürfe schreiben. Wird vom Timer aufgerufen und noch
   * einmal ausdrücklich, bevor etwas nach draußen geht — sonst könnten die
   * letzten drei getippten Buchstaben fehlen, wenn jemand sofort drückt.
   */
  const sichern = useCallback(async (): Promise<boolean> => {
    if (sichertGerade.current) return true
    const zuSichern = pufferRef.current
    const keys = Object.keys(zuSichern)
    if (keys.length === 0) return true

    sichertGerade.current = true
    setSpeicherStand('speichert')
    let allesGut = true

    for (const key of keys) {
      const feld = fieldsRef.current.find((f) => f.field_key === key)
      if (!feld) continue
      const wert = zuSichern[key]
      const ok = (feld.value_draft ?? '') === wert ? true : await saveDraft(feld.id, wert)
      if (!ok) {
        allesGut = false
        break
      }
      // Nur wegräumen, wenn seither niemand weitergetippt hat.
      setPuffer((p) => {
        if (p[key] !== wert) return p
        const rest = { ...p }
        delete rest[key]
        return rest
      })
    }

    sichertGerade.current = false
    setSpeicherStand(allesGut ? 'ruhe' : 'fehler')
    return allesGut
  }, [saveDraft])

  useEffect(() => {
    if (Object.keys(puffer).length === 0) return
    const t = window.setTimeout(() => void sichern(), 700)
    return () => window.clearTimeout(t)
  }, [puffer, sichern])

  /* Die letzte Sekunde ist das Einzige, was ein Tabschluss noch kosten kann —
     dafür lohnt die Rückfrage des Browsers. Alles davor liegt gespeichert. */
  useEffect(() => {
    if (Object.keys(puffer).length === 0) return
    const warnen = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warnen)
    return () => window.removeEventListener('beforeunload', warnen)
  }, [puffer])

  /* ── Vorschau ───────────────────────────────────────────────────────── */

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

  /* Ein Rahmen, der sich nach zehn Sekunden nicht gemeldet hat, steht
     erfahrungsgemäß weiß da und kommt von allein nicht mehr hoch. Genau
     einmal neu laden holt ihn zurück — öfter wäre eine Schleife, in der der
     Kunde nie etwas sieht. */
  useEffect(() => {
    if (vorschauGeladen || !liveUrl || nachgeladen.current) return
    const t = window.setTimeout(() => {
      if (vorschauGeladen || !rahmenRef.current) return
      nachgeladen.current = true
      rahmenRef.current.src = liveUrl
    }, 10000)
    return () => window.clearTimeout(t)
  }, [vorschauGeladen, liveUrl])

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

  /* ── Aktion ─────────────────────────────────────────────────────────── */

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

  /**
   * Eingeschaltet, aber ohne Überschrift: Auf der Seite erscheint dann ein
   * Streifen ohne Text — bei uns zeichnet ihn `cms.js` selbst, bei anderen
   * Kunden steckt er als Markup in der Seite und wird über einen Schalter
   * sichtbar. Das Ergebnis ist dasselbe und will niemand.
   *
   * Deshalb bewusst nicht auf `aktion.*` festgenagelt, sondern auf das Muster:
   * ein Schalter, dessen Schlüssel auf `.an` endet, und die Überschrift mit
   * demselben Präfix. Das greift bei `aktion.an`/`aktion.titel` genauso wie bei
   * `banner.an`/`banner.titel` — ein Kunde soll nicht davon abhängen, wie seine
   * Seite beim Bauen benannt wurde.
   */
  const leerWarnung = useMemo(() => {
    for (const f of fields) {
      if (f.field_type !== 'boolean' || !f.field_key.endsWith('.an')) continue
      if (!istAn(alleWerte[f.field_key] ?? '')) continue
      const titelKey = `${f.field_key.slice(0, -3)}.titel`
      if (!(titelKey in alleWerte)) continue
      if ((alleWerte[titelKey] ?? '').trim()) continue
      const name = BESCHRIFTUNG[f.field_key] ?? f.label
      return `„${name}" ist eingeschaltet, aber die Überschrift dazu ist leer — auf deiner Seite käme ein leerer Streifen. Trag eine Überschrift ein oder schalte es wieder aus.`
    }
    return null
  }, [fields, alleWerte])

  /* ── Die drei Wege nach draußen ─────────────────────────────────────── */

  const rahmenNeuLaden = () => {
    if (rahmenRef.current && liveUrl) rahmenRef.current.src = liveUrl
  }

  const tueLive = async () => {
    setLaeuft(true)
    setGemeldet(null)
    const gesichert = await sichern()
    if (!gesichert) {
      setLaeuft(false)
      setFrage(null)
      return
    }
    const res = await liveSchalten()
    setLaeuft(false)
    setFrage(null)
    if (!res.ok) return
    setGemeldet('Steht jetzt auf deiner Website.')
    rahmenNeuLaden()
  }

  const tueSchicken = async () => {
    setLaeuft(true)
    setGemeldet(null)
    const gesichert = await sichern()
    if (!gesichert) {
      setLaeuft(false)
      setFrage(null)
      return
    }
    const anzahl = offen.length
    const res = await einreichen()
    if (res.ok && onEinreichung) await onEinreichung(anzahl, notiz)
    setLaeuft(false)
    setFrage(null)
    setNotiz('')
    if (res.ok) setGemeldet('Ist bei uns. Wir schauen drüber und melden uns.')
  }

  /**
   * Wie weit ist dieser Stand von dem entfernt, was jetzt draußen steht? Das
   * ist die einzige Zahl, die hier etwas nützt: Sie sagt, wie viel ein Zurück
   * verändern würde. Ein Stand mit 0 ist der aktuelle — den wiederherzustellen
   * wäre ein Knopf ohne Wirkung.
   */
  const andersAls = useCallback(
    (v: { werte: Record<string, string | null> }) =>
      fields.filter((f) => (v.werte[f.field_key] ?? '') !== (f.value_published ?? '')).length,
    [fields],
  )

  const tueZurueck = async () => {
    if (!zurueckId) return
    setLaeuft(true)
    setGemeldet(null)
    setPuffer({})
    const res = await versionZurueck(zurueckId)
    setLaeuft(false)
    setFrage(null)
    setZurueckId(null)
    if (!res.ok) return
    setGemeldet('Der frühere Stand steht wieder auf deiner Website.')
    rahmenNeuLaden()
  }

  const tueVerwerfen = async () => {
    setLaeuft(true)
    setGemeldet(null)
    setPuffer({})
    const res = await verwerfenOffen()
    setLaeuft(false)
    setFrage(null)
    if (!res.ok) return
    setGemeldet('Zurückgesetzt auf den Stand, der auf deiner Website steht.')
    senden({ typ: 'verwerfen' })
    void reload()
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
      onChange={(v) => {
        setGemeldet(null)
        setPuffer((c) => ({ ...c, [f.field_key]: v }))
      }}
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
  const nichtsOffen = offen.length === 0
  const wegVersperrt = leerWarnung !== null

  /** Ein Satz, der sagt wo man steht — nicht was das System gerade tut. */
  const standText = () => {
    if (speicherStand === 'fehler') return 'Speichern klemmt gerade — deine Änderungen stehen noch hier.'
    if (gemeldet) return gemeldet
    if (eingereicht) return 'Bei uns zur Prüfung.'
    if (nichtsOffen) return 'Alles gespeichert und live.'
    return `${offen.length} ${offen.length === 1 ? 'Änderung' : 'Änderungen'} gespeichert, noch nicht live`
  }

  return (
    <section className="studio">
      <header className="studio__kopf">
        <div>
          <h2 className="studio__titel">Deine Website</h2>
          <p className="studio__meta">
            Links ändern, rechts sofort sehen — und rechts auf eine Stelle klicken holt links das passende Feld.
            Gespeichert wird von allein; nach draußen geht erst, was du unten abschickst.
          </p>
        </div>
        {liveUrl ? (
          <a className="studio__extern" href={liveUrl} target="_blank" rel="noopener noreferrer">
            In neuem Tab öffnen ↗
          </a>
        ) : null}
      </header>

      {error ? <p className="studio-fehler studio-fehler--breit">{error}</p> : null}

      {/* Steht oben statt im Klapp-Block: Der Schalter kann in jedem Abschnitt
          sitzen, und ein Hinweis, der den Abschick-Knopf sperrt, darf nicht
          eingeklappt sein. */}
      {leerWarnung ? <p className="studio-fehler studio-fehler--breit">{leerWarnung}</p> : null}

      {eingereicht ? (
        <p className="studio-hinweis">
          Deine Änderungen liegen bei uns zur Prüfung. Du kannst weiter daran arbeiten — wir melden uns,
          sobald wir draufgeschaut haben.
        </p>
      ) : null}

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

          {/* Frühere Stände. Eingeklappt, weil man sie selten braucht — aber
              auffindbar, ohne zu fragen, weil man sie dann sofort braucht.
              Jede Zeile sagt, wie viel ein Zurück verändern würde. */}
          {versionen.length > 0 ? (
            <details
              className="studio__staende"
              open={staendeOffen}
              onToggle={(e) => setStaendeOffen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="studio__aktion-kopf">
                <span className="studio__aktion-titel">Frühere Stände</span>
                <span className="studio__aktion-stand">{versionen.length}</span>
              </summary>
              <div className="studio__aktion-inhalt">
                <p className="studio__staende-hinweis">
                  Jeder Eintrag ist die ganze Seite, wie sie vor einer Änderung aussah.
                  {autopublish ? '' : ' Zurücknehmen können wir für dich — schreib uns kurz.'}
                </p>
                {versionen.map((v) => {
                  const zahl = andersAls(v)
                  return (
                    <div key={v.id} className="studio__stand-zeile">
                      <div>
                        <span className="studio__stand-datum">{standDatum(v.erstellt_am)}</span>
                        <span className="studio__stand-info">
                          {zahl === 0
                            ? 'entspricht dem, was jetzt draußen steht'
                            : `${zahl} ${zahl === 1 ? 'Feld' : 'Felder'} anders als jetzt`}
                          {v.anlass === 'rueckname' ? ' · vor einem Zurück' : ''}
                        </span>
                      </div>
                      {autopublish ? (
                        <button
                          type="button"
                          className="portal-btn"
                          disabled={zahl === 0 || laeuft}
                          onClick={() => {
                            setZurueckId(v.id)
                            setFrage('zurueck')
                          }}
                        >
                          Wiederherstellen
                        </button>
                      ) : null}
                    </div>
                  )
                })}
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
        {frage === null ? (
          <>
            <span className="studio__stand" aria-live="polite">
              {standText()}
            </span>
            <div className="studio__knoepfe">
              <button
                type="button"
                className="portal-btn portal-btn-ghost"
                onClick={() => setFrage('verwerfen')}
                disabled={nichtsOffen || laeuft}
              >
                Verwerfen
              </button>
              <button
                type="button"
                className={autopublish ? 'portal-btn' : 'portal-btn portal-btn-primary'}
                onClick={() => setFrage('schicken')}
                disabled={nichtsOffen || laeuft || wegVersperrt}
              >
                {autopublish ? 'Erst an uns schicken' : 'An uns schicken'}
              </button>
              {autopublish ? (
                <button
                  type="button"
                  className="portal-btn portal-btn-primary"
                  onClick={() => setFrage('live')}
                  disabled={nichtsOffen || laeuft || wegVersperrt}
                >
                  Live schalten
                </button>
              ) : null}
            </div>
          </>
        ) : (
          /* Die Rückfrage ersetzt die Leiste, statt als Kasten darüber zu
             liegen: auf dem Handy ist das der einzige Ort, der sicher sichtbar
             ist — die Leiste klebt dort ohnehin unten fest. */
          <div className="studio__rueckfrage">
            {frage === 'live' ? (
              <>
                <p className="studio__rueckfrage-text">
                  Damit stehen deine {offen.length} {offen.length === 1 ? 'Änderung' : 'Änderungen'} auf
                  deiner Website — ab sofort für jeden sichtbar. Jetzt live schalten?
                </p>
                <div className="studio__knoepfe">
                  <button type="button" className="portal-btn portal-btn-ghost" onClick={() => setFrage(null)} disabled={laeuft}>
                    Zurück
                  </button>
                  <button type="button" className="portal-btn portal-btn-primary" onClick={() => void tueLive()} disabled={laeuft}>
                    {laeuft ? 'Einen Moment…' : 'Ja, live schalten'}
                  </button>
                </div>
              </>
            ) : frage === 'zurueck' ? (
              <>
                <p className="studio__rueckfrage-text">
                  {(() => {
                    const v = versionen.find((x) => x.id === zurueckId)
                    const zahl = v ? andersAls(v) : 0
                    return `Damit steht der Stand von ${v ? standDatum(v.erstellt_am) : ''} wieder auf deiner Website — ${zahl} ${zahl === 1 ? 'Feld wird' : 'Felder werden'} zurückgesetzt. Den jetzigen Stand halten wir vorher fest, du kannst also auch das wieder rückgängig machen.`
                  })()}
                </p>
                <div className="studio__knoepfe">
                  <button
                    type="button"
                    className="portal-btn portal-btn-ghost"
                    onClick={() => {
                      setFrage(null)
                      setZurueckId(null)
                    }}
                    disabled={laeuft}
                  >
                    Zurück
                  </button>
                  <button type="button" className="portal-btn portal-btn-primary" onClick={() => void tueZurueck()} disabled={laeuft}>
                    {laeuft ? 'Einen Moment…' : 'Ja, wiederherstellen'}
                  </button>
                </div>
              </>
            ) : frage === 'verwerfen' ? (
              <>
                <p className="studio__rueckfrage-text">
                  Alle {offen.length} {offen.length === 1 ? 'Änderung' : 'Änderungen'} verwerfen und auf
                  den Stand deiner Website zurückgehen? Das lässt sich nicht rückgängig machen.
                </p>
                <div className="studio__knoepfe">
                  <button type="button" className="portal-btn portal-btn-ghost" onClick={() => setFrage(null)} disabled={laeuft}>
                    Behalten
                  </button>
                  <button type="button" className="portal-btn" onClick={() => void tueVerwerfen()} disabled={laeuft}>
                    {laeuft ? 'Einen Moment…' : 'Ja, verwerfen'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="studio__rueckfrage-text" htmlFor="studio-notiz">
                  Wir schauen drüber und melden uns. Willst du uns etwas dazu sagen?
                </label>
                <textarea
                  id="studio-notiz"
                  className="studio-eingabe"
                  rows={2}
                  placeholder="Zum Beispiel: Die Preise sind neu — passt das so?"
                  value={notiz}
                  onChange={(e) => setNotiz(e.target.value)}
                />
                <div className="studio__knoepfe">
                  <button type="button" className="portal-btn portal-btn-ghost" onClick={() => setFrage(null)} disabled={laeuft}>
                    Zurück
                  </button>
                  <button type="button" className="portal-btn portal-btn-primary" onClick={() => void tueSchicken()} disabled={laeuft}>
                    {laeuft ? 'Einen Moment…' : 'Abschicken'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </footer>
    </section>
  )
}
