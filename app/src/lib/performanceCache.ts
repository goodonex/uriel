import type { BusinessTarget, DailyMetricTargets } from '../types/db'

const businessTargetsBySlug = new Map<string, BusinessTarget>()
const dailyTargetsBySlug = new Map<string, DailyMetricTargets>()
const mrrBySlug = new Map<string, number>()

export function readCachedBusinessTargets(slug: string): BusinessTarget | undefined {
  return businessTargetsBySlug.get(slug)
}

export function writeCachedBusinessTargets(slug: string, row: BusinessTarget): void {
  businessTargetsBySlug.set(slug, row)
}

export function readCachedDailyTargets(slug: string): DailyMetricTargets | undefined {
  return dailyTargetsBySlug.get(slug)
}

export function writeCachedDailyTargets(slug: string, row: DailyMetricTargets): void {
  dailyTargetsBySlug.set(slug, row)
}

export function readCachedMrr(slug: string): number | undefined {
  return mrrBySlug.get(slug)
}

export function writeCachedMrr(slug: string, mrr: number): void {
  mrrBySlug.set(slug, mrr)
}
