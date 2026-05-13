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
  /** Mobile Brand-Home: volles Dashboard ohne Modul-Manager */
  brandSystemMobile?: boolean
}

function isBrandSystemDesktopPath(pathname: string): boolean {
  return /^\/brand\/[^/]+\/?$/.test(pathname) || /^\/brand\/[^/]+\/dashboard\/?$/.test(pathname)
}

function isSalesDesktopModulesPath(pathname: string): boolean {
  if (/^\/brand\/[^/]+\/sales\/?$/.test(pathname)) return true
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)\/?$/)
  if (!m?.[1]) return false
  const seg = m[1]
  if (seg === 'lists' || seg === 'call-mode') return false
  return true
}

function salesContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)\/?$/)
  if (!m?.[1]) return null
  const seg = m[1]
  if (seg === 'lists' || seg === 'call-mode') return null
  return seg
}

/**
 * Hält den Module-Manager mit der aktuellen Brand-Workspace-Route synchron.
 */
export function useRouteModulesSync(opts: RouteModulesSyncOptions) {
  const navigate = useNavigate()
  const open = useModuleManager((s) => s.open)
  const closeAll = useModuleManager((s) => s.closeAll)

  useEffect(() => {
    if (!opts.enabled) {
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

    if (isSalesDesktopModulesPath(opts.pathname)) {
      const contactId = salesContactIdFromPath(opts.pathname)
      closeAll()
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
      if (contactId) {
        open({
          id: `sales-contact-${contactId}`,
          type: 'contact-detail',
          slot: 'overlay-right',
          title: 'Kontakt',
        })
      }
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

    if (/^\/brand\/[^/]+\/promo\/?$/.test(opts.pathname)) {
      closeAll()
      open({
        id: 'promo-calendar',
        type: 'promo-calendar',
        slot: 'main',
        title: 'Kalender',
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
    opts.brandSystemMobile,
    open,
    closeAll,
  ])

  useEffect(() => {
    if (!opts.enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isEditableEscTarget(e.target)) return
      const mods = useModuleManager.getState().modules
      const hasContact = mods.some((m) => m.type === 'contact-detail')
      if (hasContact) {
        navigate(`/brand/${opts.slug}/sales`)
        return
      }
      if (mods.length === 1 && mods[0]?.type === 'brand-dashboard') {
        navigate('/')
        return
      }
      navigate(`/brand/${opts.slug}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opts.enabled, opts.slug, navigate])
}
