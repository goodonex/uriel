import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGlobalMessages } from '../../hooks/useGlobalMessages'
import { supabase } from '../../lib/supabase'
import { sendeProjektNachricht } from '../../lib/projectMessageService'
import {
  gibProjektFrei,
  gibSiteContentFrei,
  verwirfProjektEntwuerfe,
  verwirfSiteContentEntwurf,
} from '../../lib/siteContentService'
import { leseCmsEinreichung } from '../../lib/cmsEinreichung'
import {
  buendleWebsite,
  ordnePosteingang,
  zaehleJeProjekt,
  zaehleNachrichten,
  type PosteingangEintrag,
} from './posteingang'

/**
 * Der Kunden-Posteingang: alles, was von Kundenseite auf Kevin wartet, in EINER
 * Warteschlange (Etappe 4, Schritt 3).
 *
 * Setzt auf `useGlobalMessages` auf (Nachrichten über alle Projekte) und ergänzt
 * nur, was dort fehlte: die eingereichten Website-Änderungen aus `site_content`
 * (status='pending'). Beides zusammen, nach Wartezeit sortiert.
 *
 * Kein Schreibpfad wohnt hier: Antworten geht über `projectMessageService`,
 * Freigeben über `siteContentService` — dieselben Funktionen, die auch das
 * Portal bzw. der Projekt-Editor benutzen.
 */

interface SiteContentPendingRow {
  id: string
  project_id: string
  label: string
  section: string
  value_published: string | null
  value_draft: string | null
  draft_updated_at: string | null
}

export function useKundenPosteingang(brandSlug: string | undefined) {
  const nachrichten = useGlobalMessages(brandSlug)
  const { projekte, reload: reloadNachrichten } = nachrichten

  const [website, setWebsite] = useState<SiteContentPendingRow[]>([])
  const [websiteFehler, setWebsiteFehler] = useState<string | null>(null)

  // Stabiler Schlüssel — sonst feuert der Effekt bei jedem Render neu, weil
  // `projekte` ein frisches Array ist.
  const projektIds = useMemo(() => projekte.map((p) => p.id).sort().join(','), [projekte])

  const reloadWebsite = useCallback(async () => {
    const ids = projektIds ? projektIds.split(',') : []
    if (!supabase || ids.length === 0) {
      setWebsite([])
      return
    }
    const { data, error } = await supabase
      .from('site_content')
      .select('id, project_id, label, section, value_published, value_draft, draft_updated_at')
      .in('project_id', ids)
      .eq('status', 'pending')
      .order('draft_updated_at', { ascending: true })

    if (error) {
      // Tabelle fehlt (Migration 0052 nicht gelaufen) → leer statt Fehlerbanner,
      // gleiche Nachsicht wie in useSiteContent.
      if (!/relation .* does not exist/i.test(error.message)) setWebsiteFehler(error.message)
      setWebsite([])
      return
    }
    setWebsiteFehler(null)
    setWebsite((data ?? []) as SiteContentPendingRow[])
  }, [projektIds])

  useEffect(() => {
    void reloadWebsite()
  }, [reloadWebsite])

  const projektName = useCallback(
    (id: string) => projekte.find((p) => p.id === id)?.name ?? 'Projekt',
    [projekte],
  )

  const eintraege = useMemo<PosteingangEintrag[]>(() => {
    /**
     * Die Einreichungs-Nachricht ("[website:12] Die Preise sind neu …") ist
     * kein eigener Posten, sondern die Notiz zum Website-Vorgang. Sie wird hier
     * aus der Nachrichtenliste genommen und an das Bündel gehängt — sonst stünde
     * derselbe Vorgang zweimal in der Schlange und Kevin hakte einmal zu viel ab.
     */
    const notizJeProjekt = new Map<string, string>()
    const nurEchteNachrichten = nachrichten.ungelesen.filter((m) => {
      const eingereicht = leseCmsEinreichung(m.body)
      if (!eingereicht) return true
      if (eingereicht.notiz) notizJeProjekt.set(m.project_id, eingereicht.notiz)
      return false
    })

    const ausNachrichten: PosteingangEintrag[] = nurEchteNachrichten.map((m) => ({
      id: m.id,
      art: 'nachricht',
      projektId: m.project_id,
      projektName: m.project_name,
      titel: m.sender_name?.trim() || m.project_name,
      seit: m.created_at,
      text: m.body,
      alt: null,
      neu: null,
      bereich: null,
    }))

    const ausWebsite: PosteingangEintrag[] = website.map((f) => ({
      id: f.id,
      art: 'website',
      projektId: f.project_id,
      projektName: projektName(f.project_id),
      titel: f.label,
      seit: f.draft_updated_at ?? '',
      text: null,
      alt: f.value_published,
      neu: f.value_draft,
      bereich: f.section,
    }))

    return ordnePosteingang([...ausNachrichten, ...buendleWebsite(ausWebsite, notizJeProjekt)])
  }, [nachrichten.ungelesen, website, projektName])

  const jeProjekt = useMemo(() => zaehleJeProjekt(eintraege), [eintraege])
  const nachrichtenAnzahl = useMemo(() => zaehleNachrichten(eintraege), [eintraege])

  /** Antwort an den Kunden — landet im Portal und löst die Benachrichtigung aus. */
  const antworte = useCallback(
    async (projektId: string, text: string, senderName: string) => {
      const res = await sendeProjektNachricht({
        projectId: projektId,
        senderRole: 'owner',
        senderName,
        body: text,
      })
      return res
    },
    [],
  )

  const hakeNachrichtAb = useCallback(
    (messageId: string) => nachrichten.markRead(messageId),
    [nachrichten],
  )

  /**
   * Freigeben und Verwerfen gelten seit 0086 für die ganze Einreichung, nicht
   * für ein Feld: ein Aufruf, eine Transaktion, alles oder nichts. Die
   * Einzelfeld-Funktionen bleiben für den Projekt-Editor bestehen, wo Kevin
   * bewusst ein einzelnes Feld anfasst.
   */
  const gibWebsiteFrei = useCallback(
    async (eintrag: PosteingangEintrag) => {
      const res = eintrag.felder
        ? await gibProjektFrei(eintrag.projektId)
        : await gibSiteContentFrei(eintrag.id, eintrag.neu)
      await reloadWebsite()
      return res
    },
    [reloadWebsite],
  )

  const verwirfWebsite = useCallback(
    async (eintrag: PosteingangEintrag) => {
      const res = eintrag.felder
        ? await verwirfProjektEntwuerfe(eintrag.projektId)
        : await verwirfSiteContentEntwurf(eintrag.id, eintrag.alt)
      await reloadWebsite()
      return res
    },
    [reloadWebsite],
  )

  const reload = useCallback(async () => {
    await Promise.all([reloadNachrichten(), reloadWebsite()])
  }, [reloadNachrichten, reloadWebsite])

  return {
    eintraege,
    jeProjekt,
    nachrichtenAnzahl,
    loading: nachrichten.loading,
    error: nachrichten.error ?? websiteFehler,
    reload,
    antworte,
    hakeNachrichtAb,
    gibWebsiteFrei,
    verwirfWebsite,
  }
}
