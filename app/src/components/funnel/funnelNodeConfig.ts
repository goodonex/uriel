import type { FunnelNodeRow, FunnelNodeType } from '../../types/funnel'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function isFunnelNodeConfigured(node: FunnelNodeRow): boolean {
  const c = node.config ?? {}
  switch (node.type as FunnelNodeType) {
    case 'ad':
      return Boolean(str(c.platform) && str(c.campaign_id))
    case 'content':
      return Boolean(str(c.piece_id) || (node.label && node.label !== 'Content'))
    case 'landing_page':
      return Boolean(str(c.url))
    case 'lead_form':
      return Boolean(str(c.slug))
    case 'email_sequence':
      return Boolean(str(c.sequence_id))
    case 'mail_flow':
      return Boolean(str(c.flow_id))
    case 'booking_link':
      return Boolean(str(c.link_id))
    case 'retargeting':
      return Boolean(str(c.target_node_id))
    case 'goal':
      return Boolean(str(c.label) || str(c.target_metric) || node.label.length > 2)
    default:
      return false
  }
}

export function nodeTypeLabel(type: FunnelNodeType): string {
  const map: Record<FunnelNodeType, string> = {
    ad: 'Ad',
    content: 'Content',
    landing_page: 'Landing Page',
    lead_form: 'Lead-Formular',
    email_sequence: 'E-Mail-Sequenz',
    mail_flow: 'Mail-Flow',
    booking_link: 'Buchungslink',
    retargeting: 'Retargeting',
    goal: 'Ziel',
  }
  return map[type] ?? type
}

export function nodeTypeEmoji(type: FunnelNodeType): string {
  const map: Record<FunnelNodeType, string> = {
    ad: '📢',
    content: '📄',
    landing_page: '🌐',
    lead_form: '📋',
    email_sequence: '✉️',
    mail_flow: '🔀',
    booking_link: '📅',
    retargeting: '🔁',
    goal: '🎯',
  }
  return map[type] ?? '◆'
}

export function defaultLabelForType(type: FunnelNodeType): string {
  return nodeTypeLabel(type)
}
