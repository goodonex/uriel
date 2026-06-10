import {
  isDeliverProjectDetailPath,
  promoPathForPanel,
  promoPanelIndexFromPath,
  recalledSectionPanelPath,
  salesContactIdFromPath,
  salesPathForPanel,
  salesPanelIndexFromPath,
} from './horizontalPanels'

export const SECTION_ORDER = [
  'dashboard',
  'foundation',
  'promo',
  'sales',
  'deliver',
  'intelligence',
] as const

export type SectionKey = (typeof SECTION_ORDER)[number]

export const SECTION_LABELS: Record<SectionKey, string> = {
  dashboard: 'Dashboard',
  foundation: 'Foundation',
  promo: 'Promo',
  sales: 'Sales',
  deliver: 'Deliver',
  intelligence: 'Intelligence',
}

export function sectionFromPathname(pathname: string): SectionKey {
  if (!/^\/brand\/[^/]+/.test(pathname)) return 'dashboard'
  if (/^\/brand\/[^/]+\/?$/.test(pathname) || /^\/brand\/[^/]+\/dashboard\/?$/.test(pathname)) {
    return 'dashboard'
  }
  if (
    /^\/brand\/[^/]+\/(foundation|building|discovery)(\/|$)/.test(pathname)
  ) {
    return 'foundation'
  }
  if (/^\/brand\/[^/]+\/promo(\/|$)/.test(pathname)) return 'promo'
  if (/^\/brand\/[^/]+\/sales(\/|$)/.test(pathname)) return 'sales'
  if (/^\/brand\/[^/]+\/deliver(\/|$)/.test(pathname)) return 'deliver'
  if (/^\/brand\/[^/]+\/intelligence(\/|$)/.test(pathname)) return 'intelligence'
  return 'dashboard'
}

/** Scroll-Top einer Section relativ zum Scroll-Container (transform-sicher). */
export function getSectionScrollTop(
  scrollRoot: HTMLElement,
  sectionEl: HTMLElement,
): number {
  const rootRect = scrollRoot.getBoundingClientRect()
  const elRect = sectionEl.getBoundingClientRect()
  return scrollRoot.scrollTop + (elRect.top - rootRect.top)
}

/** Kein Wechsel zu anderen Modus-Sections per Scroll (Kontakt- oder Projekt-Detail). */
export function isSectionScrollLocked(pathname: string): boolean {
  return Boolean(salesContactIdFromPath(pathname)) || isDeliverProjectDetailPath(pathname)
}

export function pathForSection(
  slug: string,
  section: SectionKey,
  fromPathname?: string,
): string {
  switch (section) {
    case 'dashboard':
      return `/brand/${slug}`
    case 'foundation':
      return `/brand/${slug}/foundation`
    case 'promo': {
      if (fromPathname && sectionFromPathname(fromPathname) === 'promo') {
        return fromPathname
      }
      const recalled = recalledSectionPanelPath(slug, 'promo')
      if (recalled) return recalled
      return promoPathForPanel(slug, promoPanelIndexFromPath(fromPathname ?? ''))
    }
    case 'sales': {
      if (fromPathname && sectionFromPathname(fromPathname) === 'sales') {
        return fromPathname
      }
      const recalled = recalledSectionPanelPath(slug, 'sales')
      if (recalled) return recalled
      return salesPathForPanel(slug, salesPanelIndexFromPath(fromPathname ?? ''))
    }
    case 'deliver':
      return `/brand/${slug}/deliver`
    case 'intelligence':
      return `/brand/${slug}/intelligence`
    default:
      return `/brand/${slug}`
  }
}
