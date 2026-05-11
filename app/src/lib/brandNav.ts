export type BrandNavSection =
  | 'dashboard'
  | 'building'
  | 'discovery'
  | 'promo'
  | 'sales'
  | 'sales_lists'
  | 'deliver'
  | 'intelligence'

export function parseBrandNavSection(pathname: string): BrandNavSection {
  if (pathname.includes('/dashboard')) return 'dashboard'
  if (pathname.includes('/building')) return 'building'
  if (pathname.includes('/discovery')) return 'discovery'
  if (pathname.includes('/promo')) return 'promo'
  if (pathname.includes('/intelligence')) return 'intelligence'
  if (pathname.includes('/sales/lists')) return 'sales_lists'
  if (pathname.includes('/sales')) return 'sales'
  if (pathname.includes('/deliver')) return 'deliver'
  return 'dashboard'
}
