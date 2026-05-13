export type BrandNavSection =
  | 'dashboard'
  /** Building + Discovery — gemeinsame Sidebar-Gruppe */
  | 'foundation'
  | 'promo'
  | 'sales'
  | 'sales_lists'
  | 'deliver'
  | 'intelligence'

export function parseBrandNavSection(pathname: string): BrandNavSection {
  if (pathname.includes('/dashboard')) return 'dashboard'
  if (
    pathname.includes('/foundation') ||
    pathname.includes('/building') ||
    pathname.includes('/discovery')
  ) {
    return 'foundation'
  }
  if (pathname.includes('/promo')) return 'promo'
  if (pathname.includes('/intelligence')) return 'intelligence'
  if (pathname.includes('/sales/lists')) return 'sales_lists'
  if (pathname.includes('/sales')) return 'sales'
  if (pathname.includes('/deliver')) return 'deliver'
  return 'dashboard'
}
