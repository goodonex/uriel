import type { PipelineViewMode } from '../../lib/crmViewStorage'

const btn = {
  fontSize: 11,
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  cursor: 'pointer',
} as const

export function CrmToolbar({
  onNewLead,
  viewMode,
  onViewModeChange,
  onToggleFilter,
  filterActive,
}: {
  onNewLead: () => void
  viewMode: PipelineViewMode
  onViewModeChange: (m: PipelineViewMode) => void
  onToggleFilter: () => void
  filterActive: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onNewLead}
        style={{
          ...btn,
          border: '1px solid var(--mode-sales)',
          color: 'var(--mode-sales)',
          fontWeight: 600,
        }}
      >
        Neuer Lead
      </button>
      <button
        type="button"
        onClick={onToggleFilter}
        style={{
          ...btn,
          color: filterActive ? 'var(--mode-sales)' : 'var(--text-secondary)',
          border: filterActive ? '1px solid var(--mode-sales)' : btn.border,
        }}
      >
        Filter
      </button>
      <div className="flex" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--glass-border-2)' }}>
        {(['cards', 'table'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onViewModeChange(m)}
            className="font-mono"
            style={{
              ...btn,
              border: 'none',
              borderRadius: 0,
              color: viewMode === m ? 'var(--mode-sales)' : 'var(--text-tertiary)',
              background: viewMode === m ? 'color-mix(in srgb, var(--mode-sales) 12%, var(--glass-2))' : 'var(--glass-2)',
            }}
          >
            {m === 'cards' ? 'Karten' : 'Tabelle'}
          </button>
        ))}
      </div>
    </div>
  )
}
