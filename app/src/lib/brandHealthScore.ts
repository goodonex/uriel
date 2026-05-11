import type { Asset, BusinessModelDoc, ICP, Positioning, WordBankEntry } from '../types/db'

function filledStatement(p: Positioning | null): boolean {
  return Boolean(p?.statement?.trim())
}

function icpHasDetail(icp: ICP): boolean {
  const name = icp.name?.trim()
  if (!name) return false
  return Boolean(
    icp.age_range?.trim() ||
      icp.location?.trim() ||
      icp.pain_points.length > 0 ||
      icp.notes?.trim() ||
      icp.word_clusters.length > 0,
  )
}

function hasGoodIcp(icps: ICP[]): boolean {
  return icps.some(icpHasDetail)
}

export interface BuildingHealthResult {
  percent: number
  missing: string[]
}

export function computeBuildingHealth(input: {
  positioning: Positioning | null
  icps: ICP[]
  wordBank: WordBankEntry[]
  businessModel: BusinessModelDoc | null
  assets: Asset[]
}): BuildingHealthResult {
  const missing: string[] = []
  let pts = 0

  if (filledStatement(input.positioning)) pts += 20
  else missing.push('Positioning Statement')

  if (hasGoodIcp(input.icps)) pts += 20
  else missing.push('ICP vervollständigen')

  const yes = input.wordBank.filter((w) => w.type === 'yes').length
  const no = input.wordBank.filter((w) => w.type === 'no').length
  if (yes >= 3) pts += 15
  else missing.push(`${Math.max(0, 3 - yes)} Ja-Wörter fehlen`)
  if (no >= 3) pts += 15
  else missing.push(`${Math.max(0, 3 - no)} Nein-Wörter fehlen`)

  const who = input.businessModel?.who?.trim()
  if (who) pts += 15
  else missing.push('Business Model „Wer“')

  if (input.assets.length >= 1) pts += 15
  else missing.push('Mindestens 1 Asset')

  return {
    percent: Math.min(100, pts),
    missing: [...new Set(missing)],
  }
}

export function healthScoreColor(percent: number): string {
  if (percent <= 40) return '#ef4444'
  if (percent <= 70) return '#f97316'
  return '#22c55e'
}
