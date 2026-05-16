import { useEffect, useMemo, useRef } from 'react'
import type { AdCampaign, ContentPiece, ContentSequence, EmailSequence, SalesMeetingLink } from '../../types/db'
import type { FunnelNodeRow, FunnelNodeType } from '../../types/funnel'
import { nodeTypeLabel } from './funnelNodeConfig'

const FIELD: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-primary)',
  fontSize: 12,
}

export function NodeEditPanel({
  slug: _slug,
  brandSlugField,
  node,
  campaigns,
  pieces,
  emailSequences,
  mailFlows,
  meetingLinks,
  funnelNodes,
  onClose,
  onUpdate,
}: {
  slug: string
  brandSlugField: string
  node: FunnelNodeRow
  campaigns: AdCampaign[]
  pieces: ContentPiece[]
  emailSequences: ContentSequence[]
  mailFlows: EmailSequence[]
  meetingLinks: SalesMeetingLink[]
  funnelNodes: FunnelNodeRow[]
  onClose: () => void
  onUpdate: (patch: Partial<FunnelNodeRow>) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onDown = (ev: MouseEvent) => {
      if (!el.contains(ev.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const cfg = useMemo(() => ({ ...(node.config as Record<string, unknown>) }), [node.config])

  const patchConfig = (partial: Record<string, unknown>) => {
    onUpdate({ config: { ...cfg, ...partial } })
  }

  const otherNodes = funnelNodes.filter((n) => n.id !== node.id)

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        right: 12,
        top: 72,
        width: 320,
        maxHeight: 'calc(100% - 100px)',
        overflowY: 'auto',
        zIndex: 40,
        borderRadius: 14,
        padding: 14,
        background: 'rgba(10,10,20,0.88)',
        backdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}
    >
      <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8 }}>
        {nodeTypeLabel(node.type as FunnelNodeType)} bearbeiten
      </div>
      <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Label</label>
      <input
        style={{ ...FIELD, marginBottom: 10 }}
        value={node.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
      />

      {node.type === 'ad' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Plattform</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.platform as string) || 'meta'}
            onChange={(e) => patchConfig({ platform: e.target.value })}
          >
            {['meta', 'google', 'linkedin', 'tiktok'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Kampagne</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.campaign_id as string) || ''}
            onChange={(e) => patchConfig({ campaign_id: e.target.value || undefined })}
          >
            <option value="">— wählen —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Status</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.status as string) || 'draft'}
            onChange={(e) => patchConfig({ status: e.target.value })}
          >
            {['draft', 'live', 'paused', 'ended'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {node.type === 'content' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Content-Piece</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.piece_id as string) || ''}
            onChange={(e) => {
              const id = e.target.value
              const p = pieces.find((x) => x.id === id)
              patchConfig({ piece_id: id || undefined, piece_type: p?.tags?.format })
              if (p) onUpdate({ label: p.title })
            }}
          >
            <option value="">— manuell / neu —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {node.type === 'landing_page' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>URL</label>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.url as string) || ''}
            onChange={(e) => patchConfig({ url: e.target.value })}
          />
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Conversion-Rate</label>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={cfg.conversion_rate != null ? String(cfg.conversion_rate) : ''}
            onChange={(e) => patchConfig({ conversion_rate: e.target.value ? Number(e.target.value) : undefined })}
          />
        </>
      ) : null}

      {node.type === 'lead_form' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Brand-Slug (Lead-URL)</label>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.slug as string) || brandSlugField}
            onChange={(e) => patchConfig({ slug: e.target.value })}
          />
        </>
      ) : null}

      {node.type === 'email_sequence' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>E-Mail-Plan (Sequenz)</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.sequence_id as string) || ''}
            onChange={(e) => {
              const id = e.target.value
              const s = emailSequences.find((x) => x.id === id)
              patchConfig({ sequence_id: id || undefined })
              if (s) onUpdate({ label: s.name })
            }}
          >
            <option value="">— wählen —</option>
            {emailSequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {node.type === 'mail_flow' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Mail-Flow</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.flow_id as string) || ''}
            onChange={(e) => {
              const id = e.target.value
              const f = mailFlows.find((x) => x.id === id)
              patchConfig({ flow_id: id || undefined })
              if (f) onUpdate({ label: f.name })
            }}
          >
            <option value="">— wählen —</option>
            {mailFlows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {node.type === 'booking_link' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Buchungslink</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.link_id as string) || ''}
            onChange={(e) => {
              const id = e.target.value
              const l = meetingLinks.find((x) => x.id === id)
              patchConfig({ link_id: id || undefined, link_slug: l?.slug })
              if (l) onUpdate({ label: l.title })
            }}
          >
            <option value="">— wählen —</option>
            {meetingLinks.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {node.type === 'retargeting' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ziel-Node</label>
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.target_node_id as string) || ''}
            onChange={(e) => {
              const id = e.target.value
              const t = otherNodes.find((x) => x.id === id)
              patchConfig({ target_node_id: id || undefined })
              if (t) onUpdate({ label: `Retarget → ${t.label}` })
            }}
          >
            <option value="">— wählen —</option>
            {otherNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {node.type === 'goal' ? (
        <>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ziel-Beschreibung</label>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.label as string) || ''}
            onChange={(e) => patchConfig({ label: e.target.value })}
          />
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Metrik</label>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={(cfg.target_metric as string) || ''}
            onChange={(e) => patchConfig({ target_metric: e.target.value })}
          />
        </>
      ) : null}
    </div>
  )
}
