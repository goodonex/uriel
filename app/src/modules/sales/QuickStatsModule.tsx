import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useContacts } from '../../hooks/useContacts'
import { buildSalesOverview } from './salesOverview'

export function QuickStatsModule() {
  const { slug } = useParams<{ slug: string }>()
  const contacts = useContacts(slug)

  const overview = useMemo(
    () => buildSalesOverview(contacts.items),
    [contacts.items],
  )

  if (!slug) return null

  if (contacts.loading) {
    return (
      <div
        className="animate-pulse rounded-xl"
        style={{
          minHeight: 120,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (contacts.error) {
    return (
      <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
        {contacts.error}
      </p>
    )
  }

  const rows = [
    { k: 'Gesamt in Pipeline', v: String(overview.totalInPipeline) },
    { k: 'Heute fällig', v: String(overview.dueTodayCount) },
    { k: 'Diese Woche abgeschlossen', v: String(overview.weekClosedCount) },
    { k: 'Pipeline-Wert', v: overview.pipelineValue },
  ] as const

  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((s) => (
        <div
          key={s.k}
          className="glass-2 rounded-xl px-3 py-2"
          style={{ border: '1px solid var(--glass-border-1)' }}
        >
          <div
            className="font-mono"
            style={{ fontSize: 8, color: 'var(--text-tertiary)', marginBottom: 4, lineHeight: 1.2 }}
          >
            {s.k}
          </div>
          <div
            className="font-display truncate"
            style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}
          >
            {s.v}
          </div>
        </div>
      ))}
    </div>
  )
}
