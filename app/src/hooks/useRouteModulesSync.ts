import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useModuleManager } from '../store/moduleManager'

const WORKSPACE_OUTLET_ID = 'workspace-outlet'

function isEditableEscTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return false
}

export interface RouteModulesSyncOptions {
  slug: string
  pathname: string
  enabled: boolean
  modeLabel: string
  mobile: boolean
  /** Desktop Scroll-Flow: Module-Manager nicht nutzen */
  scrollFlowDesktop?: boolean
  /** Mobile Brand-Home: volles Dashboard ohne Modul-Manager */
  brandSystemMobile?: boolean
}

function isBrandSystemDesktopPath(pathname: string): boolean {
  return /^\/brand\/[^/]+\/?$/.test(pathname) || /^\/brand\/[^/]+\/dashboard\/?$/.test(pathname)
}

function isSalesListsPath(pathname: string): boolean {
  return /^\/brand\/[^/]+\/sales\/lists(\/|$)/.test(pathname)
}

function salesListIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/lists\/([^/]+)\/?$/)
  return m?.[1] ?? null
}

function isSalesDesktopModulesPath(pathname: string): boolean {
  if (/^\/brand\/[^/]+\/sales\/?$/.test(pathname)) return true
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)\/?$/)
  if (!m?.[1]) return false
  const seg = m[1]
  if (['lists', 'call-mode', 'new', 'heute', 'pipeline'].includes(seg)) return false
  return true
}

function salesContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)\/?$/)
  if (!m?.[1]) return null
  const seg = m[1]
  if (['lists', 'call-mode', 'new', 'heute', 'pipeline'].includes(seg)) return null
  return seg
}

function deliverProjectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/deliver\/([^/]+)\/?$/)
  return m?.[1] ?? null
}

function isDeliverDesktopPath(pathname: string): boolean {
  return /^\/brand\/[^/]+\/deliver(\/|$)/.test(pathname)
}

/**
 * Hält den Module-Manager mit der aktuellen Brand-Workspace-Route synchron.
 */
export function useRouteModulesSync(opts: RouteModulesSyncOptions) {
  const navigate = useNavigate()
  const open = useModuleManager((s) => s.open)
  const closeAll = useModuleManager((s) => s.closeAll)

  useEffect(() => {
    if (!opts.enabled || opts.scrollFlowDesktop) {
      closeAll()
      return
    }

    if (opts.mobile) {
      if (opts.brandSystemMobile) {
        closeAll()
        return
      }
      closeAll()
      open({
        id: WORKSPACE_OUTLET_ID,
        type: 'workspace-outlet',
        slot: 'main',
        title: opts.modeLabel,
      })
      return
    }

    if (isBrandSystemDesktopPath(opts.pathname)) {
      closeAll()
      open({
        id: 'brand-dashboard',
        type: 'brand-dashboard',
        slot: 'main',
        title: 'Brand-System',
      })
      return
    }

    if (isSalesListsPath(opts.pathname)) {
      const listId = salesListIdFromPath(opts.pathname)
      closeAll()
      if (listId) {
        open({
          id: `sales-list-${listId}`,
          type: 'sales-list-detail',
          slot: 'main',
          title: 'Liste',
        })
      } else {
        open({
          id: 'sales-lists',
          type: 'sales-lists',
          slot: 'main',
          title: 'Listen',
        })
      }
      return
    }

    if (isSalesDesktopModulesPath(opts.pathname)) {
      const contactId = salesContactIdFromPath(opts.pathname)
      closeAll()
      if (contactId) {
        open({
          id: `sales-contact-${contactId}`,
          type: 'contact-detail',
          slot: 'main',
          title: 'Kontakt',
        })
        return
      }
      open({
        id: 'sales-pipeline',
        type: 'pipeline',
        slot: 'main',
        title: 'Pipeline',
      })
      open({
        id: 'sales-tasks',
        type: 'tasks',
        slot: 'side-top',
        title: 'Tasks',
      })
      open({
        id: 'sales-quick-stats',
        type: 'quick-stats',
        slot: 'side-bottom',
        title: 'Kennzahlen',
      })
      return
    }

    if (/^\/brand\/[^/]+\/intelligence\/?$/.test(opts.pathname)) {
      closeAll()
      open({
        id: 'intel-brief',
        type: 'intelligence-morning-brief',
        slot: 'main',
        title: 'Morning Brief',
      })
      open({
        id: 'intel-forecast',
        type: 'intelligence-pipeline-forecast',
        slot: 'side-top',
        title: 'Live-Reports',
      })
      open({
        id: 'intel-winloss',
        type: 'intelligence-win-loss',
        slot: 'side-bottom',
        title: 'Focus',
      })
      return
    }

    if (isDeliverDesktopPath(opts.pathname)) {
      const projectId = deliverProjectIdFromPath(opts.pathname)
      closeAll()
      if (projectId) {
        open({
          id: `deliver-project-${projectId}`,
          type: 'deliver-project',
          slot: 'main',
          title: 'Projekt',
        })
      } else {
        open({
          id: 'deliver-workspace',
          type: 'deliver-workspace',
          slot: 'main',
          title: 'Deliver',
        })
      }
      return
    }

    if (/^\/brand\/[^/]+\/promo\/?$/.test(opts.pathname)) {
      closeAll()
      open({
        id: 'promo-main',
        type: 'promo-main',
        slot: 'main',
        title: 'Promo',
      })
      open({
        id: 'promo-pieces',
        type: 'promo-pieces',
        slot: 'side-top',
        title: 'Pieces',
      })
      open({
        id: 'promo-campaigns',
        type: 'promo-campaigns',
        slot: 'side-bottom',
        title: 'Kampagnen',
      })
      return
    }

    closeAll()
    open({
      id: WORKSPACE_OUTLET_ID,
      type: 'workspace-outlet',
      slot: 'main',
      title: opts.modeLabel,
    })
  }, [
    opts.enabled,
    opts.modeLabel,
    opts.pathname,
    opts.slug,
    opts.mobile,
    opts.scrollFlowDesktop,
    opts.brandSystemMobile,
    open,
    closeAll,
  ])

  useEffect(() => {
    if (!opts.enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isEditableEscTarget(e.target)) return
      const state = useModuleManager.getState()
      const mods = state.modules
      const hasContact = mods.some((m) => m.type === 'contact-detail')
      if (hasContact) {
        navigate(`/brand/${opts.slug}/sales`)
        return
      }
      const overlay = mods.filter((m) => m.slot === 'overlay-right' || m.slot === 'overlay-center')
      if (overlay.length > 0) {
        const last = overlay[overlay.length - 1]
        if (last) state.close(last.id)
        return
      }
      if (mods.length > 0) {
        const last = mods[mods.length - 1]
        if (last) state.close(last.id)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opts.enabled, opts.slug, navigate])
}
