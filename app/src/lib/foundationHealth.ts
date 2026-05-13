import type { ICP, Positioning, WordBankEntry } from '../types/db'

interface FoundationHealthArgs {
  icps: ICP[]
  positioning: Positioning | null
  wordBank: WordBankEntry[]
}

/**
 * Grober Foundation-Health-Score (0-100) für die Building-Region.
 */
export function foundationHealth({
  icps,
  positioning,
  wordBank,
}: FoundationHealthArgs): number {
  let score = 0

  if (positioning?.statement?.trim()) score += 30
  if (positioning?.tone_of_voice?.trim()) score += 15
  if (positioning?.business_model) score += 20
  if (icps.length > 0) score += 20
  if (wordBank.length >= 5) score += 15

  return Math.max(0, Math.min(100, score))
}
