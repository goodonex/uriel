import type { DeliverProject, DeliverableArea } from '../types/db'

export type ProjectAreaKey = DeliverableArea

/** Pitch-Projekte: Name endet mit „— Pitch“ (Contact Page). */
export function isPitchProject(project: Pick<DeliverProject, 'name'> | null | undefined): boolean {
  if (!project?.name) return false
  return project.name.includes('— Pitch')
}

export interface ProjectAreaChip {
  key: ProjectAreaKey
  label: string
}

const AREA_LABEL: Record<ProjectAreaKey, string> = {
  branding: 'Branding',
  website: 'Website',
  leadgen: 'Lead Gen',
}

export function getProjectAreaChips(project: DeliverProject | null): ProjectAreaChip[] {
  if (!project) return []
  const areas = new Set<ProjectAreaKey>()
  for (const deliverable of project.deliverables) {
    if (deliverable.area === 'branding' || deliverable.area === 'website' || deliverable.area === 'leadgen') {
      areas.add(deliverable.area)
    }
  }
  return (['branding', 'website', 'leadgen'] as const)
    .filter((key) => areas.has(key))
    .map((key) => ({ key, label: AREA_LABEL[key] }))
}
