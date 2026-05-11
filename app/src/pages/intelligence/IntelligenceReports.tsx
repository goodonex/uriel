import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useActivityLog } from '../../hooks/useActivityLog'
import { useContacts } from '../../hooks/useContacts'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { useTasks } from '../../hooks/useTasks'
import type { Contact, PipelineStage } from '../../types/db'

const STAGE_PROBABILITY: Record<PipelineStage, number> = {
  first_contact: 0.1,
  conversation: 0.3,
  proposal: 0.55,
  deal: 0.95,
  paused: 0,
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

function annualEuro(c: Contact): number {
  const amount = c.potenzial_betrag ?? 0
  if (amount <= 0) return 0
  if (c.potenzial_typ === 'monatlich') return amount * 12
  if (c.potenzial_typ === 'jährlich') return amount
  return amount
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

interface PipelineForecastResult {
  weighted: number
  pessimistic: number
  optimistic: number
  byStage: Array<{ stage: PipelineStage; count: number; sum: number; weighted: number }>
  bestDeal: { contact: Contact; weighted: number } | null
}

function calcPipelineForecast(contacts: Contact[]): PipelineForecastResult {
  let weighted = 0
  let pessimistic = 0
  let optimistic = 0
  const byStage: Record<PipelineStage, { count: number; sum: number; weighted: number }> = {
    first_contact: { count: 0, sum: 0, weighted: 0 },
    conversation: { count: 0, sum: 0, weighted: 0 },
    proposal: { count: 0, sum: 0, weighted: 0 },
    deal: { count: 0, sum: 0, weighted: 0 },
    paused: { count: 0, sum: 0, weighted: 0 },
  }
  let bestDeal: { contact: Contact; weighted: number } | null = null

  for (const c of contacts) {
    const annual = annualEuro(c)
    const prob = STAGE_PROBABILITY[c.pipeline_stage] ?? 0
    const w = annual * prob
    weighted += w
    pessimistic += annual * Math.max(0, prob - 0.2)
    optimistic += annual * Math.min(1, prob + 0.2)
    byStage[c.pipeline_stage].count += 1
    byStage[c.pipeline_stage].sum += annual
    byStage[c.pipeline_stage].weighted += w
    if (!bestDeal || w > bestDeal.weighted) {
      bestDeal = { contact: c, weighted: w }
    }
  }

  return {
    weighted,
    pessimistic,
    optimistic,
    byStage: (Object.keys(byStage) as PipelineStage[])
      .filter((s) => s !== 'paused')
      .map((s) => ({ stage: s, ...byStage[s] })),
    bestDeal,
  }
}

interface ActivityHeatmapBucket {
  date: string
  count: number
}

function buildActivityBuckets(
  iso_dates: string[],
  days = 28,
): ActivityHeatmapBucket[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets: ActivityHeatmapBucket[] = []
  const map = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    map.set(key, 0)
    buckets.push({ date: key, count: 0 })
  }
  for (const iso of iso_dates) {
    try {
      const key = new Date(iso).toISOString().slice(0, 10)
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1)
    } catch {
      /* ignore */
    }
  }
  return buckets.map((b) => ({ date: b.date, count: map.get(b.date) ?? 0 }))
}

interface IntelligenceReportsProps {
  slug: string
}

export function IntelligenceReports({ slug }: IntelligenceReportsProps) {
  const contacts = useContacts(slug)
  const projects = useDeliverProjects(slug)
  const tasks = useTasks(slug)
  const activity = useActivityLog(slug, 200)

  const forecast = useMemo(() => calcPipelineForecast(contacts.items), [contacts.items])
  const heatmap = useMemo(
    () => buildActivityBuckets(activity.items.map((a) => a.created_at), 28),
    [activity.items],
  )
  const maxBucket = useMemo(
    () => heatmap.reduce((m, b) => Math.max(m, b.count), 0),
    [heatmap],
  )

  const funnel = useMemo(() => {
    const order: PipelineStage[] = ['first_contact', 'conversation', 'proposal', 'deal']
    const counts: Record<PipelineStage, number> = {
      first_contact: 0,
      conversation: 0,
      proposal: 0,
      deal: 0,
      paused: 0,
    }
    for (const c of contacts.items) counts[c.pipeline_stage] = (counts[c.pipeline_stage] ?? 0) + 1
    // Kumulative Counts (Leads, die mindestens diese Stage erreicht haben)
    let cum = 0
    const cumulative: Record<PipelineStage, number> = { ...counts }
    for (let i = order.length - 1; i >= 0; i--) {
      cum += counts[order[i]]
      cumulative[order[i]] = cum
    }
    const rows: Array<{ stage: PipelineStage; count: number; conv: number }> = []
    for (let i = 0; i < order.length; i++) {
      const s = order[i]
      const next = order[i + 1]
      const fromN = cumulative[s] || 0
      const toN = next ? (cumulative[next] || 0) : 0
      const conv = fromN > 0 && next ? Math.round((toN / fromN) * 100) : 0
      rows.push({ stage: s, count: cumulative[s], conv })
    }
    return rows
  }, [contacts.items])

  const timeInStage = useMemo(() => {
    const buckets: Record<PipelineStage, number[]> = {
      first_contact: [],
      conversation: [],
      proposal: [],
      deal: [],
      paused: [],
    }
    for (const c of contacts.items) {
      if (!c.stage_changed_at) continue
      const d = (Date.now() - new Date(c.stage_changed_at).getTime()) / 86400000
      if (!Number.isFinite(d) || d < 0) continue
      buckets[c.pipeline_stage].push(d)
    }
    const result: Array<{ stage: PipelineStage; avg: number; count: number; stale: number }> = []
    for (const s of Object.keys(buckets) as PipelineStage[]) {
      const arr = buckets[s]
      const avg = arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
      const stale = arr.filter((d) => d > 14).length
      result.push({ stage: s, avg: Math.round(avg), count: arr.length, stale })
    }
    return result
  }, [contacts.items])

  const winLoss = useMemo(() => {
    const won = contacts.items.filter((c) => c.won_at).length
    const lost = contacts.items.filter((c) => c.lost_at).length
    const lostReasons = new Map<string, number>()
    for (const c of contacts.items) {
      if (!c.lost_at) continue
      const r = (c.lost_reason || 'Unbekannt').trim() || 'Unbekannt'
      lostReasons.set(r, (lostReasons.get(r) ?? 0) + 1)
    }
    const reasons = Array.from(lostReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    const ratio = won + lost === 0 ? 0 : Math.round((won / (won + lost)) * 100)
    return { won, lost, ratio, reasons }
  }, [contacts.items])

  const velocity = useMemo(() => {
    const arr = contacts.items
    const closedDeals = arr.filter((c) => c.pipeline_stage === 'deal')
    const ageDays = (iso: string | null) => {
      if (!iso) return null
      const d = new Date(iso).getTime()
      if (Number.isNaN(d)) return null
      return Math.max(0, Math.round((Date.now() - d) / 86400000))
    }
    const openAges = arr
      .filter((c) => c.pipeline_stage !== 'deal' && c.pipeline_stage !== 'paused')
      .map((c) => ageDays(c.last_contact_at ?? c.next_follow_up_at))
      .filter((x): x is number => x !== null)
    const avgOpenDays =
      openAges.length === 0
        ? 0
        : Math.round(openAges.reduce((s, n) => s + n, 0) / openAges.length)
    return {
      totalLeads: arr.length,
      closedDeals: closedDeals.length,
      conversionRate:
        arr.length === 0 ? 0 : Math.round((closedDeals.length / arr.length) * 100),
      avgOpenDays,
      activeProjects: projects.items.filter((p) => p.status === 'active').length,
      openTasks: tasks.items.filter(
        (t) => t.status === 'open' || t.status === 'in_progress',
      ).length,
    }
  }, [contacts.items, projects.items, tasks.items])

  return (
    <div className="space-y-6">
      <ReportCard
        label="PIPELINE FORECAST"
        title="Erwarteter Umsatz aus aktuellem Funnel"
        accent="var(--mode-sales)"
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Pessimistisch"
            value={fmtEuro(forecast.pessimistic)}
            tone="var(--text-tertiary)"
          />
          <Stat
            label="Gewichtet"
            value={fmtEuro(forecast.weighted)}
            tone="var(--accent-teal)"
            big
          />
          <Stat
            label="Optimistisch"
            value={fmtEuro(forecast.optimistic)}
            tone="var(--accent-blue)"
          />
        </div>
        <div className="space-y-2">
          {forecast.byStage.map((s) => {
            const max = Math.max(
              1,
              ...forecast.byStage.map((x) => x.weighted),
            )
            const pct = Math.round((s.weighted / max) * 100)
            return (
              <div key={s.stage}>
                <div
                  className="font-mono mb-1 flex items-baseline justify-between"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  <span>
                    {STAGE_LABEL[s.stage]} · {s.count} Leads
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {fmtEuro(s.weighted)}{' '}
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      / {fmtEuro(s.sum)}
                    </span>
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--glass-2)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      height: '100%',
                      background: 'var(--mode-sales)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {forecast.bestDeal && forecast.bestDeal.weighted > 0 ? (
          <div
            className="font-mono mt-4 rounded-md"
            style={{
              padding: '8px 12px',
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-border-1)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              letterSpacing: '0.02em',
            }}
          >
            Größter erwarteter Deal:{' '}
            <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>
              {forecast.bestDeal.contact.name || forecast.bestDeal.contact.email}
            </span>{' '}
            mit ~{fmtEuro(forecast.bestDeal.weighted)}.
          </div>
        ) : null}
      </ReportCard>

      <ReportCard
        label="FUNNEL CONVERSION"
        title="Wo verlierst du deine Leads"
        accent="var(--mode-sales)"
      >
        <div className="space-y-2">
          {funnel.map((row, idx) => {
            const max = Math.max(1, ...funnel.map((r) => r.count))
            const pct = Math.round((row.count / max) * 100)
            const isLast = idx === funnel.length - 1
            return (
              <div key={row.stage}>
                <div
                  className="font-mono mb-1 flex items-baseline justify-between"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  <span>
                    {STAGE_LABEL[row.stage]} · {row.count} Leads
                  </span>
                  {!isLast ? (
                    <span style={{ color: row.conv >= 50 ? 'var(--accent-teal)' : row.conv >= 20 ? 'var(--text-secondary)' : 'var(--accent-coral)' }}>
                      → {row.conv}% weiter
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-teal)' }}>Abschluss</span>
                  )}
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--glass-2)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                    style={{
                      height: '100%',
                      background: isLast ? 'var(--accent-teal)' : 'var(--mode-sales)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </ReportCard>

      <ReportCard
        label="TIME IN STAGE"
        title="Wo Leads festhängen"
        accent="var(--accent-coral)"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {timeInStage
            .filter((r) => r.stage !== 'paused' && r.count > 0)
            .map((r) => (
              <div
                key={r.stage}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-1)',
                  background: r.avg > 14 ? 'color-mix(in srgb, var(--accent-coral) 8%, transparent)' : 'var(--glass-1)',
                }}
              >
                <div
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}
                >
                  {STAGE_LABEL[r.stage].toUpperCase()}
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: r.avg > 14 ? 'var(--accent-coral)' : 'var(--text-primary)',
                  }}
                >
                  Ø {r.avg}d
                </div>
                <div
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  {r.count} Leads
                  {r.stale > 0 ? (
                    <span style={{ color: 'var(--accent-coral)' }}>
                      {' · '}
                      {r.stale} &gt; 14d
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
        {timeInStage.every((r) => r.count === 0) ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 12 }}>
            Noch keine Stage-Wechsel mit Zeitstempel.
          </div>
        ) : null}
      </ReportCard>

      <ReportCard
        label="WIN / LOSS"
        title="Was du gewinnst, was du verlierst"
        accent="var(--accent-teal)"
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Won" value={winLoss.won.toString()} tone="var(--accent-teal)" big />
          <Stat label="Lost" value={winLoss.lost.toString()} tone="var(--accent-coral)" />
          <Stat label="Win-Rate" value={`${winLoss.ratio}%`} tone="var(--accent-teal)" />
        </div>
        {winLoss.reasons.length > 0 ? (
          <div>
            <div
              className="font-mono mb-2"
              style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}
            >
              TOP LOST-GRÜNDE
            </div>
            {winLoss.reasons.map(([reason, count]) => {
              const max = winLoss.reasons[0][1]
              const pct = Math.round((count / max) * 100)
              return (
                <div key={reason} style={{ marginBottom: 6 }}>
                  <div
                    className="font-mono mb-1 flex items-baseline justify-between"
                    style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  >
                    <span>{reason}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{count}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--glass-2)' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--accent-coral)',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 8 }}>
            Noch keine Lost-Reasons erfasst.
          </div>
        )}
      </ReportCard>

      <ReportCard
        label="SALES VELOCITY"
        title="Wie schnell läuft dein Funnel"
        accent="var(--accent-teal)"
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Leads gesamt" value={velocity.totalLeads.toString()} />
          <Stat
            label="Conversion"
            value={`${velocity.conversionRate}%`}
            tone="var(--accent-teal)"
          />
          <Stat
            label="Ø Lead-Alter"
            value={`${velocity.avgOpenDays}d`}
            tone={velocity.avgOpenDays > 30 ? 'var(--accent-coral)' : 'var(--text-secondary)'}
          />
          <Stat
            label="Offene Tasks"
            value={velocity.openTasks.toString()}
            tone={velocity.openTasks > 10 ? 'var(--accent-coral)' : 'var(--text-secondary)'}
          />
        </div>
        <div
          className="font-mono mt-3"
          style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}
        >
          {velocity.avgOpenDays > 30
            ? '⚠ Leads im offenen Funnel altern — Follow-Ups gehen unter.'
            : velocity.conversionRate > 0 && velocity.conversionRate < 5
            ? 'Niedrige Conversion. ICP überprüfen oder Qualifizierung schärfen.'
            : 'Funnel-Geschwindigkeit im grünen Bereich.'}
        </div>
      </ReportCard>

      <ReportCard
        label="AKTIVITÄT · 28 TAGE"
        title="Was passiert in dieser Brand"
        accent="var(--accent-blue)"
      >
        {maxBucket === 0 ? (
          <div
            className="font-body"
            style={{
              padding: 16,
              fontSize: 13,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}
          >
            Noch keine Aktivität aufgezeichnet — Aktionen erscheinen automatisch hier.
          </div>
        ) : (
          <>
            <div
              className="flex items-end justify-between gap-1"
              style={{ height: 64 }}
            >
              {heatmap.map((b) => {
                const intensity = maxBucket === 0 ? 0 : b.count / maxBucket
                const height = Math.max(2, Math.round(intensity * 56))
                return (
                  <div
                    key={b.date}
                    className="flex-1"
                    title={`${b.date}: ${b.count} Aktionen`}
                    style={{ minWidth: 0 }}
                  >
                    <div
                      style={{
                        height,
                        marginTop: 64 - height,
                        borderRadius: 3,
                        background:
                          b.count === 0
                            ? 'var(--glass-2)'
                            : `color-mix(in srgb, var(--accent-blue) ${20 + intensity * 70}%, transparent)`,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div
              className="font-mono mt-2 flex items-baseline justify-between"
              style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              <span>vor 28 Tagen</span>
              <span>
                {activity.items.length} Aktionen · Peak {maxBucket}
              </span>
              <span>heute</span>
            </div>
          </>
        )}
      </ReportCard>
    </div>
  )
}

function ReportCard({
  label,
  title,
  accent,
  children,
}: {
  label: string
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl"
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        padding: '18px 20px',
      }}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.14em', color: accent }}
          >
            {label}
          </div>
          <h3
            className="font-display mt-1"
            style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}
          >
            {title}
          </h3>
        </div>
      </div>
      {children}
    </section>
  )
}

function Stat({
  label,
  value,
  tone = 'var(--text-primary)',
  big,
}: {
  label: string
  value: string
  tone?: string
  big?: boolean
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-1)',
        padding: '10px 12px',
      }}
    >
      <div
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
      >
        {label}
      </div>
      <div
        className="font-display mt-0.5"
        style={{
          fontSize: big ? 22 : 16,
          fontWeight: 600,
          color: tone,
          letterSpacing: '-0.2px',
        }}
      >
        {value}
      </div>
    </div>
  )
}
