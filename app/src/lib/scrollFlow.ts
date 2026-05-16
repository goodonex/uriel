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

export function pathForSection(slug: string, section: SectionKey): string {
  switch (section) {
    case 'dashboard':
      return `/brand/${slug}`
    case 'foundation':
      return `/brand/${slug}/foundation`
    case 'promo':
      return `/brand/${slug}/promo`
    case 'sales':
      return `/brand/${slug}/sales`
    case 'deliver':
      return `/brand/${slug}/deliver`
    case 'intelligence':
      return `/brand/${slug}/intelligence`
    default:
      return `/brand/${slug}`
  }
}
