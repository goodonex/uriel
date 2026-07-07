import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { CommandDeck } from '../components/CommandDeck'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { DreamCard } from '../components/DreamCard'
import type { RunDoc } from '../components/DocumentsPanel'
import { PrimaryDirective } from '../components/PrimaryDirective'
import { QuickTrack } from '../components/QuickTrack'
import { RunDrawer } from '../components/RunDrawer'
import { VitalsPanel } from '../components/VitalsPanel'
import { ForceGraph } from '../graph/ForceGraph'
import { useActiveBrand } from '../lib/activeBrand'
import { buildGraph, buildMockGraph, NODE_COLORS, NODE_LEGEND } from '../lib/graphData'
import type { GraphNode } from '../lib/graphData'
import { MONTH_TARGETS, WEEK_TARGETS, currentSoll } from '../lib/goals'
import { sumField, weekVitals } from '../lib/metricsAggregate'
import { openInObsidian, postRun } from '../lib/runnerApi'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useRunnerData } from '../lib/useRunnerData'

function GraphLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', padding: '4px 0 8px' }}>
      {NODE_LEGEND.map((l) => (
        <span key={l.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: NODE_COLORS[l.kind],
              display: 'inline-block',
            }}
          />
          <span className="ck-label">{l.label}</span>
        </span>
      ))}
    </div>
  )
}

/** Aktive Pipeline-Stages, die als Deal-Knoten im Graph erscheinen. */
const DEAL_STAGES = new Set(['conversation', 'follow_up', 'proposal'])

function runDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

/**
 * Cockpit-Home (REBUILD-PLAN §5.1) — Phase 5: alles echt.
 * Vitals/Umsatz aus daily_metrics, Runs + Notizen vom Runner,
 * Deals aus dem CRM. Command Deck feuert POST /run mit App-Daten als Input.
 */
export function CockpitHome() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const metrics = useDailyMetrics()
  const { runner, runs, vaultGraph, refresh } = useRunnerData()
  const contacts = useContacts(activeBrand?.slug)
  const [openRunId, setOpenRunId] = useState<string | null>(null)

  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.monthRows),
    [metrics.weekRows, metrics.monthRows],
  )
  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])

  const graph = useMemo(() => {
    if (runner.state !== 'online') {
      return buildMockGraph(activeBrand?.name ?? 'Kevin OS')
    }
    const deals = contacts.items
      .filter((c) => DEAL_STAGES.has(c.pipeline_stage))
      .slice(0, 8)
      .map((c) => ({ id: c.id, label: c.company || c.name }))
    return buildGraph({
      brandName: activeBrand?.name ?? 'Kevin OS',
      deals,
      runs: runs.slice(0, 10).map((r) => ({
        id: r.id,
        label: r.agent,
        active: r.status === 'running',
      })),
      notes: vaultGraph.nodes,
      noteEdges: vaultGraph.edges,
    })
  }, [runner.state, activeBrand?.name, contacts.items, runs, vaultGraph])

  const onNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.kind === 'deal' && node.href) {
        navigate(node.href)
      } else if (node.kind === 'note' && node.href) {
        openInObsidian(node.href)
      } else if (node.kind === 'run') {
        setOpenRunId(node.id.replace(/^run-/, ''))
      }
    },
    [navigate],
  )

  const runDocs: RunDoc[] = useMemo(
    () =>
      runs.slice(0, 6).map((r) => ({
        id: r.id,
        agent: r.agent,
        title: r.status === 'error' ? `⚠ ${r.agent}` : r.agent,
        date: r.status === 'running' ? 'läuft…' : runDate(r.finished || r.started),
        active: r.status === 'running',
      })),
    [runs],
  )

  const activeAgents = useMemo(
    () => runs.filter((r) => r.status === 'running').map((r) => r.agent),
    [runs],
  )

  /** Input-Baukasten je Agent — die App liefert ihre Daten selbst mit (§7). */
  const onRun = useCallback(
    async (agentId: string, extra?: Record<string, unknown>) => {
      let input: Record<string, unknown> = { ...extra }
      if (agentId === 'wochenrecap') {
        const monthKey = new Date().toISOString().slice(0, 7)
        const month = MONTH_TARGETS[monthKey]
        input = {
          weekRows: metrics.weekRows,
          targets: WEEK_TARGETS,
          monthRevenue,
          sollKumuliert: month ? currentSoll(month.curve) : 0,
          monatsziel: month?.total ?? null,
        }
      } else if (agentId === 'followup-entwuerfe') {
        const now = new Date().toISOString()
        input = {
          contacts: contacts.items
            .filter(
              (c) =>
                c.pipeline_stage === 'follow_up' ||
                (c.next_follow_up_at != null && c.next_follow_up_at <= now),
            )
            .slice(0, 10)
            .map((c) => ({
              name: c.name,
              company: c.company,
              stage: c.pipeline_stage,
              lastContact: c.stage_changed_at ?? null,
              nextFollowUp: c.next_follow_up_at,
              notes: c.entscheider_name ? `Entscheider: ${c.entscheider_name}` : null,
            })),
        }
      }
      await postRun(agentId, input)
      await refresh()
    },
    [metrics.weekRows, monthRevenue, contacts.items, refresh],
  )

  return (
    <div className="ck-home-grid">
      {/* Links: Geld-Ziel + Wochenziele + Quick-Track + Documents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PrimaryDirective monthRevenue={monthRevenue} />
        <VitalsPanel vitals={vitals} />
        <QuickTrack today={metrics.today} onBump={(f, d) => void metrics.bump(f, d)} />
        <DocumentsPanel runs={runDocs} onOpen={(r) => setOpenRunId(r.id)} />
      </div>

      {/* Mitte: Graph */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div className="ck-panel" style={{ padding: '8px 8px 0' }}>
          <ForceGraph data={graph} onNodeClick={onNodeClick} height={520} />
          <GraphLegend />
        </div>
      </div>

      {/* Rechts: Command Deck + Dream */}
      <div className="ck-home-deck" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CommandDeck runnerState={runner.state} activeAgents={activeAgents} onRun={onRun} />
        <DreamCard runs={runs} onOpen={setOpenRunId} />
      </div>

      {openRunId ? <RunDrawer runId={openRunId} onClose={() => setOpenRunId(null)} /> : null}
    </div>
  )
}
