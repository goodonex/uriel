import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../SectionLabel'
import { useContacts } from '../../hooks/useContacts'
import { useBrandNavigate } from '../../hooks/useBrandNavigate'
import { contactSalesPath } from '../../lib/openContactTabs'
import { companyDisplayName } from '../../lib/crmContacts'
import { selectNextCalls } from '../../lib/salesNextCalls'
import { buildSalesOverview } from '../../modules/sales/salesOverview'
import {
  useWorkspaceContextMenu,
  WorkspaceContextMenu,
} from '../workspace/WorkspaceContextMenu'

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : ''
}

export function SalesHomeDashboard() {
  const { slug = '' } = useParams<{ slug: string }>()
  const contacts = useContacts(slug)
  const { go, openNewTab } = useBrandNavigate(slug)
  const { state: ctxMenu, close: closeCtx, openAt: openCtxAt, runAction: runCtxAction } =
    useWorkspaceContextMenu()

  const overview = useMemo(() => buildSalesOverview(contacts.items), [contacts.items])

  const nextCalls = useMemo(() => selectNextCalls(contacts.items, 10), [contacts.items])

  const markCalledToday = useCallback(
    (contactId: string) => {
      contacts.update(contactId, { last_contact_at: new Date().toISOString() })
    },
    [contacts],
  )

  return (
    <div className="font-mono" style={{ padding: '4px 2px 20px' }}>
      <SectionLabel accent="var(--mode-sales)" tight>
        Übersicht
      </SectionLabel>

      <div
        className="flex flex-wrap gap-2"
        style={{ marginTop: 12, marginBottom: 20 }}
      >
        {[
          { label: 'Offene Deals', value: String(overview.totalInPipeline) },
          { label: 'Follow-ups heute', value: String(overview.dueTodayCount) },
          { label: 'Pipeline-Wert', value: overview.pipelineValue },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="glass-2"
            style={{
              flex: '1 1 120px',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
            }}
          >
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
              {kpi.label}
            </div>
            <div
              className="font-display"
              style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <h3
          className="font-display"
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}
        >
          Nächste 10 Anrufe
        </h3>
        <button
          type="button"
          onClick={() => go(`/brand/${slug}/sales/pipeline`)}
          style={{
            fontSize: 10,
            color: 'var(--mode-sales)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Zur Pipeline →
        </button>
      </div>

      {contacts.loading ? (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Lade Kontakte…</p>
      ) : nextCalls.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          Keine offenen Erstkontakte — Follow-ups/Termine geplant, disqualifiziert oder heute
          bereits angerufen.
        </p>
      ) : (
        <div
          className="glass-1"
          style={{
            borderRadius: 12,
            border: '1px solid var(--glass-border-2)',
            overflow: 'hidden',
          }}
        >
          {nextCalls.map((c, i) => {
            const phone = c.phone?.trim() ?? ''
            const company = companyDisplayName(c)
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderTop: i > 0 ? '1px solid var(--glass-border-1)' : undefined,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="font-display"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name?.trim() || 'Unbenannt'}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {company}
                    {phone ? (
                      <>
                        {' · '}
                        <a
                          href={telHref(phone)}
                          onClick={() => markCalledToday(c.id)}
                          style={{ color: 'var(--accent-blue)' }}
                        >
                          {phone}
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => go(contactSalesPath(slug, c.id))}
                  onContextMenu={(e) =>
                    openCtxAt(e, () => openNewTab(contactSalesPath(slug, c.id)))
                  }
                  style={{
                    fontSize: 10,
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid var(--glass-border-2)',
                    background: 'var(--glass-2)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Öffnen
                </button>
              </div>
            )
          })}
        </div>
      )}

      <WorkspaceContextMenu
        open={ctxMenu.open}
        x={ctxMenu.x}
        y={ctxMenu.y}
        onOpenInNewTab={runCtxAction}
        onClose={closeCtx}
      />
    </div>
  )
}
