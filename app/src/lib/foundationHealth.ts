import type { DiscoveryFoundationDoc, ICP, Positioning, WordBankEntry } from '../types/db'

interface FoundationHealthArgs {
  icps: ICP[]
  positioning: Positioning | null
  wordBank: WordBankEntry[]
  discoveryFoundation?: DiscoveryFoundationDoc | null
}

/**
 * Foundation-Health-Score (0-100):
 * - Positioning Statement: 20
 * - Tone of Voice: 10
 * - Business Model: 15
 * - ICPs vorhanden: 15
 * - Word Bank >= 5 Einträge: 10
 * - Discovery Markt/Kontext: 10
 * - Discovery Wettbewerber: 10
 * - Discovery Nische/Schwerpunkt: 10
 */
export function foundationHealth({
  icps,
  positioning,
  wordBank,
  discoveryFoundation,
}: FoundationHealthArgs): number {
  let score = 0

  if (positioning?.statement?.trim()) score += 20
  if (positioning?.tone_of_voice?.trim()) score += 10
  if (positioning?.business_model) score += 15
  if (icps.length > 0) score += 15
  if (wordBank.length >= 5) score += 10
  if (discoveryFoundation?.market?.trim()) score += 10
  if (discoveryFoundation?.competitors?.trim()) score += 10
  if (discoveryFoundation?.niche?.trim()) score += 10

  return Math.max(0, Math.min(100, score))
}
