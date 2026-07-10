import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { CommandDeck } from '../components/CommandDeck'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { ConversionPanel } from '../components/ConversionPanel'
import { DreamCard } from '../components/DreamCard'
import type { RunDoc } from '../components/DocumentsPanel'
import { NorthStarCard } from '../components/NorthStarCard'
import { OsDetailPanel } from '../components/OsDetailPanel'
import { PrimaryDirective } from '../components/PrimaryDirective'
import { QuickTrack } from '../components/QuickTrack'
import { RunDrawer } from '../components/RunDrawer'
import { VitalsPanel } from '../components/VitalsPanel'
import { OsNebula } from '../graph/OsNebula'
import type { LeadContact, NebulaNode } from '../graph/nebulaLayout'
import { useActiveBrand } from '../lib/activeBrand'
import {
  LAYOUT_LIMITS,
  LAYOUT_PRESETS,
  PRESET_LABEL,
  loadCockpitLayout,
  saveCockpitLayout,
} from '../lib/cockpitLayoutStorage'
import type { CockpitLayout, LayoutPreset } from '../lib/cockpitLayoutStorage'
import { MONTH_TARGETS, WEEK_TARGETS, currentSoll } from '../lib/goals'
import { funnelKpis, sumField, weekVitals } from '../lib/metricsAggregate'
import { postRun } from '../lib/runnerApi'
import { useDailyMetrics } from '../lib/useDailyMetrics'
import { useOsMap } from '../lib/useOsMap'
import { useRunnerData } from '../lib/useRunnerData'

function runDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

/** Graph-Höhe: nur auf schmalen (Mobile) Viewports deckeln — am Desktop frei ziehbar. */
function useGraphHeight(desired: number): number {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return narrow ? Math.min(desired, 440) : desired
}

/** Ziehbarer Trenner zwischen Tracking-Spalte und Graph. */
function GridDivider({
  gridRef,
  onLive,
  onCommit,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>
  onLive: (px: number) => void
  onCommit: () => void
}) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const px = Math.round(
        Math.min(LAYOUT_LIMITS.sidebar.max, Math.max(LAYOUT_LIMITS.sidebar.min, e.clientX - rect.left)),
      )
      onLive(px)
    }
    const up = () => {
      setDragging(false)
      onCommit()
    }
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [dragging, gridRef, onLive, onCommit])

  return (
    <div
      className="ck-col-divider"
      data-dragging={dragging}
      onMouseDown={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Spaltenbreite ziehen"
      title="Ziehen, um Tracking ⇄ Graph zu skalieren"
    >
      <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>
        ⋮
      </span>
    </div>
  )
}

/** Waagerechter Ziehbalken unter dem Graphen — Höhe live anpassen. */
function RowDivider({
  value,
  min,
  max,
  onLive,
  onCommit,
}: {
  value: number
  min: number
  max: number
  onLive: (px: number) => void
  onCommit: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const start = useRef({ y: 0, v: 0 })

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      const px = Math.round(Math.min(max, Math.max(min, start.current.v + (e.clientY - start.current.y))))
      onLive(px)
    }
    const up = () => {
      setDragging(false)
      onCommit()
    }
    document.body.style.cursor = 'row-resize'
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [dragging, min, max, onLive, onCommit])

  return (
    <div
      className="ck-row-divider"
      data-dragging={dragging}
      onMouseDown={(e) => {
        e.preventDefault()
        start.current = { y: e.clientY, v: value }
        setDragging(true)
      }}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Graph-Höhe ziehen"
      title="Ziehen, um den Graphen größer/kleiner zu machen"
    >
      <span aria-hidden style={{ fontSize: 12, lineHeight: 1, letterSpacing: 2 }}>
        ⋯
      </span>
    </div>
  )
}

/** Fokus-Presets + Größen-Regler (persistiert). */
function LayoutBar({
  layout,
  onChange,
}: {
  layout: CockpitLayout
  onChange: (next: CockpitLayout) => void
}) {
  const [open, setOpen] = useState(false)
  const setPreset = (p: LayoutPreset) => onChange(LAYOUT_PRESETS[p])
  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    apply: (v: number) => void,
  ) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className="ck-label" style={{ fontSize: 9.5 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={value}
        onChange={(e) => apply(Number(e.target.value))}
        style={{ width: 110, accentColor: 'var(--ck-accent)' }}
        aria-label={label}
      />
      <span className="ck-label" style={{ opacity: 0.7, minWidth: 34 }}>{value}px</span>
    </label>
  )
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: 10,
      }}
    >
      {open ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, marginRight: 8 }}>
          {slider('Sidebar', layout.sidebarPx, LAYOUT_LIMITS.sidebar.min, LAYOUT_LIMITS.sidebar.max, (v) =>
            onChange({ ...layout, sidebarPx: v }),
          )}
          {slider('Graph', layout.graphHeight, LAYOUT_LIMITS.graph.min, LAYOUT_LIMITS.graph.max, (v) =>
            onChange({ ...layout, graphHeight: v }),
          )}
        </div>
      ) : null}
      {(Object.keys(LAYOUT_PRESETS) as LayoutPreset[]).map((p) => (
        <button
          key={p}
          className="ck-btn"
          onClick={() => setPreset(p)}
          style={{
            fontSize: 10.5,
            padding: '4px 10px',
            borderColor: layout.preset === p ? 'var(--ck-accent)' : undefined,
            color: layout.preset === p ? 'var(--ck-accent)' : undefined,
          }}
        >
          {PRESET_LABEL[p]}
        </button>
      ))}
      <button
        className="ck-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Größen-Regler ein-/ausblenden"
        aria-expanded={open}
        style={{ fontSize: 11, padding: '4px 8px' }}
      >
        ⚙
      </button>
    </div>
  )
}

/**
 * Cockpit-Home — Hauptfläche ist der Agentic-OS-Graph (OsNebula): Kern +
 * Ebenen Skills/Memory/Routines/Apps aus /os/map, plus Leads-Pipelines.
 * Links schlanke Tracking-Spalte, unter dem Graph Command Deck + Dream.
 */
export function CockpitHome() {
  const navigate = useNavigate()
  const { activeBrand, error: brandError, loading: brandLoading } = useActiveBrand()
  const metrics = useDailyMetrics()
  const { runner, runs, refresh } = useRunnerData()
  const { osMap, refresh: refreshOsMap } = useOsMap(runner.state)
  const contacts = useContacts(activeBrand?.slug)
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [selNode, setSelNode] = useState<NebulaNode | null>(null)
  const [layout, setLayout] = useState<CockpitLayout>(loadCockpitLayout)
  const graphHeight = useGraphHeight(layout.graphHeight)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const changeLayout = useCallback((next: CockpitLayout) => {
    setLayout(next)
    saveCockpitLayout(next)
  }, [])

  // Divider zieht die Sidebar-Breite live; gespeichert wird erst beim Loslassen.
  const resizeSidebar = useCallback((px: number) => {
    setLayout((l) => ({ ...l, sidebarPx: px }))
  }, [])
  const commitLayout = useCallback(() => saveCockpitLayout(layoutRef.current), [])

  const vitals = useMemo(
    () => weekVitals(metrics.weekRows, metrics.monthRows),
    [metrics.weekRows, metrics.monthRows],
  )
  const monthRevenue = useMemo(() => sumField(metrics.monthRows, 'umsatz'), [metrics.monthRows])
  const funnel = useMemo(
    () => funnelKpis(metrics.monthRows, monthRevenue),
    [metrics.monthRows, monthRevenue],
  )

  /** Schlanker Kontakt-Auszug für die Leads-Ansicht des Graphen. */
  const leadContacts: LeadContact[] = useMemo(
    () =>
      contacts.items.map((c) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        pipeline_stage: c.pipeline_stage,
        lead_value: c.lead_value,
        lead_source: c.lead_source,
      })),
    [contacts.items],
  )

  const onNodeClick = useCallback(
    (node: NebulaNode) => {
      if (node.kind === 'core') return
      if (node.kind === 'contact' && node.href) {
        navigate(node.href)
        return
      }
      setSelNode(node)
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
    <>
    {/* Nur bei ECHTEM Problem warnen — nicht während des Ladens (sonst Flackern). */}
    {((!brandLoading && (!activeBrand || activeBrand.id.startsWith('local-fallback-'))) || metrics.error || metrics.tableMissing) ? (
      <div
        className="ck-panel"
        style={{
          padding: '10px 14px',
          marginBottom: 12,
          border: '1px solid var(--ck-warn)',
          color: 'var(--ck-warn)',
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        {!brandLoading && (!activeBrand || activeBrand.id.startsWith('local-fallback-'))
          ? `⚠ Keine echte Brand verbunden — die brands-Tabelle lädt nicht aus Supabase. Solange das so ist, wird getracktes NICHT gespeichert und Projekte/E-Mail funktionieren nicht.${brandError ? ` Fehler: ${brandError}` : ' (Kein Fehler gemeldet → Brand-Liste ist leer; ggf. eingeloggter User hat keine brands-Zeilen.)'}`
          : metrics.tableMissing
            ? '⚠ Tabelle daily_metrics fehlt — Migration 0049 ist auf dieser DB nicht ausgeführt.'
            : `⚠ Tracking-Schreibfehler: ${metrics.error}`}
      </div>
    ) : null}
    <LayoutBar layout={layout} onChange={changeLayout} />
    <div
      ref={gridRef}
      className="ck-home-grid"
      style={{ ['--ck-sidebar-w' as string]: `${layout.sidebarPx}px` } as React.CSSProperties}
    >
      {/* Links (schmal): Geld-Ziel → Quick-Track (schneller Zugriff) → Vitals → Conversion → Docs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <NorthStarCard />
        <PrimaryDirective monthRevenue={monthRevenue} />
        <QuickTrack
          today={metrics.today}
          onBump={(f, d) => void metrics.bump(f, d)}
          onAddUmsatz={(amount) => void metrics.setUmsatz(metrics.today.umsatz + amount)}
        />
        <VitalsPanel vitals={vitals} />
        <ConversionPanel kpis={funnel} />
        <DocumentsPanel runs={runDocs} onOpen={(r) => setOpenRunId(r.id)} />
      </div>

      <GridDivider gridRef={gridRef} onLive={resizeSidebar} onCommit={commitLayout} />

      {/* Haupt (breit): großer OS-Graph, darunter Command Deck + Dream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div className="ck-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <OsNebula
            map={osMap}
            contacts={leadContacts}
            onNodeClick={onNodeClick}
            onRefresh={() => refreshOsMap(true)}
            height={graphHeight}
          />
        </div>
        <RowDivider
          value={layout.graphHeight}
          min={LAYOUT_LIMITS.graph.min}
          max={LAYOUT_LIMITS.graph.max}
          onLive={(px) => setLayout((l) => ({ ...l, graphHeight: px }))}
          onCommit={commitLayout}
        />
        <div className="ck-home-deck">
          <CommandDeck runnerState={runner.state} activeAgents={activeAgents} onRun={onRun} />
          <DreamCard runs={runs} onOpen={setOpenRunId} />
        </div>
      </div>

      {selNode ? <OsDetailPanel node={selNode} onClose={() => setSelNode(null)} /> : null}
      {openRunId ? <RunDrawer runId={openRunId} onClose={() => setOpenRunId(null)} /> : null}
    </div>
    </>
  )
}
