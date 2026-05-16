import { generateId } from '../../lib/storage'
import type { FunnelEdgeRow, FunnelNodeRow, FunnelNodeType } from '../../types/funnel'

const NODE_DY = 150
const BASE_X = 320

function node(
  funnelId: string,
  type: FunnelNodeType,
  label: string,
  x: number,
  y: number,
  config: Record<string, unknown> = {},
): FunnelNodeRow {
  const id = generateId()
  return {
    id,
    funnel_id: funnelId,
    type,
    label,
    position_x: x,
    position_y: y,
    config,
    created_at: new Date().toISOString(),
  }
}

function edge(
  funnelId: string,
  sourceId: string,
  targetId: string,
  variant: string | null = null,
): FunnelEdgeRow {
  return {
    id: generateId(),
    funnel_id: funnelId,
    source_node_id: sourceId,
    target_node_id: targetId,
    label: null,
    variant,
    created_at: new Date().toISOString(),
  }
}

export type TemplateId = 'lead_gen' | 'content' | 'webinar' | 'empty'

export function buildTemplateFunnel(
  template: TemplateId,
  funnelId: string,
): { nodes: FunnelNodeRow[]; edges: FunnelEdgeRow[] } {
  if (template === 'empty') {
    return { nodes: [], edges: [] }
  }

  const nodes: FunnelNodeRow[] = []
  const edges: FunnelEdgeRow[] = []

  if (template === 'lead_gen') {
    const n1 = node(funnelId, 'ad', 'Werbeanzeige', BASE_X, 40)
    const n2 = node(funnelId, 'landing_page', 'Landing Page', BASE_X, 40 + NODE_DY)
    const n3 = node(funnelId, 'lead_form', 'Lead-Formular', BASE_X, 40 + NODE_DY * 2)
    const n4 = node(funnelId, 'email_sequence', 'E-Mail-Sequenz', BASE_X, 40 + NODE_DY * 3)
    const n5 = node(funnelId, 'goal', 'Erstgespräch', BASE_X, 40 + NODE_DY * 4, {
      label: 'Erstgespräch gebucht',
      target_metric: 'Deals',
    })
    nodes.push(n1, n2, n3, n4, n5)
    edges.push(
      edge(funnelId, n1.id, n2.id),
      edge(funnelId, n2.id, n3.id),
      edge(funnelId, n3.id, n4.id),
      edge(funnelId, n4.id, n5.id),
    )
    return { nodes, edges }
  }

  if (template === 'content') {
    const n1 = node(funnelId, 'content', 'Content 1', BASE_X - 80, 40)
    const n2 = node(funnelId, 'content', 'Content 2', BASE_X + 80, 40 + NODE_DY)
    const n3 = node(funnelId, 'content', 'Content 3', BASE_X - 80, 40 + NODE_DY * 2)
    const n4 = node(funnelId, 'booking_link', 'Buchung', BASE_X + 80, 40 + NODE_DY * 3)
    const n5 = node(funnelId, 'goal', 'Follower → Kunde', BASE_X, 40 + NODE_DY * 4, {
      label: 'Follower → Kunde',
    })
    nodes.push(n1, n2, n3, n4, n5)
    edges.push(
      edge(funnelId, n1.id, n2.id),
      edge(funnelId, n2.id, n3.id),
      edge(funnelId, n3.id, n4.id),
      edge(funnelId, n4.id, n5.id),
    )
    return { nodes, edges }
  }

  // webinar
  const w1 = node(funnelId, 'ad', 'Webinar-Ad', BASE_X, 40)
  const w2 = node(funnelId, 'landing_page', 'Anmeldung', BASE_X, 40 + NODE_DY)
  const w3 = node(funnelId, 'email_sequence', 'Reminder-Mails', BASE_X, 40 + NODE_DY * 2)
  const w4 = node(funnelId, 'mail_flow', 'Follow-up Flow', BASE_X, 40 + NODE_DY * 3)
  const w5 = node(funnelId, 'booking_link', '1:1 Slot', BASE_X, 40 + NODE_DY * 4)
  const w6 = node(funnelId, 'goal', 'Teilnehmer', BASE_X, 40 + NODE_DY * 5, {
    label: 'Webinar-Ziel erreicht',
    target_metric: 'Teilnehmer',
  })
  nodes.push(w1, w2, w3, w4, w5, w6)
  edges.push(
    edge(funnelId, w1.id, w2.id),
    edge(funnelId, w2.id, w3.id),
    edge(funnelId, w3.id, w4.id),
    edge(funnelId, w4.id, w5.id),
    edge(funnelId, w5.id, w6.id),
  )
  return { nodes, edges }
}
