/**
 * Graph-Datenmodell (REBUILD-PLAN §5.1): echte Knoten, klickbar.
 * Phase 2: Mock-Daten in exakt der Form, die Phase 3/5 liefern werden.
 */

export type NodeKind = 'hub' | 'deal' | 'run' | 'note'

export interface GraphNode {
  id: string
  kind: NodeKind
  label: string
  /** Ziel beim Klick: route (in-App), obsidian (URL) oder run (Panel) */
  href?: string
  /** Laufender Agent-Run → pulsiert */
  active?: boolean
  /** relative Größe 1..3 */
  weight?: number
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export const NODE_COLORS: Record<NodeKind, string> = {
  hub: '#f2f4f5',
  deal: '#34d399', // Grün: Geld
  run: '#8ee7c3', // helleres Akzent-Grün: Agenten-Outputs
  note: '#64748b', // Blaugrau: Wissen
}

export const NODE_LEGEND: Array<{ kind: NodeKind; label: string }> = [
  { kind: 'deal', label: 'Deals' },
  { kind: 'run', label: 'Agent-Runs' },
  { kind: 'note', label: 'Notizen' },
]

/** Mock — Phase 3 ersetzt Deals durch Supabase, Phase 5 Runs/Notizen durch Runner-API. */
export function buildMockGraph(brandName: string): GraphData {
  const nodes: GraphNode[] = [
    { id: 'hub', kind: 'hub', label: brandName, weight: 3 },
    // Deals (→ /crm)
    { id: 'deal-1', kind: 'deal', label: 'Müller GmbH · 3k', href: '/crm', weight: 2 },
    { id: 'deal-2', kind: 'deal', label: 'Schneider & Co · 5k', href: '/crm', weight: 3 },
    { id: 'deal-3', kind: 'deal', label: 'Weber Consulting · 3k', href: '/crm', weight: 2 },
    { id: 'deal-4', kind: 'deal', label: 'Fischer Bau · 2k Upsell', href: '/crm', weight: 1 },
    // Agent-Runs (→ Ergebnis-Panel, Phase 5)
    { id: 'run-1', kind: 'run', label: 'Wochenrecap KW28', weight: 2 },
    { id: 'run-2', kind: 'run', label: 'Lead-Research: Braun AG', weight: 1 },
    { id: 'run-3', kind: 'run', label: 'Follow-ups 06.07.', weight: 1, active: true },
    // Vault-Notizen (→ obsidian://)
    { id: 'note-1', kind: 'note', label: 'Loom-Skript v3', href: 'obsidian://open?vault=Second%20Brain', weight: 1 },
    { id: 'note-2', kind: 'note', label: 'ICP Handwerk', href: 'obsidian://open?vault=Second%20Brain', weight: 1 },
    { id: 'note-3', kind: 'note', label: 'Preislogik 3k+2k+500', href: 'obsidian://open?vault=Second%20Brain', weight: 1 },
    { id: 'note-4', kind: 'note', label: 'Einwand-Bibliothek', href: 'obsidian://open?vault=Second%20Brain', weight: 1 },
  ]

  const links: GraphLink[] = [
    { source: 'hub', target: 'deal-1' },
    { source: 'hub', target: 'deal-2' },
    { source: 'hub', target: 'deal-3' },
    { source: 'hub', target: 'deal-4' },
    { source: 'hub', target: 'run-1' },
    { source: 'hub', target: 'run-2' },
    { source: 'hub', target: 'run-3' },
    { source: 'run-2', target: 'deal-4' },
    { source: 'note-1', target: 'run-3' },
    { source: 'hub', target: 'note-1' },
    { source: 'hub', target: 'note-2' },
    { source: 'note-2', target: 'deal-2' },
    { source: 'hub', target: 'note-3' },
    { source: 'hub', target: 'note-4' },
    { source: 'note-4', target: 'deal-1' },
  ]

  return { nodes, links }
}
