import { useMemo } from 'react'
import type { Contact } from '../../types/db'

const SOURCE_META: Record<string, { label: string; color: string; funnelOrder: number }> = {
  website: { label: 'Website', color: '#2563eb', funnelOrder: 0 },
  linkedin: { label: 'LinkedIn / Ads', color: '#7c3aed', funnelOrder: 1 },
  cold: { label: 'Kaltakquise', color: '#64748b', funnelOrder: 2 },
  referral: { label: 'Empfehlung', color: '#059669', funnelOrder: 3 },
  event: { label: 'Event', color: '#d97706', funnelOrder: 4 },
  other: { label: 'Sonstiges', color: '#94a3b8', funnelOrder: 5 },
  '': { label: 'Direkt', color: '#cbd5e1', funnelOrder: 6 },
}

function sourceKey(raw: string | null | undefined): string {
  const k = (raw ?? '').trim()
  return k in SOURCE_META ? k : k ? 'other' : ''
}

interface PortalFunnelVisualProps {
  leads: Contact[]
  accentColor: string
}

export function PortalFunnelVisual({ leads, accentColor }: PortalFunnelVisualProps) {
  const { sources, statusCounts, total } = useMemo(() => {
    const srcMap = new Map<string, number>()
    const statusMap = new Map<string, number>()

    for (const l of leads) {
      const sk = sourceKey(l.lead_source)
      srcMap.set(sk, (srcMap.get(sk) ?? 0) + 1)
      const st = l.portal_lead_status ?? 'new'
      statusMap.set(st, (statusMap.get(st) ?? 0) + 1)
    }

    const sources = [...srcMap.entries()]
      .map(([key, count]) => ({
        key,
        count,
        ...(SOURCE_META[key] ?? SOURCE_META.other),
      }))
      .sort((a, b) => a.funnelOrder - b.funnelOrder)

    const statusCounts = {
      new: statusMap.get('new') ?? 0,
      contacted: statusMap.get('contacted') ?? 0,
      qualified: statusMap.get('qualified') ?? 0,
      closed: statusMap.get('closed') ?? 0,
    }

    return { sources, statusCounts, total: leads.length }
  }, [leads])

  const maxSource = Math.max(1, ...sources.map((s) => s.count))

  if (total === 0) {
    return (
      <div className="portal-funnel portal-funnel--empty">
        <div className="portal-funnel__empty-icon">◎</div>
        <p className="portal-funnel__empty-title">Dein Funnel startet bald</p>
        <p className="portal-funnel__empty-meta">
          Sobald Kampagnen live sind, siehst du hier den Weg von Website & Ads bis zu deinen Leads.
        </p>
        <div className="portal-funnel__ghost">
          {['Website', 'Ads', 'Leads', 'CRM'].map((step, i) => (
            <div key={step} className="portal-funnel__ghost-step" style={{ opacity: 0.35 + i * 0.12 }}>
              {step}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="portal-funnel">
      <div className="portal-funnel__section-label">Quellen → Leads</div>
      <div className="portal-funnel__sources">
        {sources.map((s) => (
          <div key={s.key} className="portal-funnel__source-row">
            <div className="portal-funnel__source-label">
              <span className="portal-funnel__dot" style={{ background: s.color }} />
              {s.label}
            </div>
            <div className="portal-funnel__source-bar-wrap">
              <div
                className="portal-funnel__source-bar"
                style={{
                  width: `${(s.count / maxSource) * 100}%`,
                  background: s.color,
                }}
              />
            </div>
            <div className="portal-funnel__source-count">{s.count}</div>
          </div>
        ))}
      </div>

      <div className="portal-funnel__connector">
        <div className="portal-funnel__connector-line" style={{ background: accentColor }} />
        <div className="portal-funnel__connector-badge" style={{ borderColor: accentColor, color: accentColor }}>
          {total} Leads gesamt
        </div>
      </div>

      <div className="portal-funnel__section-label">Pipeline-Status</div>
      <div className="portal-funnel__pipeline">
        {[
          { key: 'new', label: 'Neu', count: statusCounts.new },
          { key: 'contacted', label: 'Kontaktiert', count: statusCounts.contacted },
          { key: 'qualified', label: 'Qualifiziert', count: statusCounts.qualified },
          { key: 'closed', label: 'Abgeschlossen', count: statusCounts.closed },
        ].map((step, i, arr) => (
          <div key={step.key} className="portal-funnel__pipe-step">
            <div
              className="portal-funnel__pipe-node"
              style={{
                background:
                  step.count > 0
                    ? accentColor
                    : 'var(--portal-border)',
                color: step.count > 0 ? '#fff' : 'var(--portal-text-tertiary)',
              }}
            >
              {step.count}
            </div>
            <div className="portal-funnel__pipe-label">{step.label}</div>
            {i < arr.length - 1 ? (
              <div className="portal-funnel__pipe-arrow">→</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
