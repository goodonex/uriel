import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { useEffect, useRef } from 'react'
import type { GraphData, GraphNode } from '../lib/graphData'
import { NODE_COLORS } from '../lib/graphData'

interface SimNode extends SimulationNodeDatum, GraphNode {}
type SimLink = SimulationLinkDatum<SimNode>

interface ForceGraphProps {
  data: GraphData
  onNodeClick?: (node: GraphNode) => void
  height?: number
}

const BASE_RADIUS = 4

function radiusOf(node: GraphNode): number {
  return BASE_RADIUS + (node.weight ?? 1) * 2
}

/**
 * Force-Graph v2 (Obsidian-Gefühl): Zoom (Wheel), Pan (Hintergrund ziehen),
 * Node-Drag, echte Wikilink-Kanten. Canvas 2D + d3-force, kein WebGL.
 */
export function ForceGraph({ data, onNodeClick, height = 520 }: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = wrap.clientWidth
    const dpr = window.devicePixelRatio || 1

    // Ansicht: Zoom/Pan-Transform
    const view = { x: 0, y: 0, k: 1 }
    let hoverId: string | null = null

    const resize = () => {
      width = wrap.clientWidth
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resize()

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }))
    const links: SimLink[] = data.links.map((l) => ({ ...l }))

    const sim = forceSimulation(nodes)
      .force('charge', forceManyBody().strength(-90))
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const s = l.source as SimNode
            const t = l.target as SimNode
            // Hub-Kanten länger, Notiz-Notiz kürzer (Cluster-Gefühl)
            return s.kind === 'hub' || t.kind === 'hub' ? 90 : 46
          })
          .strength(0.45),
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => radiusOf(d) + 6))
      .alphaDecay(0.018)

    const hub = nodes.find((n) => n.kind === 'hub')
    if (hub) {
      hub.fx = width / 2
      hub.fy = height / 2
    }

    // Bildschirm → Welt-Koordinaten
    const toWorld = (sx: number, sy: number) => ({
      x: (sx - view.x) / view.k,
      y: (sy - view.y) / view.k,
    })

    const nodeAt = (sx: number, sy: number): SimNode | null => {
      const { x: wx, y: wy } = toWorld(sx, sy)
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (n.x == null || n.y == null) continue
        const dx = wx - n.x
        const dy = wy - n.y
        const r = radiusOf(n) + 4 / view.k
        if (dx * dx + dy * dy <= r * r) return n
      }
      return null
    }

    let raf = 0
    const draw = () => {
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)
      ctx.translate(view.x, view.y)
      ctx.scale(view.k, view.k)

      const t = performance.now() / 1000

      // Kanten
      ctx.strokeStyle = 'rgba(38, 49, 58, 0.9)'
      ctx.lineWidth = 1 / view.k
      for (const l of links) {
        const s = l.source as SimNode
        const g = l.target as SimNode
        if (s.x == null || g.x == null) continue
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.lineTo(g.x, g.y!)
        ctx.stroke()
      }

      // Knoten
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue
        const r = radiusOf(n)
        const isHover = n.id === hoverId
        const color = NODE_COLORS[n.kind]

        if (n.active) {
          const pulse = (Math.sin(t * 3.5) + 1) / 2
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 4 + pulse * 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.5 - pulse * 0.35})`
          ctx.lineWidth = 1.5 / view.k
          ctx.stroke()
        }

        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = n.kind === 'note' ? 0.85 : 1
        ctx.fill()
        ctx.globalAlpha = 1

        if (isHover && n.kind !== 'hub') {
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 3 / view.k, 0, Math.PI * 2)
          ctx.strokeStyle = '#f2f4f5'
          ctx.lineWidth = 1 / view.k
          ctx.stroke()
        }

        // Labels: Hub immer · Hover immer · gut vernetzte Knoten ab Zoom 1.15
        const showLabel =
          n.kind === 'hub' || isHover || ((n.weight ?? 1) >= 3 && view.k >= 1.15)
        if (showLabel) {
          const fs = Math.max(9, 10 / view.k)
          ctx.font = `500 ${fs}px 'JetBrains Mono', monospace`
          ctx.fillStyle = n.kind === 'hub' ? '#9aa4a8' : isHover ? '#f2f4f5' : '#5c676c'
          ctx.textAlign = 'center'
          const label = n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label
          ctx.fillText(label.toUpperCase(), n.x, n.y + r + fs + 3)
        }
      }
      ctx.restore()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    // --- Interaktion: Zoom / Pan / Drag ---
    let dragNode: SimNode | null = null
    let panning = false
    let last = { x: 0, y: 0 }
    let moved = false

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0015)
      const k = Math.min(3.5, Math.max(0.3, view.k * factor))
      // zum Cursor zoomen
      view.x = sx - ((sx - view.x) / view.k) * k
      view.y = sy - ((sy - view.y) / view.k) * k
      view.k = k
    }

    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      moved = false
      const n = nodeAt(sx, sy)
      if (n && n.kind !== 'hub') {
        dragNode = n
        n.fx = n.x
        n.fy = n.y
        sim.alphaTarget(0.25).restart()
      } else {
        panning = true
      }
      last = { x: sx, y: sy }
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      if (dragNode) {
        const w = toWorld(sx, sy)
        dragNode.fx = w.x
        dragNode.fy = w.y
        moved = true
      } else if (panning) {
        view.x += sx - last.x
        view.y += sy - last.y
        moved = true
      } else {
        const n = nodeAt(sx, sy)
        hoverId = n && n.kind !== 'hub' ? n.id : null
        canvas.style.cursor = n && n.kind !== 'hub' ? 'pointer' : 'grab'
      }
      last = { x: sx, y: sy }
    }

    const onUp = (e: MouseEvent) => {
      if (dragNode) {
        // loslassen: Physik übernimmt wieder
        dragNode.fx = null
        dragNode.fy = null
        sim.alphaTarget(0)
        if (!moved) {
          // war ein Klick, kein Drag
          onNodeClick?.(dragNode)
        }
        dragNode = null
        return
      }
      if (panning) {
        panning = false
        if (!moved) {
          // Klick auf Hintergrund — nichts tun
          const rect = canvas.getBoundingClientRect()
          const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
          if (n && n.kind !== 'hub') onNodeClick?.(n)
        }
      }
    }

    const ro = new ResizeObserver(() => {
      resize()
      sim.force('center', forceCenter(width / 2, height / 2))
      if (hub) {
        hub.fx = width / 2
        hub.fy = height / 2
      }
      sim.alpha(0.25).restart()
    })
    ro.observe(wrap)

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      cancelAnimationFrame(raf)
      sim.stop()
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [data, height, onNodeClick])

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} aria-label="Daten-Graph: Deals, Agent-Runs und Vault-Notizen mit Wikilink-Verbindungen" />
      <span
        className="ck-label"
        style={{ position: 'absolute', top: 8, right: 10, pointerEvents: 'none', opacity: 0.7 }}
      >
        Scroll = Zoom · Ziehen = Pan/Node
      </span>
    </div>
  )
}
