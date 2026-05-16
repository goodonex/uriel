import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdCampaigns } from '../../hooks/useAdCampaigns'
import { useBrands } from '../../hooks/useBrands'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useContentSequences } from '../../hooks/useContentSequences'
import { useEnrollments, useEmailSequences } from '../../hooks/useEmailSequences'
import { useFunnelCanvas } from '../../hooks/useFunnelCanvas'
import { useMeetingLinks } from '../../hooks/useSalesPro'
import type { FunnelEdgeRow, FunnelNodeRow, FunnelNodeType } from '../../types/funnel'
import { FunnelEdges } from './FunnelEdges'
import { FunnelNode } from './FunnelNode'
import { isFunnelNodeConfigured } from './funnelNodeConfig'
import { NodeEditPanel } from './NodeEditPanel'
import { NodePalette, paletteDefaultLabel } from './NodePalette'
import { buildTemplateFunnel } from './templateFunnels'

const BOARD_W = 3200
const BOARD_H = 2200
const NODE_W = 220

function clientToWorld(
  clientX: number,
  clientY: number,
  boardEl: HTMLElement | null,
  ox: number,
  oy: number,
  sc: number,
): { x: number; y: number } {
  if (!boardEl) return { x: 0, y: 0 }
  const r = boardEl.getBoundingClientRect()
  const lx = clientX - r.left
  const ly = clientY - r.top
  return { x: (lx - ox) / sc, y: (ly - oy) / sc }
}

function funnelHealth(nodes: FunnelNodeRow[], edges: FunnelEdgeRow[]): 'ok' | 'warn' | 'bad' {
  if (nodes.length === 0) return 'bad'
  const conf = nodes.filter(isFunnelNodeConfigured).length
  const ratio = conf / nodes.length
  const hasGoal = nodes.some((n) => n.type === 'goal')
  const hasTop = nodes.some((n) => n.type === 'ad' || n.type === 'content')
  const minEdges = Math.max(0, nodes.length - 1)
  const edgeOk = edges.length >= minEdges
  if (ratio >= 0.85 && hasGoal && hasTop && edgeOk) return 'ok'
  if (ratio >= 0.4 || (hasGoal && edges.length > 0)) return 'warn'
  return 'bad'
}

export function FunnelCanvas({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug)
  const brandSlugField = brand?.slug ?? slug

  const fc = useFunnelCanvas(slug)
  const campaigns = useAdCampaigns(slug)
  const pieces = useContentPieces(slug)
  const emailPlans = useContentSequences(slug, { kind: 'email' })
  const mailFlows = useEmailSequences(slug)
  const meetingLinks = useMeetingLinks(slug)
  const contacts = useContacts(slug)
  const enrollments = useEnrollments(slug)

  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [ox, setOx] = useState(0)
  const [oy, setOy] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [editNodeId, setEditNodeId] = useState<string | null>(null)
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({})
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ wx: number; wy: number } | null>(null)
  const [variantDlg, setVariantDlg] = useState<{ sourceId: string; targetId: string } | null>(null)

  const boardRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const edgeRef = useRef<{
    sourceId: string
    startWx: number
    startWy: number
    curWx: number
    curWy: number
  } | null>(null)
  const [, edgeTick] = useState(0)
  const posDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    if (!fc.funnels.length) {
      setActiveFunnelId(null)
      return
    }
    setActiveFunnelId((cur) => {
      if (cur && fc.funnels.some((f) => f.id === cur)) return cur
      return fc.funnels[0]?.id ?? null
    })
  }, [fc.funnels])

  useEffect(() => {
    if (!isFullscreen) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [isFullscreen])

  const nodes = useMemo(
    () => fc.nodes.filter((n) => n.funnel_id === activeFunnelId),
    [fc.nodes, activeFunnelId],
  )
  const edges = useMemo(
    () => fc.edges.filter((e) => e.funnel_id === activeFunnelId),
    [fc.edges, activeFunnelId],
  )

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const enrollByFlow = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of enrollments.items) {
      if (e.status !== 'active') continue
      m.set(e.sequence_id, (m.get(e.sequence_id) ?? 0) + 1)
    }
    return m
  }, [enrollments.items])

  const dealCount = useMemo(
    () => contacts.items.filter((c) => c.pipeline_stage === 'deal').length,
    [contacts.items],
  )

  const health = funnelHealth(nodes, edges)
  const healthColor =
    health === 'ok' ? 'var(--accent-teal)' : health === 'warn' ? 'var(--accent-amber)' : '#f55'

  const scheduleNodePos = useCallback(
    (id: string, x: number, y: number) => {
      const prev = posDebounce.current[id]
      if (prev) clearTimeout(prev)
      posDebounce.current[id] = setTimeout(() => {
        void fc.updateNode(id, { position_x: Math.round(x), position_y: Math.round(y) })
      }, 500)
    },
    [fc],
  )

  const portOutWorld = useCallback(
    (n: FunnelNodeRow) => {
      const h = nodeHeights[n.id] ?? 110
      return { x: n.position_x + NODE_W / 2, y: n.position_y + h }
    },
    [nodeHeights],
  )

  const portInWorld = useCallback((n: FunnelNodeRow) => {
    return { x: n.position_x + NODE_W / 2, y: n.position_y }
  }, [])

  const previewEdge = useMemo(() => {
    if (!edgeRef.current) return { from: null as { x: number; y: number } | null, to: null as { x: number; y: number } | null }
    const src = nodesById.get(edgeRef.current.sourceId)
    if (!src) return { from: null, to: null }
    const from = portOutWorld(src)
    const to = { x: edgeRef.current.curWx, y: edgeRef.current.curWy }
    return { from, to }
  }, [edgeTick, nodesById, portOutWorld])

  const onBoardWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setScale((s) => Math.min(2, Math.max(0.4, s + delta)))
  }

  const resetZoom = () => {
    setScale(1)
    setOx(0)
    setOy(0)
  }

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    panRef.current = { sx: e.clientX, sy: e.clientY, ox, oy }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const movePan = (e: React.PointerEvent) => {
    if (!panRef.current) return
    const dx = e.clientX - panRef.current.sx
    const dy = e.clientY - panRef.current.sy
    setOx(panRef.current.ox + dx)
    setOy(panRef.current.oy + dy)
  }

  const endPan = () => {
    panRef.current = null
  }

  const completeEdge = async (sourceId: string, targetId: string, chosenVariant?: 'B' | 'C') => {
    if (!activeFunnelId || sourceId === targetId) return
    const dup = edges.some((e) => e.source_node_id === sourceId && e.target_node_id === targetId)
    if (dup) return

    const outgoing = edges.filter((e) => e.source_node_id === sourceId)
    if (outgoing.length === 0) {
      await fc.addEdge(activeFunnelId, sourceId, targetId, { variant: null })
      return
    }
    if (!chosenVariant) return
    const v = chosenVariant
    const needA = outgoing.every((e) => !e.variant)
    if (needA) {
      for (const e of outgoing) {
        await fc.updateEdge(e.id, { variant: 'A' })
      }
    }
    await fc.addEdge(activeFunnelId, sourceId, targetId, { variant: v })
  }

  const onOutputPointerDown = (sourceId: string, e: React.PointerEvent) => {
    e.preventDefault()
    const src = nodesById.get(sourceId)
    if (!src) return
    const p = portOutWorld(src)
    edgeRef.current = { sourceId, startWx: p.x, startWy: p.y, curWx: p.x, curWy: p.y }
    const move = (ev: PointerEvent) => {
      if (!edgeRef.current) return
      const w = clientToWorld(ev.clientX, ev.clientY, boardRef.current, ox, oy, scale)
      edgeRef.current.curWx = w.x
      edgeRef.current.curWy = w.y
      edgeTick((x) => x + 1)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!edgeRef.current) return
      const w = clientToWorld(ev.clientX, ev.clientY, boardRef.current, ox, oy, scale)
      let hit: string | null = null
      for (const n of nodes) {
        if (n.id === sourceId) continue
        const pin = portInWorld(n)
        const dx = w.x - pin.x
        const dy = w.y - pin.y
        if (dx * dx + dy * dy < 28 ** 2) {
          hit = n.id
          break
        }
      }
      const srcId = edgeRef.current.sourceId
      edgeRef.current = null
      edgeTick((x) => x + 1)
      if (!hit || !activeFunnelId) return
      const outgoing = edges.filter((e) => e.source_node_id === srcId)
      if (outgoing.length >= 1) {
        setVariantDlg({ sourceId: srcId, targetId: hit })
        return
      }
      void completeEdge(srcId, hit)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onInputPointerUp = (targetId: string, _e: React.PointerEvent) => {
    if (!edgeRef.current) return
    const srcId = edgeRef.current.sourceId
    if (srcId === targetId) return
    edgeRef.current = null
    edgeTick((x) => x + 1)
    const outgoing = edges.filter((e) => e.source_node_id === srcId)
    if (outgoing.length >= 1) {
      setVariantDlg({ sourceId: srcId, targetId })
      return
    }
    void completeEdge(srcId, targetId)
  }

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const t = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', close)
    }
  }, [ctxMenu])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        edgeRef.current = null
        setCtxMenu(null)
        setVariantDlg(null)
        edgeTick((x) => x + 1)
      }
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const addTypedNode = async (type: FunnelNodeType, wx: number, wy: number) => {
    if (!activeFunnelId) return
    const row = await fc.addNode(activeFunnelId, {
      type,
      label: paletteDefaultLabel(type),
      position_x: Math.round(wx - NODE_W / 2),
      position_y: Math.round(wy - 40),
    })
    setEditNodeId(row.id)
    setCtxMenu(null)
  }

  const activeFunnel = fc.funnels.find((f) => f.id === activeFunnelId)

  const shell = (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: isFullscreen ? 'fixed' : 'relative',
        ...(isFullscreen
          ? { inset: 0, zIndex: 200, background: '#050508' }
          : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '4px 8px 8px',
          flexShrink: 0,
        }}
      >
        <div
          key={activeFunnelId ?? 'none'}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const t = e.currentTarget.textContent?.trim()
            if (activeFunnelId && t) void fc.updateFunnel(activeFunnelId, { name: t })
          }}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            outline: 'none',
            minWidth: 120,
            cursor: 'text',
          }}
        >
          {activeFunnel?.name ?? 'Funnel'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            className="font-mono"
            title="Funnel Health"
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: healthColor,
            }}
          >
            {nodes.filter(isFunnelNodeConfigured).length}/{nodes.length} ·{' '}
            {health === 'ok' ? 'Komplett' : health === 'warn' ? 'Teilweise' : 'Lücken'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <ToolbarBtn onClick={() => void fc.createFunnel()}>+ Funnel</ToolbarBtn>
            <select
              className="font-mono"
              value={activeFunnelId ?? ''}
              onChange={(e) => setActiveFunnelId(e.target.value || null)}
              style={{
                fontSize: 10,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(10,10,20,0.8)',
                color: 'var(--text-secondary)',
              }}
            >
              {fc.funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <ToolbarBtn onClick={resetZoom}>Zoom Reset</ToolbarBtn>
            <ToolbarBtn onClick={() => setIsFullscreen((v) => !v)}>Vollbild</ToolbarBtn>
          </div>
        </div>
      </div>

      <div
        ref={viewportRef}
        onWheel={onBoardWheel}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          position: 'relative',
          background: '#0a0a12',
          borderRadius: isFullscreen ? 0 : 12,
        }}
      >
        <div
          data-funnel-board
          ref={boardRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) startPan(e)
          }}
          onPointerMove={(e) => {
            movePan(e)
          }}
          onPointerUp={endPan}
          onPointerLeave={endPan}
          onDoubleClick={(e) => {
            if (e.target !== e.currentTarget) return
            const w = clientToWorld(e.clientX, e.clientY, boardRef.current, ox, oy, scale)
            setCtxMenu({ wx: w.x, wy: w.y })
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            e.preventDefault()
            const t = e.dataTransfer.getData('application/x-funnel-node') as FunnelNodeType
            if (!t) return
            const w = clientToWorld(e.clientX, e.clientY, boardRef.current, ox, oy, scale)
            void addTypedNode(t, w.x, w.y)
          }}
          style={{
            width: BOARD_W,
            height: BOARD_H,
            position: 'relative',
            transform: `translate(${ox}px, ${oy}px) scale(${scale})`,
            transformOrigin: '0 0',
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          <FunnelEdges
            edges={edges}
            nodesById={nodesById}
            nodeHeights={nodeHeights}
            previewFrom={previewEdge.from}
            previewTo={previewEdge.to}
            hoveredEdgeId={hoveredEdgeId}
            onEdgePointerEnter={setHoveredEdgeId}
            onEdgePointerLeave={() => setHoveredEdgeId(null)}
            onEdgeDeleteClick={(id) => {
              if (window.confirm('Verbindung löschen?')) void fc.deleteEdge(id)
            }}
          />

          {nodes.map((n) => {
            const cfg = n.config as Record<string, unknown>
            const camp =
              n.type === 'ad' && typeof cfg.campaign_id === 'string'
                ? campaigns.items.find((c) => c.id === cfg.campaign_id) ?? null
                : null
            const piece =
              n.type === 'content' && typeof cfg.piece_id === 'string'
                ? pieces.items.find((p) => p.id === cfg.piece_id) ?? null
                : null
            const retId = typeof cfg.target_node_id === 'string' ? cfg.target_node_id : ''
            const retargetName = retId ? nodesById.get(retId)?.label ?? null : null
            let liveLine: string | null = null
            if (camp) {
              const spend = camp.budget_spent ?? 0
              const leads = camp.leads_count ?? 0
              const clicks = camp.clicks_count ?? 0
              const cpl = camp.cost_per_lead ?? (leads ? spend / leads : 0)
              liveLine = `${clicks} Klicks · ${leads} Leads · ${cpl.toFixed(1)} €/Lead`
            }
            if (n.type === 'email_sequence' && typeof cfg.sequence_id === 'string') {
              const seq = emailPlans.items.find((x) => x.id === cfg.sequence_id)
              const weeks = seq?.plan?.length ?? 0
              liveLine = seq ? `${weeks} Wochen geplant` : null
            }
            const flowId = typeof cfg.flow_id === 'string' ? cfg.flow_id : ''
            const enrollN = flowId ? enrollByFlow.get(flowId) ?? 0 : undefined
            const bookingSlug =
              n.type === 'booking_link' && typeof cfg.link_id === 'string'
                ? meetingLinks.items.find((l) => l.id === cfg.link_id)?.slug
                : undefined

            return (
              <FunnelNode
                key={n.id}
                slug={slug}
                node={n}
                configured={isFunnelNodeConfigured(n)}
                adCampaign={camp}
                contentPiece={piece}
                retargetName={retargetName}
                liveLine={liveLine}
                dealCount={n.type === 'goal' ? dealCount : undefined}
                enrollmentActiveCount={n.type === 'mail_flow' ? enrollN : undefined}
                bookingLinkSlug={bookingSlug}
                onMoveEnd={(id, x, y) => scheduleNodePos(id, x, y)}
                onEdit={() => setEditNodeId(n.id)}
                onDuplicate={async () => {
                  if (!activeFunnelId) return
                  const copy = await fc.addNode(activeFunnelId, {
                    type: n.type,
                    label: `${n.label} Kopie`,
                    position_x: n.position_x + 40,
                    position_y: n.position_y + 40,
                    config: { ...(n.config as object) },
                  })
                  setEditNodeId(copy.id)
                }}
                onDelete={() => {
                  if (window.confirm('Node löschen?')) void fc.deleteNode(n.id)
                }}
                onOpenAds={() => navigate(`/brand/${slug}/promo/ads`)}
                onOpenCalendar={() => navigate(`/brand/${slug}/promo/kalender`)}
                onOpenEmailTab={() => navigate(`/brand/${slug}/promo/email`)}
                onOpenFlowsTab={() => navigate(`/brand/${slug}/promo/flows`)}
                onScrollToNode={(tid) => {
                  const el = document.querySelector(`[data-funnel-node-id="${tid}"]`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                onReportHeight={(id, h) => setNodeHeights((m) => (m[id] === h ? m : { ...m, [id]: h }))}
                onOutputPointerDown={(e) => onOutputPointerDown(n.id, e)}
                onInputPointerUp={(e) => onInputPointerUp(n.id, e)}
                outputHot={!!edgeRef.current && edgeRef.current.sourceId === n.id}
                inputHot={!!edgeRef.current && edgeRef.current.sourceId !== n.id}
              />
            )
          })}

          {!fc.loading && fc.funnels.length === 0 ? (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '45%',
                transform: 'translate(-50%, -50%)',
                width: 420,
                textAlign: 'center',
                padding: 28,
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(12,12,24,0.85)',
              }}
            >
              <div className="font-display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
                Dein erster Funnel
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                Wähle ein Template — Verknüpfungen füllst du danach im Node-Panel.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TemplateButton
                  label="Lead-Gen Funnel"
                  onClick={async () => {
                    const f = await fc.createFunnel({ name: 'Lead-Gen' })
                    const { nodes: tn, edges: te } = buildTemplateFunnel('lead_gen', f.id)
                    await fc.replaceFunnelGraph(f.id, tn, te)
                    setActiveFunnelId(f.id)
                  }}
                />
                <TemplateButton
                  label="Content Funnel"
                  onClick={async () => {
                    const f = await fc.createFunnel({ name: 'Content' })
                    const { nodes: tn, edges: te } = buildTemplateFunnel('content', f.id)
                    await fc.replaceFunnelGraph(f.id, tn, te)
                    setActiveFunnelId(f.id)
                  }}
                />
                <TemplateButton
                  label="Webinar Funnel"
                  onClick={async () => {
                    const f = await fc.createFunnel({ name: 'Webinar' })
                    const { nodes: tn, edges: te } = buildTemplateFunnel('webinar', f.id)
                    await fc.replaceFunnelGraph(f.id, tn, te)
                    setActiveFunnelId(f.id)
                  }}
                />
                <TemplateButton
                  label="Leerer Funnel"
                  onClick={async () => {
                    const f = await fc.createFunnel({ name: 'Neuer Funnel' })
                    setActiveFunnelId(f.id)
                  }}
                />
              </div>
            </div>
          ) : null}

          {ctxMenu && activeFunnelId ? (
            <div
              style={{
                position: 'absolute',
                left: ctxMenu.wx,
                top: ctxMenu.wy,
                zIndex: 50,
                padding: 8,
                borderRadius: 12,
                background: 'rgba(12,12,22,0.95)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {(
                [
                  'ad',
                  'content',
                  'landing_page',
                  'lead_form',
                  'email_sequence',
                  'mail_flow',
                  'booking_link',
                  'retargeting',
                  'goal',
                ] as FunnelNodeType[]
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="font-mono"
                  onClick={() => void addTypedNode(t, ctxMenu.wx, ctxMenu.wy)}
                  style={{
                    fontSize: 10,
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {paletteDefaultLabel(t)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {activeFunnelId && fc.funnels.length > 0 ? (
          <NodePalette onPickType={(t) => void addTypedNode(t, BOARD_W / 2, BOARD_H / 2)} />
        ) : null}

        {editNodeId ? (
          (() => {
            const node = nodes.find((x) => x.id === editNodeId)
            if (!node) return null
            return (
              <NodeEditPanel
                slug={slug}
                brandSlugField={brandSlugField}
                node={node}
                campaigns={campaigns.items}
                pieces={pieces.items}
                emailSequences={emailPlans.items}
                mailFlows={mailFlows.items}
                meetingLinks={meetingLinks.items}
                funnelNodes={nodes}
                onClose={() => setEditNodeId(null)}
                onUpdate={(patch) => void fc.updateNode(node.id, patch)}
              />
            )
          })()
        ) : null}

        {variantDlg ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
            }}
            onClick={() => setVariantDlg(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: 20,
                borderRadius: 14,
                background: 'rgba(14,14,26,0.95)',
                border: '1px solid rgba(255,255,255,0.12)',
                minWidth: 260,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Variante hinzufügen?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['B', 'C'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="font-mono"
                    onClick={() => {
                      const { sourceId, targetId } = variantDlg
                      setVariantDlg(null)
                      void completeEdge(sourceId, targetId, v)
                    }}
                    style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer' }}
                  >
                    Variante {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  return shell
}

function ToolbarBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="font-mono"
      onClick={onClick}
      style={{
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(10,10,20,0.85)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function TemplateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  )
}
