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
  onToggleFilter,
  filterActive,
}: {
  onNewLead: () => void
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
    </div>
  )
}
