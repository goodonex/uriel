import type { FunnelEdgeRow, FunnelNodeRow } from '../../types/funnel'

const NODE_W = 220

function portOut(n: FunnelNodeRow, h: number): { x: number; y: number } {
  return { x: n.position_x + NODE_W / 2, y: n.position_y + h }
}

function portIn(n: FunnelNodeRow): { x: number; y: number } {
  return { x: n.position_x + NODE_W / 2, y: n.position_y }
}

function cubicPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { d: string; mid: { x: number; y: number } } {
  const c1y = y0 + 80
  const c2y = y1 - 80
  const d = `M ${x0} ${y0} C ${x0} ${c1y} ${x1} ${c2y} ${x1} ${y1}`
  const t = 0.5
  const u = 1 - t
  const bx =
    u ** 3 * x0 +
    3 * u ** 2 * t * x0 +
    3 * u * t ** 2 * x1 +
    t ** 3 * x1
  const by =
    u ** 3 * y0 +
    3 * u ** 2 * t * c1y +
    3 * u * t ** 2 * c2y +
    t ** 3 * y1
  return { d, mid: { x: bx, y: by } }
}

function variantStroke(v: string | null | undefined): string {
  if (v === 'A' || v === null || v === undefined || v === '') return 'var(--accent-teal)'
  if (v === 'B') return 'var(--accent-amber)'
  if (v === 'C') return 'var(--accent-purple)'
  return 'rgba(255,255,255,0.25)'
}

export interface FunnelEdgesProps {
  edges: FunnelEdgeRow[]
  nodesById: Map<string, FunnelNodeRow>
  nodeHeights: Record<string, number>
  previewFrom: { x: number; y: number } | null
  previewTo: { x: number; y: number } | null
  hoveredEdgeId: string | null
  onEdgePointerEnter: (id: string) => void
  onEdgePointerLeave: () => void
  onEdgeDeleteClick: (id: string) => void
}

export function FunnelEdges({
  edges,
  nodesById,
  nodeHeights,
  previewFrom,
  previewTo,
  hoveredEdgeId,
  onEdgePointerEnter,
  onEdgePointerLeave,
  onEdgeDeleteClick,
}: FunnelEdgesProps) {
  const defaultH = 110

  const items = edges.map((e) => {
    const a = nodesById.get(e.source_node_id)
    const b = nodesById.get(e.target_node_id)
    if (!a || !b) return null
    const ha = nodeHeights[a.id] ?? defaultH
    const hb = nodeHeights[b.id] ?? defaultH
    void hb
    const p0 = portOut(a, ha)
    const p3 = portIn(b)
    const { d, mid } = cubicPath(p0.x, p0.y, p3.x, p3.y)
    const stroke = variantStroke(e.variant)
    const bright = hoveredEdgeId === e.id
    return { e, d, mid, stroke, bright }
  })

  let previewPath: string | null = null
  if (previewFrom && previewTo) {
    previewPath = cubicPath(previewFrom.x, previewFrom.y, previewTo.x, previewTo.y).d
  }

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <g style={{ pointerEvents: 'auto' }}>
        {items.map((it) =>
          it ? (
            <g key={it.e.id}>
              <path
                d={it.d}
                fill="none"
                stroke="transparent"
                strokeWidth={22}
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => onEdgePointerEnter(it.e.id)}
                onPointerLeave={() => onEdgePointerLeave()}
              />
              <path
                d={it.d}
                fill="none"
                stroke={it.stroke}
                strokeWidth={it.bright ? 2.2 : 1.5}
                opacity={it.bright ? 1 : 0.35}
                style={{ pointerEvents: 'none' }}
              />
              {it.e.variant ? (
                <g transform={`translate(${it.mid.x - 8}, ${it.mid.y - 8})`} style={{ pointerEvents: 'none' }}>
                  <rect
                    width={16}
                    height={16}
                    rx={4}
                    fill="rgba(10,10,20,0.9)"
                    stroke="rgba(255,255,255,0.2)"
                  />
                  <text
                    x={8}
                    y={12}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={10}
                    fontFamily="var(--font-mono, monospace)"
                  >
                    {it.e.variant}
                  </text>
                </g>
              ) : null}
              {it.bright ? (
                <g
                  transform={`translate(${it.mid.x - 10}, ${it.mid.y - 10})`}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onEdgeDeleteClick(it.e.id)
                  }}
                >
                  <circle r={10} cx={10} cy={10} fill="rgba(255,60,60,0.9)" />
                  <text
                    x={10}
                    y={14}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                    fontWeight={700}
                  >
                    ×
                  </text>
                </g>
              ) : null}
            </g>
          ) : null,
        )}
        {previewPath ? (
          <path
            d={previewPath}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            style={{ pointerEvents: 'none' }}
          />
        ) : null}
      </g>
    </svg>
  )
}
