import { generateId } from './storage'
import type {
  DeliverableArea,
  DeliverableItem,
  DeliverableType,
  DeliverProjectStage,
} from '../types/db'

export interface DeliverableTemplate {
  type: DeliverableType
  area: DeliverableArea
  title: string
  description: string
}

export const DELIVERABLE_CATALOG: DeliverableTemplate[] = [
  {
    type: 'brand_strategy',
    area: 'branding',
    title: 'Brand Strategy',
    description: 'Strategisches Fundament: Positionierung, Zielgruppe und Markenversprechen.',
  },
  {
    type: 'logo',
    area: 'branding',
    title: 'Logo',
    description: 'Dein Markenzeichen — für alle Kanäle optimiert und downloadbar.',
  },
  {
    type: 'brand_guidelines',
    area: 'branding',
    title: 'Brand Guidelines',
    description: 'Regeln für den einheitlichen Auftritt deiner Marke.',
  },
  {
    type: 'color_palette',
    area: 'branding',
    title: 'Farbpalette',
    description: 'Primär- und Akzentfarben für Print und Digital.',
  },
  {
    type: 'typography',
    area: 'branding',
    title: 'Typografie',
    description: 'Schriften und Hierarchie für alle Touchpoints.',
  },
  {
    type: 'moodboard',
    area: 'branding',
    title: 'Bildsprache / Moodboard',
    description: 'Visuelle Richtung und Stimmung deiner Marke.',
  },
  {
    type: 'sitemap',
    area: 'website',
    title: 'Seitenstruktur / Sitemap',
    description: 'Übersicht aller Seiten und Navigation deiner Website.',
  },
  {
    type: 'design_concept',
    area: 'website',
    title: 'Design-Konzept',
    description: 'Visuelles Konzept für Look & Feel der Website.',
  },
  {
    type: 'website_development',
    area: 'website',
    title: 'Entwicklung',
    description: 'Technische Umsetzung — Fortschritt in Echtzeit.',
  },
  {
    type: 'website_live_url',
    area: 'website',
    title: 'Live-URL',
    description: 'Deine Website online — jederzeit erreichbar.',
  },
  {
    type: 'performance_score',
    area: 'website',
    title: 'Performance-Score',
    description: 'PageSpeed und technische Qualität deiner Website.',
  },
]

export const DELIVERABLE_TYPE_OPTIONS: { type: DeliverableType; label: string }[] = [
  ...DELIVERABLE_CATALOG.map((t) => ({ type: t.type, label: t.title })),
  { type: 'custom', label: 'Eigene Position' },
]

const STAGE_INDEX: Record<DeliverProjectStage, number> = {
  onboarding: 0,
  discover: 1,
  inner_world: 2,
  visual_world: 3,
  execute: 4,
}

export function isWebsiteAreaVisible(clientStage: DeliverProjectStage): boolean {
  return STAGE_INDEX[clientStage] >= STAGE_INDEX.discover
}

export function isLeadGenAreaVisible(clientStage: DeliverProjectStage): boolean {
  return clientStage === 'execute'
}

function deliverableId(type: DeliverableType): string {
  return `dlv-${type}`
}

/** Vollständige Deliverable-Liste: Katalog + gespeicherte Werte mergen. */
export function mergeWithCatalogDeliverables(stored: DeliverableItem[]): DeliverableItem[] {
  const byType = new Map<DeliverableType, DeliverableItem>()
  const customs: DeliverableItem[] = []

  for (const item of stored) {
    if (item.type && item.type !== 'custom') {
      byType.set(item.type, item)
    } else if (item.type === 'custom' || !item.type) {
      customs.push({
        ...item,
        id: item.id || generateId(),
        type: item.type ?? 'custom',
      })
    }
  }

  const catalogItems = DELIVERABLE_CATALOG.map((tpl) => {
    const existing = byType.get(tpl.type)
    const now = new Date().toISOString()
    if (existing) {
      return {
        id: existing.id || deliverableId(tpl.type),
        type: tpl.type,
        area: tpl.area,
        title: existing.title || tpl.title,
        description: existing.description || tpl.description,
        status: existing.status,
        updated_at: existing.updated_at || now,
        url: existing.url,
        added_at: existing.added_at,
        progress: existing.progress,
      }
    }
    return {
      id: deliverableId(tpl.type),
      type: tpl.type,
      area: tpl.area,
      title: tpl.title,
      description: tpl.description,
      status: 'geplant' as const,
      updated_at: now,
    }
  })

  return [...catalogItems, ...customs]
}

export function createCustomDeliverable(title = 'Eigene Position'): DeliverableItem {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    type: 'custom',
    area: 'branding',
    title,
    status: 'geplant',
    updated_at: now,
  }
}

export function deliverablesForArea(
  items: DeliverableItem[],
  area: DeliverableArea,
): DeliverableItem[] {
  return items.filter((d) => d.area === area || (!d.area && area === 'branding'))
}

export function areaProgress(items: DeliverableItem[]): { ready: number; total: number } {
  const total = items.length
  const ready = items.filter((d) => d.status === 'fertig').length
  return { ready, total }
}

export function placeholderHint(
  type: DeliverableType | undefined,
  clientStage: DeliverProjectStage,
): string {
  if (type === 'website_development') return 'Entwicklung startet nach Design-Freigabe'
  if (!isWebsiteAreaVisible(clientStage)) return 'Kommt nach Abschluss des Brandings'
  return 'Wird vorbereitet…'
}
