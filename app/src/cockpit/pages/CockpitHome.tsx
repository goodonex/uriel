import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandDeck } from '../components/CommandDeck'
import { DocumentsPanel, MOCK_RUNS } from '../components/DocumentsPanel'
import { PrimaryDirective } from '../components/PrimaryDirective'
import { VitalsPanel } from '../components/VitalsPanel'
import { ForceGraph } from '../graph/ForceGraph'
import { useActiveBrand } from '../lib/activeBrand'
import { buildMockGraph, NODE_COLORS, NODE_LEGEND } from '../lib/graphData'
import type { GraphNode } from '../lib/graphData'
import { sumField, weekVitals } from '../lib/metricsAggregate'
import { useDailyMetrics } from '../lib/useDailyMetrics'

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

/**
 * Cockpit-Home (REBUILD-PLAN §5.1):
 * Mitte Graph + Primary Directive, links Vitals + Documents, rechts Command Deck.
 * Phase 2: Mock-Daten. Phase 3 (Vitals/Umsatz) und Phase 5 (Runs) verdrahten echt.
 */
export function CockpitHome() {
  const navigate = useNavigate()
  const { activeBrand } = useActiveBrand()
  const metrics = useDailyMetrics()

  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.monthRows),
    [metrics.weekRows, metrics.monthRows],
  )
  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])

  const graph = useMemo(
    () => buildMockGraph(activeBrand?.name ?? 'Kevin OS'),
    [activeBrand?.name],
  )

  const onNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.kind === 'deal' && node.href) {
        navigate(node.href)
      } else if (node.kind === 'note' && node.href) {
        window.open(node.href, '_self')
      }
      // run-Knoten: Ergebnis-Panel kommt in Phase 5
    },
    [navigate],
  )

  return (
    <div className="ck-home-grid">
      {/* Links: Vitals + Documents */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <VitalsPanel vitals={vitals} />
        <DocumentsPanel runs={MOCK_RUNS} />
      </div>

      {/* Mitte: Graph + Primary Directive */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div className="ck-panel" style={{ padding: '8px 8px 0' }}>
          <ForceGraph data={graph} onNodeClick={onNodeClick} height={430} />
          <GraphLegend />
        </div>
        <PrimaryDirective monthRevenue={monthRevenue} />
      </div>

      {/* Rechts: Command Deck */}
      <div className="ck-home-deck" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <CommandDeck />
      </div>
    </div>
  )
}
