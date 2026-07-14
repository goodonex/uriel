import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdCampaign } from '../../types/db'
import type { FunnelNodeRow, FunnelNodeType } from '../../types/funnel'
import type { ContentPiece } from '../../types/db'
import {
  nodeTypeEmoji,
  nodeTypeLabel,
} from './funnelNodeConfig'

const NODE_W = 220

const glass: React.CSSProperties = {
  width: NODE_W,
  minHeight: 80,
  borderRadius: 14,
  background: 'var(--surface-popover)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid var(--glass-border-1)',
  position: 'absolute',
  left: 0,
  top: 0,
}

export interface FunnelNodeProps {
  slug: string
  funnelId?: string
  node: FunnelNodeRow
  configured: boolean
  adCampaign?: AdCampaign | null
  contentPiece?: ContentPiece | null
  retargetName?: string | null
  liveLine?: string | null
  dealCount?: number
  enrollmentActiveCount?: number
  bookingLinkSlug?: string | null
  onMoveEnd: (id: string, x: number, y: number) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onOpenAds?: () => void
  onOpenCalendar?: () => void
  onOpenEmailTab?: () => void
  onOpenFlowsTab?: () => void
  onScrollToNode?: (targetId: string) => void
  onReportHeight: (id: string, h: number) => void
  onOutputPointerDown: (e: React.PointerEvent) => void
  onInputPointerUp: (e: React.PointerEvent) => void
  outputHot: boolean
  inputHot: boolean
}

export function FunnelNode({
  slug,
  funnelId,
  node,
  configured,
  adCampaign,
  contentPiece,
  retargetName,
  liveLine,
  dealCount,
  enrollmentActiveCount,
  bookingLinkSlug,
  onMoveEnd,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenAds,
  onOpenCalendar,
  onOpenEmailTab,
  onOpenFlowsTab,
  onScrollToNode,
  onReportHeight,
  onOutputPointerDown,
  onInputPointerUp,
  outputHot,
  inputHot,
}: FunnelNodeProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)

  const x = dragPos?.x ?? node.position_x
  const y = dragPos?.y ?? node.position_y

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      onReportHeight(node.id, el.offsetHeight)
    })
    ro.observe(el)
    onReportHeight(node.id, el.offsetHeight)
    return () => ro.disconnect()
  }, [node.id, onReportHeight])

  const endDrag = useCallback(() => {
    if (!dragRef.current) return
    const { origX, origY } = dragRef.current
    const nx = dragPos?.x ?? origX
    const ny = dragPos?.y ?? origY
    dragRef.current = null
    setDragPos(null)
    onMoveEnd(node.id, nx, ny)
  }, [dragPos, node.id, onMoveEnd])

  useEffect(() => {
    const up = () => endDrag()
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [endDrag])

  const onBodyPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-funnel-port]')) return
    e.stopPropagation()
    dragRef.current = {
      id: node.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.position_x,
      origY: node.position_y,
    }
    setDragPos({ x: node.position_x, y: node.position_y })
  }

  const onBodyPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || dragRef.current.id !== node.id) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setDragPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy })
  }

  const borderColor = configured
    ? 'var(--glass-border-1)'
    : 'color-mix(in srgb, var(--status-danger) 40%, transparent)'

  const cfg = node.config as Record<string, unknown>

  const bodyClick = () => {
    if (node.type === 'ad' && typeof cfg.campaign_id === 'string' && onOpenAds) {
      onOpenAds()
      return
    }
    if (node.type === 'content') {
      onOpenCalendar?.()
      return
    }
    if (node.type === 'landing_page' && typeof cfg.url === 'string') {
      window.open(cfg.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (node.type === 'lead_form') {
      const leadSlug = (cfg.slug as string) || slug
      const q = funnelId ? `?funnel=${encodeURIComponent(funnelId)}` : ''
      window.open(`/leads/${leadSlug}${q}`, '_blank', 'noopener,noreferrer')
      return
    }
    if (node.type === 'email_sequence') {
      onOpenEmailTab?.()
      return
    }
    if (node.type === 'mail_flow') {
      onOpenFlowsTab?.()
      return
    }
    if (node.type === 'booking_link' && typeof cfg.link_id === 'string') {
      const ls = (cfg.link_slug as string) || bookingLinkSlug || ''
      if (ls) window.open(`/book/${slug}/${ls}`, '_blank', 'noopener,noreferrer')
      return
    }
    if (node.type === 'retargeting' && typeof cfg.target_node_id === 'string') {
      onScrollToNode?.(cfg.target_node_id)
      return
    }
  }

  return (
    <div
      ref={rootRef}
      data-funnel-node-id={node.id}
      style={{
        ...glass,
        left: x,
        top: y,
        border: `1px solid ${borderColor}`,
        cursor: 'default',
        zIndex: 5,
      }}
    >
      <div
        role="presentation"
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onClick={bodyClick}
        style={{ padding: '10px 12px 28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono, monospace)' }}>
            {nodeTypeEmoji(node.type as FunnelNodeType)} {nodeTypeLabel(node.type as FunnelNodeType)}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="font-mono"
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((o) => !o)
              }}
              style={{
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: 6,
                border: '1px solid var(--glass-border-2)',
                background: 'color-mix(in srgb, var(--bg-void) 25%, transparent)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 22,
                  minWidth: 140,
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--surface-popover)',
                  zIndex: 30,
                  padding: 4,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {(
                  [
                    { label: 'Bearbeiten', action: onEdit },
                    { label: 'Duplizieren', action: onDuplicate },
                    { label: 'Löschen', action: onDelete },
                  ] as const
                ).map(({ label, action }) => (
                  <button
                    key={label}
                    type="button"
                    className="font-mono"
                    onClick={() => {
                      setMenuOpen(false)
                      action()
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      fontSize: 10,
                      padding: '6px 8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{node.label}</div>
        <NodeBody
          type={node.type as FunnelNodeType}
          cfg={cfg}
          slug={slug}
          adCampaign={adCampaign}
          contentPiece={contentPiece}
          retargetName={retargetName}
          dealCount={dealCount}
          enrollmentActiveCount={enrollmentActiveCount}
        />
        {liveLine ? (
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7, color: 'var(--text-secondary)' }}>{liveLine}</div>
        ) : null}
      </div>
      <div
        data-funnel-port="in"
        onPointerUp={(e) => {
          e.stopPropagation()
          onInputPointerUp(e)
        }}
        title="Eingang"
        style={{
          position: 'absolute',
          left: '50%',
          top: -6,
          width: 14,
          height: 14,
          marginLeft: -7,
          borderRadius: '50%',
          background: inputHot ? 'rgba(80,160,255,0.95)' : 'rgba(80,160,255,0.65)',
          boxShadow: inputHot ? '0 0 0 3px rgba(80,160,255,0.25)' : undefined,
          border: '1px solid var(--glass-border-3)',
          cursor: 'crosshair',
          zIndex: 8,
        }}
      />
      <div
        data-funnel-port="out"
        onPointerDown={(e) => {
          e.stopPropagation()
          onOutputPointerDown(e)
        }}
        title="Ausgang"
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -6,
          width: 14,
          height: 14,
          marginLeft: -7,
          borderRadius: '50%',
          background: outputHot ? 'rgba(60,220,120,0.95)' : 'rgba(60,220,120,0.65)',
          boxShadow: outputHot ? '0 0 0 3px rgba(60,220,120,0.25)' : undefined,
          border: '1px solid var(--glass-border-3)',
          cursor: 'crosshair',
          zIndex: 8,
        }}
      />
    </div>
  )
}

function NodeBody({
  type,
  cfg,
  slug,
  adCampaign,
  contentPiece,
  retargetName,
  dealCount,
  enrollmentActiveCount,
}: {
  type: FunnelNodeType
  cfg: Record<string, unknown>
  slug: string
  adCampaign?: AdCampaign | null
  contentPiece?: ContentPiece | null
  retargetName?: string | null
  dealCount?: number
  enrollmentActiveCount?: number
}) {
  const tiny = { fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 } as const

  if (type === 'ad') {
    const platform = typeof cfg.platform === 'string' ? cfg.platform : '—'
    const status = typeof cfg.status === 'string' ? cfg.status : adCampaign?.status ?? '—'
    return (
      <div style={tiny}>
        <span style={{ color: 'var(--mode-promo)' }}>{platform}</span>
        {' · '}
        <span>{status}</span>
        {adCampaign && adCampaign.budget_total ? (
          <div>Budget: {adCampaign.budget_total} €</div>
        ) : null}
      </div>
    )
  }
  if (type === 'content') {
    const fmt = contentPiece?.tags?.format ?? '—'
    const ch = contentPiece?.tags?.channel ?? '—'
    const date = contentPiece?.scheduled_at ?? '—'
    return (
      <div style={tiny}>
        {fmt} · {ch}
        <div>Geplant: {String(date).slice(0, 10)}</div>
      </div>
    )
  }
  if (type === 'landing_page') {
    const url = typeof cfg.url === 'string' ? cfg.url : ''
    const cr = cfg.conversion_rate
    return (
      <div style={tiny}>
        <div style={{ wordBreak: 'break-all' }}>{url.slice(0, 48)}{url.length > 48 ? '…' : ''}</div>
        {typeof cr === 'number' || typeof cr === 'string' ? <div>CR: {String(cr)}</div> : null}
      </div>
    )
  }
  if (type === 'lead_form') {
    const s = typeof cfg.slug === 'string' ? cfg.slug : slug
    return (
      <div style={tiny}>
        <div>Slug: {s}</div>
        <button
          type="button"
          className="font-mono"
          onClick={(e) => {
            e.stopPropagation()
            void navigator.clipboard.writeText(`${window.location.origin}/leads/${s}`)
          }}
          style={{ marginTop: 4, fontSize: 10, padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }}
        >
          Link kopieren
        </button>
      </div>
    )
  }
  if (type === 'email_sequence') {
    return <div style={tiny}>Sequenz · Planwochen (Kalender)</div>
  }
  if (type === 'mail_flow') {
    return (
      <div style={tiny}>
        Aktiv in Flow: {enrollmentActiveCount ?? '—'}
      </div>
    )
  }
  if (type === 'booking_link') {
    return <div style={tiny}>Buchungslink · Sales</div>
  }
  if (type === 'retargeting') {
    return (
      <div style={tiny}>
        → {retargetName ?? 'Ziel-Node'}
      </div>
    )
  }
  if (type === 'goal') {
    const label = typeof cfg.label === 'string' ? cfg.label : ''
    const metric = typeof cfg.target_metric === 'string' ? cfg.target_metric : ''
    return (
      <div style={{ marginTop: 8, textAlign: 'center' }}>
        <div style={{ fontSize: 28 }}>✓</div>
        <div style={{ ...tiny, marginTop: 4 }}>{label || 'Ziel'}</div>
        {metric ? <div style={tiny}>{metric}</div> : null}
        {typeof dealCount === 'number' ? (
          <div style={{ ...tiny, opacity: 0.75 }}>Deals: {dealCount}</div>
        ) : null}
      </div>
    )
  }
  return null
}
