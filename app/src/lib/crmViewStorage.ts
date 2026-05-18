import type { CrmFilterState } from './crmFilters'
import { EMPTY_CRM_FILTERS } from './crmFilters'

const VIEW_KEY = 'crm-pipeline-view'
const FILTER_KEY = 'crm-filters'

export type PipelineViewMode = 'cards' | 'table'

export function loadPipelineView(brandSlug: string): PipelineViewMode {
  try {
    const v = localStorage.getItem(`${VIEW_KEY}:${brandSlug}`)
    return v === 'table' ? 'table' : 'cards'
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
