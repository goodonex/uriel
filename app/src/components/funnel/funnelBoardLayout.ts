import type { FunnelNodeRow } from '../../types/funnel'

export const NODE_W = 220

const BOARD_PAD = 120
const MIN_W = 900
const MIN_H = 600
const DEFAULT_NODE_H = 110

/** Canvas size from node positions + measured heights (padding for pan/zoom). */
export function computeBoardSize(
  nodes: FunnelNodeRow[],
  nodeHeights: Record<string, number>,
): { w: number; h: number } {
  if (nodes.length === 0) return { w: MIN_W, h: MIN_H }

  let maxRight = BOARD_PAD
  let maxBottom = BOARD_PAD
  for (const n of nodes) {
    const h = nodeHeights[n.id] ?? DEFAULT_NODE_H
    maxRight = Math.max(maxRight, n.position_x + NODE_W + BOARD_PAD)
    maxBottom = Math.max(maxBottom, n.position_y + h + BOARD_PAD)
  }
  return {
    w: Math.max(MIN_W, maxRight),
    h: Math.max(MIN_H, maxBottom),
  }
}
