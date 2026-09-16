/**
 * Kunden-Posteingang (Etappe 4, Schritt 3) — reine Logik, kein React, kein
 * Supabase. Geprüft in `scripts/verify-posteingang.ts`.
 *
 * Zwei Dinge warten owner-seitig auf Kevin und hatten seit dem Abriss der alten
 * Brand-Oberfläche keine Oberfläche mehr:
 *   1. `project_messages` mit sender_role='client' und read_at IS NULL
 *   2. `site_content` mit status='pending' (Kunde hat einen Entwurf eingereicht)
 *
 * Beides landet in EINER Warteschlange in /freigaben. `read_at` ist dabei das
 * Erledigt-Flag der Nachricht — es gibt kein zweites Statusfeld, und genau
 * dieselbe Bedingung trägt den Ungelesen-Zähler auf der ProjectCard und die
 * Zeile im Heute-Deck. Ein Ort, eine Wahrheit.
 */

export type PosteingangArt = 'nachricht' | 'website'

export interface PosteingangEintrag {
  /** Zeilen-ID: message.id bzw. site_content.id */
  id: string
  art: PosteingangArt
  projektId: string
  projektName: string
  /** Kundenname bei Nachrichten, Feld-Label bei Website-Änderungen */
  titel: string
  /** Wartet seit — created_at (Nachricht) bzw. draft_updated_at (Website) */
  seit: string
  /** Nachricht: der Text des Kunden. Website: null */
  text: string | null
  /** Website: bisher veröffentlicht. Nachricht: null */
  alt: string | null
  /** Website: was der Kunde einreicht. Nachricht: null */
  neu: string | null
  /** Website: Gruppierung aus site_content.section */
  bereich: string | null
  /**
   * Website, gebündelt: die einzelnen Felder dieser Einreichung. Gesetzt nur
   * am Sammel-Eintrag je Projekt, nicht an den Einzelposten darin.
   */
  felder?: PosteingangEintrag[]
}

/** Das Versprechen im Portal: Antwort in 24 h. Danach ist ein Posten überfällig. */
export const ANTWORT_FRIST_STUNDEN = 24

export interface Wartezeit {
  stunden: number
  label: string
  ueberfaellig: boolean
}

/**
 * Wie lange liegt der Posten schon da? Der Wortlaut ist bewusst derselbe wie
 * am Entwurf in der Arbeitsliste, damit Kevin nicht zwei Zeitsprachen liest.
 */
export function wartetSeit(iso: string | null, jetzt: Date = new Date()): Wartezeit {
  if (!iso) return { stunden: 0, label: 'gerade eben', ueberfaellig: false }
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return { stunden: 0, label: 'gerade eben', ueberfaellig: false }

  const stunden = Math.max(0, Math.floor((jetzt.getTime() - t) / (60 * 60 * 1000)))
  const ueberfaellig = stunden >= ANTWORT_FRIST_STUNDEN

  let label: string
  if (stunden < 1) label = 'gerade eben'
  else if (stunden < 24) label = `seit ${stunden} h`
  else {
    const tage = Math.floor(stunden / 24)
    label = tage === 1 ? 'seit gestern' : `seit ${tage} Tagen`
  }

  return { stunden, label, ueberfaellig }
}

/**
 * Warteschlange: das am längsten Liegende zuerst. Bei exakt gleichem
 * Zeitstempel entscheidet die ID, damit die Reihenfolge über Reloads stabil
 * bleibt (sonst springen Zeilen unter dem Finger weg).
 */
export function ordnePosteingang(eintraege: PosteingangEintrag[]): PosteingangEintrag[] {
  return [...eintraege].sort((a, b) => {
    const cmp = a.seit.localeCompare(b.seit)
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id)
  })
}

/**
 * Zwanzig geänderte Felder sind EIN Vorgang, nicht zwanzig.
 *
 * Vorher stand jedes eingereichte Feld als eigener Posten in der Schlange. Wer
 * eine Stunde lang seine Seite durchgeht, erzeugte damit zwanzig Zeilen, über
 * die zwanzigmal einzeln geurteilt werden musste — und genau daraus wird aus
 * einem Freigabe-Schritt ein Ticketsystem. Ein Kunde denkt nicht in Feldern,
 * er denkt in "meiner Seite".
 *
 * Deshalb: ein Eintrag je Projekt, der die Einzelposten als `felder` mitführt.
 * Die Wartezeit ist die des ÄLTESTEN Feldes — der Vorgang wartet, seit das
 * erste angefasst wurde, nicht seit dem letzten Tippen.
 */
export function buendleWebsite(
  einzelne: PosteingangEintrag[],
  notizJeProjekt: Map<string, string> = new Map(),
): PosteingangEintrag[] {
  const gruppen = new Map<string, PosteingangEintrag[]>()
  for (const e of einzelne) {
    if (e.art !== 'website') continue
    const liste = gruppen.get(e.projektId)
    if (liste) liste.push(e)
    else gruppen.set(e.projektId, [e])
  }

  const gebuendelt: PosteingangEintrag[] = []
  for (const [projektId, felder] of gruppen) {
    const sortiert = [...felder].sort((a, b) => a.seit.localeCompare(b.seit))
    const anzahl = sortiert.length
    gebuendelt.push({
      id: `website:${projektId}`,
      art: 'website',
      projektId,
      projektName: sortiert[0].projektName,
      titel: anzahl === 1 ? 'Website — 1 Änderung' : `Website — ${anzahl} Änderungen`,
      seit: sortiert[0].seit,
      text: notizJeProjekt.get(projektId) ?? null,
      alt: null,
      neu: null,
      bereich: null,
      felder: sortiert,
    })
  }
  return gebuendelt
}

export type AenderungsArt = 'hinzugefuegt' | 'entfernt' | 'geaendert' | 'unveraendert'

export interface Aenderung {
  art: AenderungsArt
  /** Zeichen mehr (+) oder weniger (−) gegenüber dem veröffentlichten Stand */
  zeichenDelta: number
}

/**
 * Alt-Neu-Vergleich für eine Website-Änderung. Bewusst grob: die Zeile sagt
 * nur, WAS für eine Art Änderung ansteht — den genauen Wortlaut liest Kevin
 * im aufgeklappten Vergleich darunter. Ein Wort-Diff wäre hier Show ohne Nutzen.
 */
export function beschreibeAenderung(alt: string | null, neu: string | null): Aenderung {
  const a = (alt ?? '').trim()
  const n = (neu ?? '').trim()
  const zeichenDelta = n.length - a.length

  if (a === n) return { art: 'unveraendert', zeichenDelta: 0 }
  if (a === '') return { art: 'hinzugefuegt', zeichenDelta }
  if (n === '') return { art: 'entfernt', zeichenDelta }
  return { art: 'geaendert', zeichenDelta }
}

export const AENDERUNG_LABEL: Record<AenderungsArt, string> = {
  hinzugefuegt: 'neu befüllt',
  entfernt: 'geleert',
  geaendert: 'geändert',
  unveraendert: 'unverändert',
}

/**
 * Offene Posten je Projekt — trägt den Zähler auf der ProjectCard.
 * Zählt beide Arten, weil beide „an diesem Projekt liegt etwas" bedeuten.
 */
export function zaehleJeProjekt(eintraege: PosteingangEintrag[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of eintraege) {
    m.set(e.projektId, (m.get(e.projektId) ?? 0) + 1)
  }
  return m
}

/** Nur die Kundennachrichten — die Zahl, die das Heute-Deck nennt. */
export function zaehleNachrichten(eintraege: PosteingangEintrag[]): number {
  return eintraege.filter((e) => e.art === 'nachricht').length
}
