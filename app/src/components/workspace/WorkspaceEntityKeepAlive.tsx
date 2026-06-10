import { useEffect, useMemo, useRef } from 'react'
import { useBrandWorkspaceTabs } from '../../hooks/useBrandWorkspaceTabs'
import {
  adCampaignIdFromPath,
  deliverProjectIdFromPath,
  isEntityDetailPath,
} from '../../lib/workspaceTabs'
import { salesContactIdFromPath } from '../../lib/horizontalPanels'
import { ContactPage } from '../../pages/sales/ContactPage'
import { ProjectPage } from '../../pages/deliver/ProjectPage'
import { AdsPanel } from '../../pages/promo/AdsPanel'
import { ContactListsContent } from '../../pages/sales/ContactListsContent'
import { PostCallFlowProvider } from '../../hooks/usePostCallFlow'
import { PostCallModal } from '../sales/PostCallModal'
import { BRAND_FLOAT_SIDEBAR_CLEARANCE_X } from '../BrandWorkspaceSidebar'

function salesListIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/lists\/([^/]+)/)
  return m?.[1] ?? null
}

function WorkspaceTabPanel({
  slug,
  path,
  active,
  isMobile,
}: {
  slug: string
  path: string
  active: boolean
  isMobile: boolean
}) {
  const contactId = salesContactIdFromPath(path)
  const projectId = deliverProjectIdFromPath(path)
  const campaignId = adCampaignIdFromPath(path)
  const listId = salesListIdFromPath(path)

  if (!contactId && !projectId && !campaignId && !listId) return null

  let content = null
  if (contactId) {
    content = (
      <PostCallFlowProvider>
        <ContactPage
          variant="page"
          scrollInParent
          slugOverride={slug}
          contactIdOverride={contactId}
        />
        {slug ? <PostCallModal brandSlug={slug} /> : null}
      </PostCallFlowProvider>
    )
  } else if (projectId) {
    content = (
      <ProjectPage slugOverride={slug} projectIdOverride={projectId} embeddedInTabs />
    )
  } else if (campaignId) {
    content = <AdsPanel slug={slug} campaignIdOverride={campaignId} embeddedInTabs />
  } else if (listId) {
    content = <ContactListsContent slug={slug} listId={listId} embedded />
  }

  if (!content) return null

  return (
    <div
      style={{
        display: active ? 'block' : 'none',
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        pointerEvents: active ? 'auto' : 'none',
        padding: isMobile ? '8px 10px 24px' : '8px 12px 24px',
      }}
    >
      {content}
    </div>
  )
}

/**
 * Keep-Alive nur bei 2+ Entity-Tabs. Einzelner Kontakt läuft weiter über SalesSection/Scroll-Flow.
 */
export function WorkspaceEntityKeepAlive({
  slug,
  pathname,
  isMobile,
  enabled,
}: {
  slug: string
  pathname: string
  isMobile: boolean
  enabled: boolean
}) {
  const { tabs, activeId } = useBrandWorkspaceTabs(slug)
  const mountedIdsRef = useRef<Set<string>>(new Set())

  const entityTabs = useMemo(
    () => tabs.filter((t) => isEntityDetailPath(t.path)),
    [tabs],
  )

  useEffect(() => {
    if (activeId) mountedIdsRef.current.add(activeId)
  }, [activeId])

  if (!enabled || entityTabs.length < 2 || !isEntityDetailPath(pathname)) return null

  const tabsToRender = entityTabs.filter(
    (t) => t.id === activeId || mountedIdsRef.current.has(t.id),
  )

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--workspace-tab-offset, 0px)',
        left: isMobile ? 0 : BRAND_FLOAT_SIDEBAR_CLEARANCE_X,
        right: 0,
        bottom: 0,
        zIndex: 35,
        overflow: 'hidden',
        background: 'color-mix(in srgb, var(--bg-base) 94%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {tabsToRender.map((tab) => (
        <WorkspaceTabPanel
          key={tab.id}
          slug={slug}
          path={tab.path}
          active={tab.id === activeId}
          isMobile={isMobile}
        />
      ))}
    </div>
  )
}
