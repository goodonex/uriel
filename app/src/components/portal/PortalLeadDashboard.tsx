import { useMemo, useState } from 'react'
import { usePortalLeads } from '../../hooks/useProjectLeads'
import {
  PORTAL_LEAD_STATUS_LABEL,
  type Contact,
  type PortalLeadStatus,
} from '../../types/db'

const LEAD_SOURCE_LABEL: Record<string, string> = {
  '': '—',
  cold: 'Kaltakquise',
  referral: 'Empfehlung',
  linkedin: 'LinkedIn',
  website: 'Website',
  event: 'Event',
  other: 'Sonstiges',
}

type StatusFilter = 'all' | 'new' | 'active' | 'closed'

interface PortalLeadDashboardProps {
  projectId: string
  accentColor: string
  variant?: 'default' | 'crm'
  embedded?: boolean
}

export function PortalLeadDashboard({
  projectId,
  accentColor,
  variant = 'default',
  embedded = false,
}: PortalLeadDashboardProps) {
  const { leads, loading, error, updateStatus, updateNotes } = usePortalLeads(projectId)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [detailLead, setDetailLead] = useState<Contact | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    let thisWeek = 0
    let closed = 0
    for (const l of leads) {
      const t = new Date(l.created_at ?? 0).getTime()
      if (t >= weekAgo) thisWeek++
      if (l.portal_lead_status === 'closed') closed++
    }
    return { total: leads.length, thisWeek, closed }
  }, [leads])

  const filtered = useMemo(() => {
    let rows = leads
    if (statusFilter === 'new') {
      rows = rows.filter((l) => (l.portal_lead_status ?? 'new') === 'new')
    } else if (statusFilter === 'active') {
      rows = rows.filter((l) =>
        ['contacted', 'qualified'].includes(l.portal_lead_status ?? 'new'),
      )
    } else if (statusFilter === 'closed') {
      rows = rows.filter((l) =>
        ['closed', 'lost'].includes(l.portal_lead_status ?? 'new'),
      )
    }
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((l) => {
      const hay = [l.name, l.email, l.phone, l.lead_source]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [leads, query, statusFilter])

  const exportCsv = () => {
    const header = ['Name', 'Telefon', 'E-Mail', 'Datum', 'Status']
    const rows = filtered.map((l) => [
      l.name || '',
      l.phone || '',
      l.email || '',
      l.created_at ? new Date(l.created_at).toLocaleDateString('de-DE') : '',
      PORTAL_LEAD_STATUS_LABEL[(l.portal_lead_status ?? 'new') as PortalLeadStatus],
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openDetail = (lead: Contact) => {
    setDetailLead(lead)
    setNotesDraft(lead.portal_notes ?? '')
  }

  const isCrm = variant === 'crm'

  const card = (
    <div className={`portal-card${embedded ? ' portal-card--flat' : ''}`} style={{ marginBottom: embedded ? 0 : undefined }}>
        {!isCrm ? (
          <>
            <h2 className="portal-section-title">Deine Leads</h2>
            <p className="portal-section-meta">
              Leads, die wir für dich generiert haben — Status jederzeit aktualisieren.
            </p>
          </>
        ) : null}

        {isCrm ? (
          <div className="portal-stats" style={{ marginBottom: 16 }}>
            <div className="portal-stat">
              <div className="portal-stat-value">{stats.total}</div>
              <div className="portal-stat-label">Gesamt</div>
            </div>
            <div className="portal-stat">
              <div className="portal-stat-value">{stats.thisWeek}</div>
              <div className="portal-stat-label">Diese Woche</div>
            </div>
            <div className="portal-stat">
              <div className="portal-stat-value">{stats.closed}</div>
              <div className="portal-stat-label">Abgeschlossen</div>
            </div>
          </div>
        ) : null}

        {!isCrm ? (
          <div className="portal-stats">
            <div className="portal-stat">
              <div className="portal-stat-value">{stats.total}</div>
              <div className="portal-stat-label">Gesamt</div>
            </div>
            <div className="portal-stat">
              <div className="portal-stat-value">{stats.thisWeek}</div>
              <div className="portal-stat-label">Diese Woche</div>
            </div>
            <div className="portal-stat">
              <div className="portal-stat-value">{stats.closed}</div>
              <div className="portal-stat-label">Abgeschlossen</div>
            </div>
          </div>
        ) : null}

        {error ? (
          <p style={{ fontSize: 13, color: 'var(--status-danger)' }}>{error}</p>
        ) : null}

        {isCrm ? (
          <>
            <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
              {(
                [
                  ['all', 'Alle'],
                  ['new', 'Neu'],
                  ['active', 'In Bearbeitung'],
                  ['closed', 'Abgeschlossen'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="portal-btn portal-btn-ghost"
                  style={{
                    fontSize: 12,
                    borderColor: statusFilter === id ? accentColor : undefined,
                    color: statusFilter === id ? accentColor : undefined,
                  }}
                  onClick={() => setStatusFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="portal-input"
              placeholder="Leads durchsuchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginBottom: 12 }}
            />
          </>
        ) : null}

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--portal-text-secondary)' }}>Laden…</p>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--portal-text-secondary)', marginBottom: 12 }}>
            {isCrm
              ? 'Ihre ersten Leads werden hier erscheinen, sobald die Kampagnen live sind.'
              : 'Noch keine Leads zugeordnet.'}
          </p>
        ) : (
          <>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    {isCrm ? <th>Telefon</th> : null}
                    <th>{isCrm ? 'E-Mail' : 'Kontakt'}</th>
                    {!isCrm ? <th>Quelle</th> : null}
                    <th>Datum</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l) => (
                    <tr
                      key={l.id}
                      style={{ cursor: isCrm ? 'pointer' : undefined }}
                      onClick={isCrm ? () => openDetail(l) : undefined}
                    >
                      <td>{l.name || '—'}</td>
                      {isCrm ? (
                        <td>
                          {l.phone ? (
                            <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()}>
                              {l.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      ) : null}
                      <td>
                        {isCrm
                          ? l.email || '—'
                          : [l.email, l.phone].filter(Boolean).join(' · ') || '—'}
                      </td>
                      {!isCrm ? (
                        <td>{LEAD_SOURCE_LABEL[l.lead_source] ?? l.lead_source ?? '—'}</td>
                      ) : null}
                      <td>
                        {l.created_at
                          ? new Date(l.created_at).toLocaleDateString('de-DE')
                          : '—'}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className="portal-select"
                          style={{ minWidth: 120, padding: '6px 8px', fontSize: 12 }}
                          value={l.portal_lead_status ?? 'new'}
                          onChange={(e) =>
                            void updateStatus(l.id, e.target.value as PortalLeadStatus)
                          }
                        >
                          {(Object.keys(PORTAL_LEAD_STATUS_LABEL) as PortalLeadStatus[]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {PORTAL_LEAD_STATUS_LABEL[s]}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="portal-lead-cards">
              {filtered.map((l) => (
                <div key={l.id} className="portal-lead-card">
                  <div className="portal-lead-card__name">{l.name || '—'}</div>
                  {l.phone ? (
                    <a href={`tel:${l.phone}`} style={{ fontSize: 14, color: accentColor }}>
                      {l.phone}
                    </a>
                  ) : null}
                  <select
                    className="portal-select mt-2"
                    style={{ width: '100%', padding: '8px', fontSize: 12 }}
                    value={l.portal_lead_status ?? 'new'}
                    onChange={(e) =>
                      void updateStatus(l.id, e.target.value as PortalLeadStatus)
                    }
                  >
                    {(Object.keys(PORTAL_LEAD_STATUS_LABEL) as PortalLeadStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {PORTAL_LEAD_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="portal-btn portal-btn-ghost mt-2"
                    style={{ width: '100%', fontSize: 12 }}
                    onClick={() => openDetail(l)}
                  >
                    Details
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="portal-btn portal-btn-ghost"
              style={{ marginTop: 12 }}
              onClick={exportCsv}
            >
              CSV exportieren
            </button>
          </>
        )}
    </div>
  )

  const detailDrawer =
    detailLead && isCrm ? (
      <div className="portal-lead-detail-drawer" role="dialog">
        <button
          type="button"
          className="portal-lead-detail-drawer__backdrop"
          aria-label="Schließen"
          onClick={() => setDetailLead(null)}
        />
        <div className="portal-lead-detail-drawer__panel">
          <button
            type="button"
            className="portal-btn portal-btn-ghost mb-4"
            onClick={() => setDetailLead(null)}
          >
            ← Zurück
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{detailLead.name}</h2>
          <p style={{ fontSize: 14, color: 'var(--portal-text-secondary)' }}>
            {[detailLead.email, detailLead.phone].filter(Boolean).join(' · ')}
          </p>
          <label className="block mt-4 mb-1" style={{ fontSize: 12, fontWeight: 600 }}>
            Status
          </label>
          <select
            className="portal-select"
            style={{ width: '100%', padding: '8px', marginBottom: 16 }}
            value={detailLead.portal_lead_status ?? 'new'}
            onChange={(e) => {
              const status = e.target.value as PortalLeadStatus
              void updateStatus(detailLead.id, status)
              setDetailLead({ ...detailLead, portal_lead_status: status })
            }}
          >
            {(Object.keys(PORTAL_LEAD_STATUS_LABEL) as PortalLeadStatus[]).map((s) => (
              <option key={s} value={s}>
                {PORTAL_LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <label className="block mb-1" style={{ fontSize: 12, fontWeight: 600 }}>
            Notizen
          </label>
          <textarea
            className="portal-input"
            rows={5}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Eigene Notizen zu diesem Lead…"
          />
          <button
            type="button"
            className="portal-btn portal-btn-primary mt-3"
            style={{ background: accentColor }}
            onClick={() => void updateNotes(detailLead.id, notesDraft)}
          >
            Notizen speichern
          </button>
        </div>
      </div>
    ) : null

  if (embedded && isCrm) {
    return (
      <div className="portal-area-view">
        <header className="portal-area-view__head">
          <div>
            <h2 className="portal-area-view__title">Ihre Leads</h2>
            <p className="portal-area-view__meta">CRM — alle Leads verwalten & exportieren</p>
          </div>
        </header>
        {card}
        {detailDrawer}
      </div>
    )
  }

  return (
    <section className={isCrm ? 'portal-area' : undefined}>
      {isCrm && !embedded ? (
        <header className="portal-area__header">
          <div className="portal-area__icon">👥</div>
          <div style={{ flex: 1 }}>
            <h2 className="portal-area__title">Ihre Leads</h2>
            <p className="portal-area__meta">CRM — alle Leads im Überblick</p>
          </div>
        </header>
      ) : null}
      {card}
      {detailDrawer}
    </section>
  )
}
