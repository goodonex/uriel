/** URL-Segmente und Panel-Indizes für horizontales Scrollen in Sections */

export const PROMO_PANELS = [
  { id: 'overview', label: 'Übersicht', segment: '' },
  { id: 'funnel', label: 'Funnel', segment: 'funnel' },
  { id: 'dashboard', label: 'Performance', segment: 'performance' },
  { id: 'kalender', label: 'Kalender', segment: 'kalender' },
  { id: 'email-flows', label: 'E-Mail & Flows', segment: 'email-flows' },
  { id: 'ads', label: 'Ads', segment: 'ads' },
  { id: 'ideen', label: 'Ideen', segment: 'ideen' },
  { id: 'sequenzen', label: 'Sequenzen', segment: 'sequenzen' },
] as const

export const SALES_PANELS = [
  { id: 'overview', label: 'Übersicht', segment: '' },
  { id: 'pipeline', label: 'Pipeline', segment: 'pipeline' },
  { id: 'listen', label: 'Listen', segment: 'lists' },
  { id: 'heute', label: 'Heute', segment: 'heute' },
] as const

export const DELIVER_PANELS = [
  { id: 'active', label: 'Aktiv', segment: '' },
  { id: 'completed', label: 'Abgeschlossen', segment: 'completed' },
  { id: 'moon', label: 'Mond-Status', segment: 'moon' },
] as const

const SALES_RESERVED = new Set(['lists', 'call-mode', 'new', 'heute', 'pipeline'])

function segmentFromPath(pathname: string, base: string): string {
  const re = new RegExp(`/brand/[^/]+/${base}/([^/]+)`)
  const m = pathname.match(re)
  return m?.[1] ?? ''
}

export function rememberSectionPanelPath(slug: string, section: 'promo' | 'sales', pathname: string) {
  try {
    sessionStorage.setItem(`brand:${slug}:${section}:panelPath`, pathname)
  } catch {
    /* ignore */
  }
}

export function recalledSectionPanelPath(slug: string, section: 'promo' | 'sales'): string | null {
  try {
    const v = sessionStorage.getItem(`brand:${slug}:${section}:panelPath`)
    return v && v.includes(`/brand/${slug}/${section}`) ? v : null
  } catch {
    return null
  }
}

export function promoPanelIndexFromPath(pathname: string): number {
  if (!pathname.includes('/promo')) return 0
  const seg = segmentFromPath(pathname, 'promo')
  if (!seg) return 0
  if (seg === 'email' || seg === 'flows') {
    return PROMO_PANELS.findIndex((p) => p.segment === 'email-flows')
  }
  const idx = PROMO_PANELS.findIndex((p) => p.segment === seg)
  return idx >= 0 ? idx : 0
}

export function promoPathForPanel(slug: string, index: number): string {
  const panel = PROMO_PANELS[index] ?? PROMO_PANELS[0]
  const base = `/brand/${slug}/promo`
  if (!panel.segment) return base
  if (panel.segment === 'funnel') return `${base}/funnel`
  return `${base}/${panel.segment}`
}

export function isSalesNewLeadPath(pathname: string): boolean {
  return /^\/brand\/[^/]+\/sales\/new\/?$/.test(pathname)
}

export function salesContactIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)\/?$/)
  if (!m?.[1]) return null
  if (SALES_RESERVED.has(m[1])) return null
  return m[1]
}

export function salesPanelIndexFromPath(pathname: string): number {
  if (pathname.includes('/sales/heute')) return 3
  if (pathname.includes('/sales/lists')) return 2
  if (pathname.includes('/sales/pipeline')) return 1
  if (/^\/brand\/[^/]+\/sales\/?$/.test(pathname)) return 0
  if (pathname.includes('/sales/call-mode')) return 0
  if (isSalesNewLeadPath(pathname)) return 0
  if (salesContactIdFromPath(pathname)) return 0
  return 0
}

export function salesPathForPanel(slug: string, index: number): string {
  const panel = SALES_PANELS[index] ?? SALES_PANELS[0]
  const base = `/brand/${slug}/sales`
  return panel.segment ? `${base}/${panel.segment}` : base
}

export function deliverPanelIndexFromPath(pathname: string): number {
  if (!pathname.includes('/deliver')) return 0
  if (/^\/brand\/[^/]+\/deliver\/[^/]+/.test(pathname)) {
    const seg = segmentFromPath(pathname, 'deliver')
    if (seg === 'completed') return 1
    if (seg === 'moon') return 2
    return 0
  }
  const seg = segmentFromPath(pathname, 'deliver')
  if (seg === 'completed') return 1
  if (seg === 'moon') return 2
  return 0
}

export function deliverPathForPanel(slug: string, index: number): string {
  const panel = DELIVER_PANELS[index] ?? DELIVER_PANELS[0]
  const base = `/brand/${slug}/deliver`
  return panel.segment ? `${base}/${panel.segment}` : base
}

export function isDeliverProjectDetailPath(pathname: string): boolean {
  const m = pathname.match(/^\/brand\/[^/]+\/deliver\/([^/]+)\/?$/)
  if (!m?.[1]) return false
  return m[1] !== 'completed' && m[1] !== 'moon'
}
