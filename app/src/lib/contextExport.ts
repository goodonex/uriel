import {
  DELIVER_STAGE_ORDER,
  type Asset,
  type Brand,
  type BusinessModelDoc,
  type Contact,
  type DeliverProject,
  type DeliverProjectStage,
  type ICP,
  type PipelineStage,
  type Positioning,
  type WordBankEntry,
} from '../types/db'

interface BuildContextArgs {
  brand: Brand
  positioning: Positioning | null
  icps: ICP[]
  wordBank: WordBankEntry[]
  businessModel?: BusinessModelDoc | null
  assets?: Asset[]
  contacts?: Contact[]
  deliverProjects?: DeliverProject[]
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

function businessModelLines(
  doc: BusinessModelDoc | null | undefined,
): Array<string | null> {
  if (!doc) return []
  return [
    line('BUSINESS_MODEL_WER', doc.who),
    line('BUSINESS_MODEL_WAS', doc.what),
    line('BUSINESS_MODEL_WIE', doc.how),
    line('BUSINESS_MODEL_FUER_WEN', doc.for_whom),
    line('BUSINESS_MODEL_WOMIT', doc.revenue),
  ]
}

function activeChannelsLine(assets: Asset[] | undefined): string | null {
  if (!assets?.length) return null
  const withUrl = assets.filter((a) => a.url?.trim())
  if (withUrl.length === 0) return null
  const formatted = withUrl.map((a) => {
    const u = a.url.trim()
    const label = a.name?.trim() ? `${a.name.trim()} (${a.type})` : a.type
    return `${label}: ${u}`
  })
  return `ACTIVE_CHANNELS: ${formatted.join(' · ')}`
}

const SALES_PIPELINE_ORDER: PipelineStage[] = [
  'first_contact',
  'conversation',
  'proposal',
  'deal',
  'paused',
]

function ymdToday(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function salesOverdueFollowUps(contacts: Contact[]): number {
  const today = ymdToday()
  return contacts.filter((c) => {
    if (!c.next_follow_up_at) return false
    return c.next_follow_up_at.slice(0, 10) <= today
  }).length
}

function buildSalesSnapshotBlock(contacts: Contact[]): string {
  const counts: Record<PipelineStage, number> = {
    first_contact: 0,
    conversation: 0,
    proposal: 0,
    deal: 0,
    paused: 0,
  }
  for (const c of contacts) counts[c.pipeline_stage]++
  const overdue = salesOverdueFollowUps(contacts)
  const byStage = SALES_PIPELINE_ORDER.map((s) => `${s}:${counts[s]}`).join(' ')
  return [
    '---',
    'SALES_SNAPSHOT',
    `CONTACTS_TOTAL: ${contacts.length}`,
    `BY_STAGE: ${byStage}`,
    `OVERDUE_FOLLOWUPS: ${overdue}`,
  ].join('\n')
}

function buildDeliverSnapshotBlock(projects: DeliverProject[]): string {
  const active = projects.filter((p) => p.status === 'active')
  const stageCounts: Record<DeliverProjectStage, number> = {
    onboarding: 0,
    discover: 0,
    inner_world: 0,
    visual_world: 0,
    execute: 0,
  }
  for (const p of active) stageCounts[p.internal_stage]++
  const byStage = DELIVER_STAGE_ORDER.map((s) => `${s}:${stageCounts[s]}`).join(
    ' ',
  )
  const latest = [...projects].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  )[0]
  const latestLine = latest
    ? `${latest.name} · ${latest.internal_stage} (updated ${latest.updated_at.slice(0, 10)})`
    : 'none'
  return [
    '---',
    'DELIVER_SNAPSHOT',
    `ACTIVE_PROJECTS: ${active.length}`,
    `ACTIVE_BY_INTERNAL_STAGE: ${byStage}`,
    `LATEST_PROJECT_STAGE: ${latestLine}`,
  ].join('\n')
}

export function buildContextMarkdown({
  brand,
  positioning,
  icps,
  wordBank,
  businessModel,
  assets,
  contacts,
  deliverProjects,
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
    ...businessModelLines(businessModel),
    activeChannelsLine(assets),
    line('GENERATED_AT', new Date().toISOString()),
  ]

  const main = lines.filter((l): l is string => l !== null).join('\n')
  const tail: string[] = []
  if (contacts !== undefined) tail.push(buildSalesSnapshotBlock(contacts))
  if (deliverProjects !== undefined)
    tail.push(buildDeliverSnapshotBlock(deliverProjects))
  return tail.length > 0 ? `${main}\n${tail.join('\n')}` : main
}
