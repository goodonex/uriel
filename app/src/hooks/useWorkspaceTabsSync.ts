import { useEffect, useLayoutEffect } from 'react'
import { useContacts } from './useContacts'
import { useDeliverProjects } from './useDeliverProjects'
import { useAdCampaigns } from './useAdCampaigns'
import { useBrandWorkspaceTabs, useBrandWorkspaceTabActions } from './useBrandWorkspaceTabs'
import { salesContactIdFromPath } from '../lib/horizontalPanels'
import {
  adCampaignIdFromPath,
  defaultTabTitle,
  deliverProjectIdFromPath,
  isEntityDetailPath,
  parseWorkspaceTabMeta,
} from '../lib/workspaceTabs'
import { useWorkspaceTabs } from '../store/workspaceTabs'

export function useWorkspaceTabsSync(slug: string, pathname: string) {
  const { tabs, activeId } = useBrandWorkspaceTabs(slug)
  const { updateTabTitle, setActive } = useBrandWorkspaceTabActions()

  const contacts = useContacts(slug)
  const projects = useDeliverProjects(slug)
  const campaigns = useAdCampaigns(slug)

  const entityTabs = tabs.filter((t) => isEntityDetailPath(t.path))

  // Drop legacy section tabs (Pipeline, Promo, …) from store once
  useLayoutEffect(() => {
    if (!slug) return
    const all = useWorkspaceTabs.getState().getTabs(slug)
    const stale = all.filter((t) => !isEntityDetailPath(t.path))
    if (stale.length === 0) return
    for (const t of stale) {
      useWorkspaceTabs.getState().closeTab(slug, t.id)
    }
  }, [slug])

  // Only sync active tab when landing on an entity URL that already has a tab
  useLayoutEffect(() => {
    if (!slug || !isEntityDetailPath(pathname)) return
    const existing = entityTabs.find((t) => t.path === pathname)
    if (existing) setActive(slug, existing.id)
  }, [entityTabs, pathname, setActive, slug])

  useEffect(() => {
    if (!slug || !activeId) return
    const tab = entityTabs.find((t) => t.id === activeId)
    if (!tab) return

    const meta = parseWorkspaceTabMeta(tab.path)
    let title: string | null = null

    if (meta.kind === 'contact' && meta.entityId) {
      const c = contacts.items.find((x) => x.id === meta.entityId)
      title = c?.name?.trim() || c?.email?.trim() || null
    } else if (meta.kind === 'project' && meta.entityId) {
      const p = projects.items.find((x) => x.id === meta.entityId)
      title = p?.name?.trim() || null
    } else if (meta.kind === 'ad-campaign' && meta.entityId) {
      const a = campaigns.items.find((x) => x.id === meta.entityId)
      title = a?.name?.trim() || a?.hook?.trim() || null
    }

    if (title && title !== tab.title) {
      updateTabTitle(slug, tab.id, title)
    }
  }, [
    activeId,
    campaigns.items,
    contacts.items,
    entityTabs,
    projects.items,
    slug,
    updateTabTitle,
  ])

  const entityTabCount = entityTabs.length

  return { tabs: entityTabs, activeId, entityTabCount }
}

export function resolveTabTitleForPath(
  pathname: string,
  contacts: { id: string; name?: string; email?: string }[],
  projects: { id: string; name?: string }[],
  campaigns: { id: string; name?: string; hook?: string }[],
): string {
  const contactId = salesContactIdFromPath(pathname)
  if (contactId) {
    const c = contacts.find((x) => x.id === contactId)
    return c?.name?.trim() || c?.email?.trim() || 'Kontakt'
  }
  const projectId = deliverProjectIdFromPath(pathname)
  if (projectId) {
    const p = projects.find((x) => x.id === projectId)
    return p?.name?.trim() || 'Projekt'
  }
  const campaignId = adCampaignIdFromPath(pathname)
  if (campaignId) {
    const a = campaigns.find((x) => x.id === campaignId)
    return a?.name?.trim() || a?.hook?.trim() || 'Ad'
  }
  return defaultTabTitle(pathname)
}
