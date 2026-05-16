/** URL-Segmente und Panel-Indizes für horizontales Scrollen in Sections */

export const PROMO_PANELS = [
  { id: 'funnel', label: 'Funnel', segment: '' },
  { id: 'dashboard', label: 'Performance', segment: 'performance' },
  { id: 'kalender', label: 'Kalender', segment: 'kalender' },
  { id: 'email', label: 'E-Mail', segment: 'email' },
  { id: 'ads', label: 'Ads', segment: 'ads' },
  { id: 'ideen', label: 'Ideen', segment: 'ideen' },
  { id: 'flows', label: 'Flows', segment: 'flows' },
  { id: 'sequenzen', label: 'Sequenzen', segment: 'sequenzen' },
] as const

export const SALES_PANELS = [
  { id: 'pipeline', label: 'Pipeline', segment: '' },
  { id: 'listen', label: 'Listen', segment: 'lists' },
] as const

export const DELIVER_PANELS = [
  { id: 'active', label: 'Aktiv', segment: '' },
  { id: 'completed', label: 'Abgeschlossen', segment: 'completed' },
  { id: 'moon', label: 'Mond-Status', segment: 'moon' },
] as const

function segmentFromPath(pathname: string, base: string): string {
  const re = new RegExp(`/brand/[^/]+/${base}/([^/]+)`)
  const m = pathname.match(re)
  return m?.[1] ?? ''
}

export function promoPanelIndexFromPath(pathname: string): number {
  if (!pathname.includes('/promo')) return 0
  const seg = segmentFromPath(pathname, 'promo')
  if (!seg) return 0
  const idx = PROMO_PANELS.findIndex((p) => p.segment === seg)
  return idx >= 0 ? idx : 0
}

export function promoPathForPanel(slug: string, index: number): string {
  const panel = PROMO_PANELS[index] ?? PROMO_PANELS[0]
  const base = `/brand/${slug}/promo`
  return panel.segment ? `${base}/${panel.segment}` : base
}

export function salesPanelIndexFromPath(pathname: string): number {
  if (pathname.includes('/sales/lists')) return 1
  if (/^\/brand\/[^/]+\/sales\/?$/.test(pathname)) return 0
  if (pathname.includes('/sales/call-mode')) return 0
  const contact = pathname.match(/^\/brand\/[^/]+\/sales\/([^/]+)/)
  if (contact?.[1] && contact[1] !== 'lists' && contact[1] !== 'call-mode') return 0
  return 0
}

export function salesPathForPanel(slug: string, index: number): string {
  const base = `/brand/${slug}/sales`
  return index === 1 ? `${base}/lists` : base
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
