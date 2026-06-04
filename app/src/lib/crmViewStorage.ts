import type { CrmFilterState } from './crmFilters'
import { EMPTY_CRM_FILTERS } from './crmFilters'

const VIEW_KEY = 'crm-pipeline-view'
const FILTER_KEY = 'crm-filters'

export type PipelineViewMode = 'cards' | 'table' | 'list' | 'carousel'

export const PIPELINE_VIEW_MODES: PipelineViewMode[] = ['cards', 'table', 'list', 'carousel']

export const PIPELINE_VIEW_LABEL: Record<PipelineViewMode, string> = {
  cards: 'Kanban',
  table: 'Tabelle',
  list: 'Liste',
  carousel: 'Carousel',
}

/** Sortierung der Kontakte innerhalb jeder Kanban-Spalte */
export type KanbanColumnSort =
  | 'follow_up'
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'name_asc'
  | 'name_desc'

const KANBAN_SORT_KEY = 'crm-kanban-column-sort'

export function loadKanbanColumnSort(brandSlug: string): KanbanColumnSort {
  try {
    const v = localStorage.getItem(`${KANBAN_SORT_KEY}:${brandSlug}`)
    const allowed: KanbanColumnSort[] = [
      'follow_up',
      'created_desc',
      'created_asc',
      'updated_desc',
      'updated_asc',
      'name_asc',
      'name_desc',
    ]
    return allowed.includes(v as KanbanColumnSort) ? (v as KanbanColumnSort) : 'follow_up'
  } catch {
    return 'follow_up'
  }
}

export function saveKanbanColumnSort(brandSlug: string, sort: KanbanColumnSort): void {
  try {
    localStorage.setItem(`${KANBAN_SORT_KEY}:${brandSlug}`, sort)
  } catch {
    /* ignore */
  }
}

export function loadPipelineView(brandSlug: string): PipelineViewMode {
  try {
    const v = localStorage.getItem(`${VIEW_KEY}:${brandSlug}`)
    return PIPELINE_VIEW_MODES.includes(v as PipelineViewMode)
      ? (v as PipelineViewMode)
      : 'cards'
  } catch {
    return 'cards'
  }
}

export function savePipelineView(brandSlug: string, mode: PipelineViewMode): void {
  try {
    localStorage.setItem(`${VIEW_KEY}:${brandSlug}`, mode)
  } catch {
    /* ignore */
  }
}

export function loadCrmFilters(brandSlug: string): CrmFilterState {
  try {
    const raw = localStorage.getItem(`${FILTER_KEY}:${brandSlug}`)
    if (!raw) return { ...EMPTY_CRM_FILTERS }
    const p = JSON.parse(raw) as Partial<CrmFilterState>
    return {
      statuses: Array.isArray(p.statuses) ? p.statuses : [],
      stages: Array.isArray(p.stages) ? p.stages : [],
      listIds: Array.isArray(p.listIds) ? p.listIds : [],
      sources: Array.isArray(p.sources) ? p.sources : [],
      activity: p.activity ?? 'all',
      followDue: p.followDue ?? 'all',
    }
  } catch {
    return { ...EMPTY_CRM_FILTERS }
  }
}

export function saveCrmFilters(brandSlug: string, filters: CrmFilterState): void {
  try {
    localStorage.setItem(`${FILTER_KEY}:${brandSlug}`, JSON.stringify(filters))
  } catch {
    /* ignore */
  }
}
