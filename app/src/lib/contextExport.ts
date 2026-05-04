import type { Brand, ICP, Positioning, WordBankEntry } from '../types/db'

interface BuildContextArgs {
  brand: Brand
  positioning: Positioning | null
  icps: ICP[]
  wordBank: WordBankEntry[]
}

function line(key: string, value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null
  return `${key}: ${value.trim()}`
}

function icpLine(prefix: string, icp: ICP | undefined): string[] {
  if (!icp) return []
  const identity = [icp.name, icp.age_range, icp.location]
    .filter((s) => s && s.trim())
    .join(' · ')
  const out: string[] = []
  if (identity) out.push(`${prefix}: ${identity}`)
  if (icp.pain_points.length > 0) {
    out.push(`${prefix}_PAIN: ${icp.pain_points.join(', ')}`)
  }
  if (icp.word_clusters.length > 0) {
    out.push(`${prefix}_CLUSTER: ${icp.word_clusters.join(' · ')}`)
  }
  return out
}

export function buildContextMarkdown({
  brand,
  positioning,
  icps,
  wordBank,
}: BuildContextArgs): string {
  const sorted = [...icps].sort((a, b) => a.priority - b.priority)
  const primary = sorted[0]
  const secondary = sorted[1]

  const yes = wordBank
    .filter((w) => w.type === 'yes')
    .map((w) => w.word)
    .filter(Boolean)
  const no = wordBank
    .filter((w) => w.type === 'no')
    .map((w) => w.word)
    .filter(Boolean)

  const lines: Array<string | null> = [
    line('BRAND', brand.name),
    line('POSITIONING', positioning?.statement ?? ''),
    line('TONE', positioning?.tone_of_voice ?? ''),
    ...icpLine('ICP_PRIMARY', primary),
    ...icpLine('ICP_SECONDARY', secondary),
    line('WORD_BANK_YES', yes.length ? yes.join(' · ') : ''),
    line('WORD_BANK_NO', no.length ? no.join(' · ') : ''),
    line('GENERATED_AT', new Date().toISOString()),
  ]

  return lines.filter((l): l is string => l !== null).join('\n')
}
