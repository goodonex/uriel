import { isLeadGenAreaVisible, isWebsiteAreaVisible } from './deliverableCatalog'
import type { DeliverProject, DeliverProjectStage, DeliverableType } from '../types/db'

export type PortalTab = 'overview' | 'branding' | 'website' | 'leads' | 'crm'

export interface PortalTabDef {
  id: PortalTab
  label: string
  icon: string
}

const TAB_BRANDING: PortalTabDef = { id: 'branding', label: 'Branding', icon: '◆' }
const TAB_WEBSITE: PortalTabDef = { id: 'website', label: 'Website', icon: '◈' }
const TAB_LEADS: PortalTabDef = { id: 'leads', label: 'Lead Gen', icon: '📈' }
const TAB_CRM: PortalTabDef = { id: 'crm', label: 'CRM', icon: '👥' }
const TAB_OVERVIEW: PortalTabDef = { id: 'overview', label: 'Übersicht', icon: '◎' }

export function getDefaultPortalTab(stage: DeliverProjectStage): PortalTab {
  if (isLeadGenAreaVisible(stage)) return 'overview'
  if (isWebsiteAreaVisible(stage)) return 'website'
  return 'branding'
}

/** Sichtbare Tabs je Phase — in Lead Gen keine Branding/Website-Tabs. */
export function getVisiblePortalTabs(stage: DeliverProjectStage): PortalTabDef[] {
  if (isLeadGenAreaVisible(stage)) {
    return [TAB_OVERVIEW, TAB_LEADS, TAB_CRM]
  }
  const tabs: PortalTabDef[] = [TAB_OVERVIEW]
  tabs.push(TAB_BRANDING)
  if (isWebsiteAreaVisible(stage)) tabs.push(TAB_WEBSITE)
  if (stage === 'visual_world') {
    tabs.push({ ...TAB_LEADS, label: 'Lead Gen (bald)' })
  }
  return tabs
}

export function isPortalTabLocked(tab: PortalTab, stage: DeliverProjectStage): boolean {
  if (tab === 'branding') return false
  if (tab === 'website') return !isWebsiteAreaVisible(stage)
  if (tab === 'leads' || tab === 'crm') return !isLeadGenAreaVisible(stage)
  return false
}

export function getDeliverableUrl(
  project: DeliverProject,
  type: DeliverableType,
): string | null {
  const item = project.deliverables.find(
    (d) => d.type === type && d.status === 'fertig' && d.url && d.url !== '#',
  )
  return item?.url ?? null
}

export function getPortalPhaseLabel(stage: DeliverProjectStage): string {
  if (isLeadGenAreaVisible(stage)) return 'Lead Generation'
  if (isWebsiteAreaVisible(stage) && stage !== 'discover') return 'Website'
  if (stage === 'discover') return 'Discovery & Website'
  return 'Branding'
}
