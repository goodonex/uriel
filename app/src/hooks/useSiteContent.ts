import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { gibSiteContentFrei, verwirfSiteContentEntwurf } from '../lib/siteContentService'

/**
 * Website-CMS (Migration 0052): feste Text-/Bild-Felder je Projekt.
 *
 * Seit **0086** sind Speichern und Veröffentlichen zwei verschiedene Dinge.
 * Geschrieben wird weiterhin nur `value_draft` — aber ein gespeicherter Entwurf
 * geht nirgendwo mehr von allein hin, auch nicht bei `cms_autopublish`. Den
 * Schritt nach draußen machen drei Funktionen in der Datenbank, jede für EIN
 * Projekt und alles-oder-nichts:
 *
 *   liveSchalten   draft → published   (Kunde nur bei cms_autopublish)
 *   einreichen     draft → pending     ("schau bitte drauf")
 *   verwerfenOffen draft ← published   (zurück auf den Stand von draußen)
 *
 * Warum das wichtig ist: Vorher lagen die Entwürfe des Kunden im Browser-Tab,
 * weil es in der Datenbank keinen Platz für "fertig, aber noch nicht draußen"
 * gab. Jetzt gibt es ihn — deshalb überlebt ein halbfertiger Stand das
 * Schließen des Tabs, und `cms_autopublish` entscheidet nur noch, ob der Kunde
 * den Live-Knopf überhaupt angeboten bekommt.
 */

/**
 * Datenbank-Fehler in einen Satz übersetzen, den ein Makler lesen kann.
 *
 * Vorher stand der englische Originaltext ("new row violates row-level security
 * policy for table …") ungefiltert im Kundenportal. Das ist für den Empfänger
 * dieselbe Information wie gar keine — nur beunruhigender.
 */
export function kundenFehler(roh: string): string {
  const t = roh.toLowerCase()
  if (t.includes('gibt die agentur frei')) return 'Für deine Seite geben wir frei — schick uns die Änderungen, wir schauen drüber.'
  if (t.includes('kein zugriff')) return 'Diese Seite gehört nicht zu deinem Zugang. Bitte melde dich bei uns.'
  if (t.includes('nur entwürfe')) return 'Das lässt sich hier nicht ändern. Sag uns kurz Bescheid, wir machen das.'
  if (t.includes('row-level security') || t.includes('permission denied')) {
    return 'Dafür fehlt deinem Zugang die Berechtigung. Bitte melde dich bei uns.'
  }
  if (t.includes('failed to fetch') || t.includes('network')) {
    return 'Keine Verbindung. Prüf kurz dein Internet und versuch es noch einmal.'
  }
  return 'Das hat gerade nicht geklappt. Versuch es noch einmal — wenn es bleibt, melde dich bei uns.'
}

/** Schalter-Felder liegen als '1'/'0' in derselben Textspalte wie alles andere. */
export const istAn = (value: string | null | undefined): boolean => value === '1'
export const alsSchalter = (an: boolean): string => (an ? '1' : '0')

export interface SiteContentField {
  id: string
  project_id: string
  field_key: string
  section: string
  label: string
  field_type: 'text' | 'textarea' | 'image' | 'boolean' | 'url'
  value_published: string | null
  value_draft: string | null
  /** draft = getippt · pending = beim Owner eingereicht · published = draußen */
  status: 'published' | 'pending' | 'draft'
  sort_order: number
  draft_updated_at: string | null
  published_at: string | null
}

/**
 * Ein früherer Stand der ganzen Seite (Migration 0087). Entsteht VOR jeder
 * Veröffentlichung und hält damit fest, was bis dahin draußen stand — die
 * Liste liest sich deshalb als „so sah die Seite vor dieser Änderung aus".
 */
export interface SiteContentVersion {
  id: string
  erstellt_am: string
  anlass: 'live' | 'freigabe' | 'rueckname'
  /** { field_key: value_published } über alle Felder des Projekts. */
  werte: Record<string, string | null>
  notiz: string | null
}

export interface SiteContentFieldDef {
  field_key: string
  section: string
  label: string
  field_type: SiteContentField['field_type']
  sort_order?: number
  value_published?: string
}

/**
 * Ergebnis der drei Projekt-Vorgänge. Bewusst nicht `void`: die Oberfläche muss
 * unterscheiden können zwischen "hat geklappt" und "hat nicht geklappt" — der
 * alte Weg hat jeden Fehler verschluckt und trotzdem Erfolg gemeldet.
 */
export type ProjektErgebnis = { ok: true; anzahl: number } | { ok: false; error: string }

interface UseSiteContentResult {
  fields: SiteContentField[]
  /** nach section gruppiert, sortiert */
  sections: Array<{ section: string; fields: SiteContentField[] }>
  pending: SiteContentField[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Kunde/Owner: Entwurf speichern. false = hat nicht geklappt. */
  saveDraft: (fieldId: string, value: string) => Promise<boolean>
  /** Alle offenen Entwürfe des Projekts veröffentlichen — alles oder nichts. */
  liveSchalten: () => Promise<ProjektErgebnis>
  /** Alle offenen Entwürfe zur Prüfung anmelden (draft → pending). */
  einreichen: () => Promise<ProjektErgebnis>
  /** Alle offenen Entwürfe auf den veröffentlichten Stand zurücksetzen. */
  verwerfenOffen: () => Promise<ProjektErgebnis>
  /** Frühere Stände der Seite, neueste zuerst. */
  versionen: SiteContentVersion[]
  /** Einen früheren Stand wiederherstellen — selbst wieder rücknehmbar. */
  versionZurueck: (versionId: string) => Promise<ProjektErgebnis>
  /** Owner: Entwurf freigeben (draft → published) */
  approve: (fieldIds: string[]) => Promise<void>
  /** Owner: Entwurf verwerfen (draft ← published) */
  discardDraft: (fieldId: string) => Promise<void>
  /** Owner: neue Felder anlegen */
  seedFields: (defs: SiteContentFieldDef[]) => Promise<void>
  /** Owner: Feld löschen */
  removeField: (fieldId: string) => Promise<void>
}

export function useSiteContent(projectId: string | undefined): UseSiteContentResult {
  const [fields, setFields] = useState<SiteContentField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!projectId || !supabase) {
      setFields([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('site_content')
      .select('*')
      .eq('project_id', projectId)
      // NUR nach sort_order. Vorher stand `section` davor — und damit standen
      // die Abschnitte im Portal alphabetisch: "Aktion", "Analyse-Formular",
      // "Ganz oben", "Häufige Fragen"… Der Kunde soll die Liste aber von oben
      // nach unten durchgehen wie seine Seite. `sort_order` ist deshalb die
      // Position auf der Seite, projektweit fortlaufend, und die Gruppierung
      // in `sections` entsteht aus der Reihenfolge, in der die Abschnitte
      // vorkommen.
      .order('sort_order', { ascending: true })
    if (err) {
      // Tabelle fehlt (Migration 0052 nicht ausgeführt) → leer, kein Crash
      if (!/relation .* does not exist/i.test(err.message)) setError(kundenFehler(err.message))
      setFields([])
    } else {
      setFields((data ?? []) as SiteContentField[])
      setError(null)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveDraft = useCallback(
    async (fieldId: string, value: string): Promise<boolean> => {
      if (!supabase) return false
      // Optimistisch; Status setzt DB-seitig der Trigger (Client) bzw. bleibt
      // owner-seitig konsistent, weil wir ihn hier mitschreiben.
      setFields((cur) =>
        cur.map((f) =>
          f.id === fieldId
            ? {
                ...f,
                value_draft: value,
                // Ein einmal eingereichter Stand bleibt eingereicht, auch wenn
                // der Kunde danach weitertippt — genau so macht es der Trigger.
                status:
                  value === (f.value_published ?? '')
                    ? 'published'
                    : f.status === 'pending'
                      ? 'pending'
                      : 'draft',
              }
            : f,
        ),
      )
      const { error: err } = await supabase
        .from('site_content')
        .update({ value_draft: value })
        .eq('id', fieldId)
      if (err) {
        setError(kundenFehler(err.message))
        await reload()
        return false
      }
      return true
    },
    [reload],
  )

  /**
   * Die drei Projekt-Vorgänge aus 0086. Immer derselbe Ablauf: eine Funktion in
   * der Datenbank aufrufen, danach neu laden. Ein Fehler wird zurückgegeben
   * statt stillschweigend in einen Erfolg verwandelt — genau daran hing der
   * Befund "halb gespeichert, trotzdem 'Steht jetzt auf deiner Website'".
   */
  const projektVorgang = useCallback(
    async (fn: 'site_content_live_schalten' | 'site_content_einreichen' | 'site_content_verwerfen'): Promise<ProjektErgebnis> => {
      if (!supabase) return { ok: false, error: 'Keine Verbindung. Bitte die Seite neu laden.' }
      if (!projectId) return { ok: false, error: 'Kein Projekt.' }
      const { data, error: err } = await supabase.rpc(fn, { p_project: projectId })
      if (err) {
        const text = kundenFehler(err.message)
        setError(text)
        return { ok: false, error: text }
      }
      setError(null)
      await reload()
      return { ok: true, anzahl: typeof data === 'number' ? data : 0 }
    },
    [projectId, reload],
  )

  /* Frühere Stände. Eigener Ladeweg, weil sie sich nur beim Veröffentlichen
     ändern — und weil ein Fehler hier (etwa eine fehlende Migration) die
     Feldliste nicht mitreißen darf. */
  const [versionen, setVersionen] = useState<SiteContentVersion[]>([])

  const reloadVersionen = useCallback(async () => {
    if (!projectId || !supabase) {
      setVersionen([])
      return
    }
    const { data, error: err } = await supabase
      .from('site_content_versionen')
      .select('id, erstellt_am, anlass, werte, notiz')
      .eq('project_id', projectId)
      .order('erstellt_am', { ascending: false })
    if (err) {
      // Tabelle fehlt (0087 nicht gelaufen) → keine Liste statt Fehlerbanner.
      setVersionen([])
      return
    }
    setVersionen((data ?? []) as SiteContentVersion[])
  }, [projectId])

  useEffect(() => {
    void reloadVersionen()
  }, [reloadVersionen])

  const versionZurueck = useCallback(
    async (versionId: string): Promise<ProjektErgebnis> => {
      if (!supabase) return { ok: false, error: 'Keine Verbindung. Bitte die Seite neu laden.' }
      if (!projectId) return { ok: false, error: 'Kein Projekt.' }
      const { data, error: err } = await supabase.rpc('site_content_version_zurueck', {
        p_project: projectId,
        p_version: versionId,
      })
      if (err) {
        const text = kundenFehler(err.message)
        setError(text)
        return { ok: false, error: text }
      }
      setError(null)
      await Promise.all([reload(), reloadVersionen()])
      return { ok: true, anzahl: typeof data === 'number' ? data : 0 }
    },
    [projectId, reload, reloadVersionen],
  )

  const liveSchalten = useCallback(async () => {
    const res = await projektVorgang('site_content_live_schalten')
    // Veröffentlichen legt einen Stand an — die Liste ist sonst veraltet,
    // genau in dem Moment, in dem jemand sie braucht.
    if (res.ok) await reloadVersionen()
    return res
  }, [projektVorgang, reloadVersionen])
  const einreichen = useCallback(() => projektVorgang('site_content_einreichen'), [projektVorgang])
  const verwerfenOffen = useCallback(() => projektVorgang('site_content_verwerfen'), [projektVorgang])

  const approve = useCallback(
    async (fieldIds: string[]) => {
      if (fieldIds.length === 0) return
      for (const id of fieldIds) {
        const f = fields.find((x) => x.id === id)
        if (!f) continue
        // Gemeinsamer Pfad mit dem Kunden-Posteingang (siteContentService).
        const res = await gibSiteContentFrei(id, f.value_draft)
        if (!res.ok) setError(res.error)
      }
      await reload()
    },
    [fields, reload],
  )

  const discardDraft = useCallback(
    async (fieldId: string) => {
      const f = fields.find((x) => x.id === fieldId)
      if (!f) return
      const res = await verwirfSiteContentEntwurf(fieldId, f.value_published)
      if (!res.ok) setError(res.error)
      await reload()
    },
    [fields, reload],
  )

  const seedFields = useCallback(
    async (defs: SiteContentFieldDef[]) => {
      if (!supabase || !projectId || defs.length === 0) return
      // sort_order ist projektweit die Position auf der Seite. Ein von Hand
      // angelegtes Feld haengt sich deshalb hinten an, statt sich mit einer
      // niedrigen Nummer mitten zwischen bestehende Abschnitte zu setzen.
      const hoechste = fields.reduce((max, f) => Math.max(max, f.sort_order), 0)
      const rows = defs.map((d, i) => ({
        project_id: projectId,
        field_key: d.field_key,
        section: d.section,
        label: d.label,
        field_type: d.field_type,
        sort_order: d.sort_order ?? hoechste + i + 1,
        value_published: d.value_published ?? null,
        value_draft: d.value_published ?? null,
      }))
      const { error: err } = await supabase
        .from('site_content')
        .upsert(rows, { onConflict: 'project_id,field_key', ignoreDuplicates: true })
      if (err) setError(err.message)
      await reload()
    },
    [fields, projectId, reload],
  )

  const removeField = useCallback(
    async (fieldId: string) => {
      if (!supabase) return
      const { error: err } = await supabase.from('site_content').delete().eq('id', fieldId)
      if (err) setError(err.message)
      await reload()
    },
    [reload],
  )

  const sections = useMemo(() => {
    const map = new Map<string, SiteContentField[]>()
    for (const f of fields) {
      if (!map.has(f.section)) map.set(f.section, [])
      map.get(f.section)!.push(f)
    }
    return [...map.entries()].map(([section, sectionFields]) => ({ section, fields: sectionFields }))
  }, [fields])

  const pending = useMemo(() => fields.filter((f) => f.status === 'pending'), [fields])

  return {
    fields,
    sections,
    pending,
    loading,
    error,
    reload,
    saveDraft,
    liveSchalten,
    einreichen,
    verwerfenOffen,
    versionen,
    versionZurueck,
    approve,
    discardDraft,
    seedFields,
    removeField,
  }
}
