/** Stable short hash for content-cache keys (djb2). */
export function hashContent(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i)
  }
  return `c_${(h >>> 0).toString(16)}`
}

export function hashFunnelGraph(
  nodes: Array<{ id: string; type: string; label: string; config?: unknown }>,
  edges: Array<{ source_node_id: string; target_node_id: string; variant?: string | null }>,
): string {
  const payload = JSON.stringify({ nodes, edges })
  return hashContent(payload)
}
