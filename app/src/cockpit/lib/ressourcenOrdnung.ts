import type { SalesLibrary } from './salesLibraryApi'

/** Was in der Vorschau offen ist: eine Vault-Notiz oder eine Datei aus dem Skripte-Ordner. */
export type RessourcenWahl =
  | { group: 'vault'; path: string }
  | { group: 'skripte'; rel: string; kind: 'md' | 'html' | 'pdf' }

/**
 * Die Ordnung der Ressourcen (25.09.2026) — reine Funktionen, keine
 * React-Importe, prüfbar per `npx tsx scripts/verify-ressourcen-ordnung.ts`.
 *
 * Kevin: *„Ressourcen sieht einfach scheiße aus … auch da gibt es ja nur eine Hierarchie, was, wann, wo kommt."*
 *
 * Vorher zwei Dateilisten nach Herkunft (Vault / Skripte-Ordner), innerhalb
 * alphabetisch-zufällig. Jetzt die Schritte des Vertriebs in der Reihenfolge,
 * in der sie dran sind — und darunter, eingeklappt, das Hintergrundwissen.
 * Zugeordnet wird über den Dateinamen: Die Notizen heißen seit Monaten
 * gleich, und eine neue Datei ohne Treffer landet sichtbar unter
 * „Hintergrund" statt zu verschwinden.
 */
export interface Schritt {
  id: string
  titel: string
  wann: string
  /** Reihenfolge innerhalb des Schritts = Reihenfolge der Muster. */
  muster: RegExp[]
}

const SCHRITTE: Schritt[] = [
  { id: 'tag', titel: 'Tag planen', wann: 'morgens', muster: [/tagesplan/i] },
  {
    id: 'erst',
    titel: 'Erstkontakt',
    wann: 'nach der Annahme',
    muster: [/outbound-skripte 1 [–-] linkedin/i, /erstnachrichten/i],
  },
  {
    id: 'nach',
    titel: 'Nachfassen',
    wann: 'wenn keine Antwort kommt',
    muster: [/outbound-skripte 1b/i, /follow-up-analyse.*template|template.*follow-up-analyse/i, /follow-up-analyse \(muster\)/i, /follow-up-analyse-rubrik/i],
  },
  {
    id: 'loom',
    titel: 'Loom & Analyse',
    wann: 'nach dem Ja',
    muster: [/funnel-audit/i, /loom-skript \(vollst/i, /nur sprechfassung/i, /loom-batch/i, /loom-warteschlange/i],
  },
  {
    id: 'gespraech',
    titel: 'Gespräch',
    wann: 'Setting & Closing',
    muster: [/outbound-skripte 2 [–-]/i, /outbound-skripte 2b/i, /sales-pr(ä|ae)sentation/i],
  },
  {
    id: 'angebot',
    titel: 'Angebot',
    wann: 'nach dem Closing',
    muster: [/angebots-dokument/i, /^angebot & wertanalyse/i],
  },
]

const HINTERGRUND: Schritt = {
  id: 'hintergrund',
  titel: 'Hintergrund',
  wann: 'zum Nachlesen',
  muster: [
    /^positionierung/i,
    /zielgruppenverst/i,
    /gesamtübersicht|gesamtuebersicht/i,
    /big-m(ä|ae)c/i,
    /whale-liste/i,
    /baseline/i,
    /touchpoints/i,
    /content-strategie/i,
    /./,
  ],
}

export interface RessourcenEintrag {
  key: string
  titel: string
  art: 'md' | 'html' | 'pdf'
  sel: RessourcenWahl
  rang: number
}

/** Dateinamen, die als Titel nichts taugen (Kleinschreibung mit Bindestrichen). */
const TITEL_FUER: Record<string, string> = {
  'follow-up-analyse-template-v2.html': 'Follow-up-Analyse · Vorlage',
  'follow-up-analyse-rubrik.md': 'Follow-up-Analyse · Bewertungsraster',
  'Follow-up-Analyse V2 (Template).pdf': 'Follow-up-Analyse · Vorlage',
  'Follow-up-Analyse (Muster).pdf': 'Follow-up-Analyse · Muster',
}

/** „Tagesplan – Gewinnbringende Aktivitäten (Stand 2026-09-15).md" → „Tagesplan – Gewinnbringende Aktivitäten". */
function sauberTitel(name: string): string {
  const fest = TITEL_FUER[name.split('/').pop() ?? name]
  if (fest) return fest
  // Die Loom-Warteschlangen gibt es mehrfach — bei ihnen IST das Datum der Titel.
  const schlange = /warteschlange \(stand \d{4}-(\d\d)-(\d\d)\)/i.exec(name)
  if (schlange) return `Loom-Warteschlange vom ${schlange[2]}.${schlange[1]}.`
  return name
    .replace(/\.(md|html|pdf)$/i, '')
    .replace(/\s*\((Stand [^)]*|Herrmann & Co|Juli 2026)\)/gi, '')
    .replace(/^\d+\s+/, '')
    .trim()
}

export function ordneRessourcen(library: SalesLibrary): { schritt: Schritt; eintraege: RessourcenEintrag[] }[] {
  const alle: { name: string; eintrag: Omit<RessourcenEintrag, 'rang' | 'titel'> }[] = [
    ...library.vault.map((v) => ({ name: v.name, eintrag: { key: v.path, art: 'md' as const, sel: { group: 'vault' as const, path: v.path } } })),
    ...library.skripte.map((s) => ({
      name: s.name,
      eintrag: { key: s.rel, art: s.kind, sel: { group: 'skripte' as const, rel: s.rel, kind: s.kind } },
    })),
  ]
  const gruppen = new Map<string, RessourcenEintrag[]>()
  for (const { name, eintrag } of alle) {
    // Der Sammel-Hub „Vertrieb & Outreach" ist ein Inhaltsverzeichnis, keine Ressource.
    if (/^vertrieb & outreach(\.md)?$/i.test(name)) continue
    let ziel: Schritt = HINTERGRUND
    let rang = -1
    for (const schritt of SCHRITTE) {
      const i = schritt.muster.findIndex((m) => m.test(name))
      if (i >= 0) {
        ziel = schritt
        rang = i
        break
      }
    }
    if (ziel === HINTERGRUND) rang = HINTERGRUND.muster.findIndex((m) => m.test(name))
    const liste = gruppen.get(ziel.id) ?? []
    liste.push({ ...eintrag, titel: sauberTitel(name), rang })
    gruppen.set(ziel.id, liste)
  }
  return [...SCHRITTE, HINTERGRUND]
    .map((schritt) => ({
      schritt,
      eintraege: (gruppen.get(schritt.id) ?? []).sort((a, b) => a.rang - b.rang || a.titel.localeCompare(b.titel, 'de')),
    }))
    .filter((g) => g.eintraege.length > 0)
}

