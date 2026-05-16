/** Promo Funnel Canvas — DB- und UI-Typen */

export type FunnelNodeType =
  | 'ad'
  | 'content'
  | 'landing_page'
  | 'lead_form'
  | 'email_sequence'
  | 'mail_flow'
  | 'booking_link'
  | 'retargeting'
  | 'goal'

export type FunnelNodeConfig = Record<string, unknown>

export interface FunnelRow {
  id: string
  brand_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface FunnelNodeRow {
  id: string
  funnel_id: string
  type: FunnelNodeType
  label: string
  position_x: number
  position_y: number
  config: FunnelNodeConfig
  created_at: string
}

export interface FunnelEdgeRow {
  id: string
  funnel_id: string
  source_node_id: string
  target_node_id: string
  label: string | null
  variant: string | null
  created_at: string
}

export type FunnelEdgeVariant = 'A' | 'B' | 'C' | null
