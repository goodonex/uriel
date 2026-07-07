export interface RunDoc {
  id: string
  agent: string
  title: string
  date: string
  active?: boolean
}

export function DocumentsPanel({ runs, onOpen }: { runs: RunDoc[]; onOpen?: (run: RunDoc) => void }) {
  return (
    <section className="ck-panel" aria-label="Letzte Agent-Dokumente">
      <div className="ck-label" style={{ padding: '10px 12px 4px' }}>
        Documents · Runs
      </div>
      {runs.length === 0 ? (
        <p style={{ padding: '10px 12px', color: 'var(--ck-text-3)', fontSize: 12 }}>Noch keine Runs.</p>
      ) : (
        runs.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpen?.(r)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--ck-border)',
              color: 'var(--ck-text-1)',
              fontFamily: 'var(--ck-font)',
              fontSize: 12,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className={r.active ? 'ck-dot ck-dot--pulse' : 'ck-dot ck-dot--on'} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
            </span>
            <span className="ck-label" style={{ flexShrink: 0 }}>{r.date}</span>
          </button>
        ))
      )}
    </section>
  )
}
