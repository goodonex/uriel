import { loadOne, saveOne } from '../../lib/storage'

/**
 * Persistierte Layout-Einstellungen fürs Cockpit-Home: Fokus-Presets +
 * Größen-Regler (Sidebar-Breite, Graph-Höhe). Key: brand-os:cockpit:layout.
 */

export type LayoutPreset = 'tracking' | 'balanced' | 'graph'

export interface CockpitLayout {
  preset: LayoutPreset
  /** Breite der linken Tracking-Spalte in px (220–340). */
  sidebarPx: number
  /** Wunschhöhe des OS-Graphen in px (420–820); Mobile-Clamp greift separat. */
  graphHeight: number
}

export const LAYOUT_LIMITS = {
  sidebar: { min: 200, max: 480 },
  graph: { min: 380, max: 1400 },
} as const

export const LAYOUT_PRESETS: Record<LayoutPreset, CockpitLayout> = {
  tracking: { preset: 'tracking', sidebarPx: 340, graphHeight: 460 },
  balanced: { preset: 'balanced', sidebarPx: 280, graphHeight: 700 },
  graph: { preset: 'graph', sidebarPx: 220, graphHeight: 820 },
}

export const PRESET_LABEL: Record<LayoutPreset, string> = {
  tracking: 'Fokus Tracking',
  balanced: 'Ausgewogen',
  graph: 'Fokus Graph',
}

const KEY = ['cockpit', 'layout']

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function loadCockpitLayout(): CockpitLayout {
  const stored = loadOne<Partial<CockpitLayout>>(KEY)
  const base = LAYOUT_PRESETS.balanced
  if (!stored) return base
  return {
    preset:
      stored.preset === 'tracking' || stored.preset === 'graph' ? stored.preset : 'balanced',
    sidebarPx: clamp(
      Number(stored.sidebarPx) || base.sidebarPx,
      LAYOUT_LIMITS.sidebar.min,
      LAYOUT_LIMITS.sidebar.max,
    ),
    graphHeight: clamp(
      Number(stored.graphHeight) || base.graphHeight,
      LAYOUT_LIMITS.graph.min,
      LAYOUT_LIMITS.graph.max,
    ),
  }
}

export function saveCockpitLayout(layout: CockpitLayout): void {
  saveOne(KEY, layout)
}
