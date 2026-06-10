import type { ReactNode } from 'react'
import { CONTACT_STATUS_OPTIONS } from '../../lib/crmStatus'
import { LEAD_SOURCE_OPTIONS } from '../../lib/crmLeadSource'
import type { CrmFilterState } from '../../lib/crmFilters'
import { EMPTY_CRM_FILTERS } from '../../lib/crmFilters'
import type { ContactList, PipelineStage } from '../../types/db'

const STAGES: { value: PipelineStage; label: string }[] = [
  { value: 'first_contact', label: 'Erstkontakt' },
  { value: 'conversation', label: 'Gespräch' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'proposal', label: 'Pitch' },
  { value: 'deal', label: 'Deal' },
  { value: 'paused', label: 'Pause' },
]

export function CrmFilterPanel({
  open,
  filters,
  lists,
  onChange,
  onClose,
}: {
  open: boolean
  filters: CrmFilterState
  lists: ContactList[]
  onChange: (f: CrmFilterState) => void
  onClose: () => void
}) {
  if (!open) return null

  const toggle = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

  return (
    <div
      className="glass-2 font-mono"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 8,
        zIndex: 40,
        width: 'min(320px, 90vw)',
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--glass-border-1)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      }}
    >
      <FilterSection title="Status">
        {CONTACT_STATUS_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            on={filters.statuses.includes(o.value)}
            label={o.label}
            onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, o.value) })}
          />
        ))}
      </FilterSection>
      <FilterSection title="Phase">
        {STAGES.map((o) => (
          <Chip
            key={o.value}
            on={filters.stages.includes(o.value)}
            label={o.label}
            onClick={() => onChange({ ...filters, stages: toggle(filters.stages, o.value) })}
          />
        ))}
      </FilterSection>
      <FilterSection title="Liste">
        {lists.map((l) => (
          <Chip
            key={l.id}
            on={filters.listIds.includes(l.id)}
            label={l.name}
            onClick={() => onChange({ ...filters, listIds: toggle(filters.listIds, l.id) })}
          />
        ))}
      </FilterSection>
      <FilterSection title="Herkunft">
        {LEAD_SOURCE_OPTIONS.filter((o) => o.value).map((o) => (
          <Chip
            key={o.value}
            on={filters.sources.includes(o.value)}
            label={o.label}
            onClick={() => onChange({ ...filters, sources: toggle(filters.sources, o.value) })}
          />
        ))}
      </FilterSection>
      <label style={{ display: 'block', marginBottom: 10, fontSize: 10 }}>
        Letzte Aktivität
        <select
          value={filters.activity}
          onChange={(e) => onChange({ ...filters, activity: e.target.value as CrmFilterState['activity'] })}
          style={selectStyle}
        >
          <option value="all">Alle</option>
          <option value="today">Heute</option>
          <option value="week">Diese Woche</option>
          <option value="month">Diesen Monat</option>
          <option value="none">Keine</option>
        </select>
      </label>
      <label style={{ display: 'block', marginBottom: 10, fontSize: 10 }}>
        Follow-up fällig
        <select
          value={filters.followDue}
          onChange={(e) => onChange({ ...filters, followDue: e.target.value as CrmFilterState['followDue'] })}
          style={selectStyle}
        >
          <option value="all">Alle</option>
          <option value="today">Heute</option>
          <option value="overdue">Überfällig</option>
          <option value="week">Diese Woche</option>
        </select>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange({ ...EMPTY_CRM_FILTERS })} style={btn}>
          Alle zurücksetzen
        </button>
        <button type="button" onClick={onClose} style={btn}>
          Schließen
        </button>
      </div>
    </div>
  )
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
    </div>
  )
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 10,
        padding: '4px 8px',
        borderRadius: 999,
        border: on ? '1px solid var(--mode-sales)' : '1px solid var(--glass-border-2)',
        background: on ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)' : 'var(--glass-2)',
        color: on ? 'var(--mode-sales)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const selectStyle = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 11,
} as const

const btn = {
  fontSize: 10,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
} as const
