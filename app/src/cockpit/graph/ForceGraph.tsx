import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force'
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'
import { useEffect, useRef, useState } from 'react'
import type { GraphData, GraphNode } from '../lib/graphData'
import { NODE_COLORS } from '../lib/graphData'

interface SimNode extends SimulationNodeDatum, GraphNode {}
type SimLink = SimulationLinkDatum<SimNode>

interface ForceGraphProps {
  data: GraphData
  onNodeClick?: (node: GraphNode) => void
  height?: number
}

const BASE_RADIUS = 5

function radiusOf(node: GraphNode): number {
  return BASE_RADIUS + (node.weight ?? 1) * 2.5
}

/**
 * Force-Directed-Graph auf Canvas 2D (REBUILD-PLAN §5.1).
 * Bewusst KEIN WebGL/Three.js — d3-force-Physik + eigenes Rendering.
 * Bewegung = Physik + Puls laufender Runs (erlaubte Animationen, §4).
 */
export function ForceGraph({ data, onNodeClick, height = 420 }: ForceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hoverIdRef = useRef<string | null>(null)
  hoverIdRef.current = hoverId

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = wrap.clientWidth
    const dpr = window.devicePixelRatio || 1

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
      .force('charge', forceManyBody().strength(-160))
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(70)
          .strength(0.5),
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => radiusOf(d) + 14))
      .alphaDecay(0.02)

    // Hub in der Mitte fixieren
    const hub = nodes.find((n) => n.kind === 'hub')
    if (hub) {
      hub.fx = width / 2
      hub.fy = height / 2
    }

    let raf = 0
    const draw = () => {
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      const t = performance.now() / 1000

      // Links
      ctx.strokeStyle = 'rgba(38, 49, 58, 0.9)'
      ctx.lineWidth = 1
      for (const l of links) {
        const s = l.source as SimNode
        const g = l.target as SimNode
        if (s.x == null || g.x == null) continue
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.lineTo(g.x, g.y!)
        ctx.stroke()
      }

      // Nodes
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue
        const r = radiusOf(n)
        const isHover = n.id === hoverIdRef.current
        const color = NODE_COLORS[n.kind]

        // Puls-Ring für laufende Runs
        if (n.active) {
          const pulse = (Math.sin(t * 3.5) + 1) / 2
          ctx.beginPath()
          ctx.arc(n.x, n.y, r + 4 + pulse * 5, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.5 - pulse * 0.35})`
          ctx.lineWidth = 1.5
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
          ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2)
          ctx.strokeStyle = '#f2f4f5'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        // Label: Hub immer, andere bei Hover
        if (n.kind === 'hub' || isHover) {
          ctx.font = `500 10px 'JetBrains Mono', monospace`
          ctx.fillStyle = n.kind === 'hub' ? '#9aa4a8' : '#f2f4f5'
          ctx.textAlign = 'center'
          ctx.fillText(n.label.toUpperCase(), n.x, n.y + r + 14)
        }
      }
      ctx.restore()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const nodeAt = (mx: number, my: number): SimNode | null => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        if (n.x == null || n.y == null) continue
        const dx = mx - n.x
        const dy = my - n.y
        const r = radiusOf(n) + 4
        if (dx * dx + dy * dy <= r * r) return n
      }
      return null
    }

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
      setHoverId(n && n.kind !== 'hub' ? n.id : null)
      canvas.style.cursor = n && n.kind !== 'hub' ? 'pointer' : 'default'
    }

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top)
      if (n && n.kind !== 'hub') onNodeClick?.(n)
    }

    const ro = new ResizeObserver(() => {
      resize()
      sim.force('center', forceCenter(width / 2, height / 2))
      if (hub) {
        hub.fx = width / 2
        hub.fy = height / 2
      }
      sim.alpha(0.3).restart()
    })
    ro.observe(wrap)

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(raf)
      sim.stop()
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [data, height, onNodeClick])

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} aria-label="Daten-Graph: Deals, Agent-Runs und Notizen" />
    </div>
  )
}
