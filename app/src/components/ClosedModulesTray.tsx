import { useModuleManager, type ClosedModuleSnapshot } from '../store/moduleManager'

function trayLabel(s: ClosedModuleSnapshot): string {
  if (s.title) return s.title
  switch (s.type) {
    case 'tasks':
      return 'Tasks'
    case 'quick-stats':
      return 'Stats'
    case 'promo-pieces':
      return 'Pieces'
    case 'promo-campaigns':
      return 'Kampagnen'
    case 'promo-calendar':
    case 'promo-main':
      return 'Promo'
    case 'deliver-project':
      return 'Projekt'
    case 'deliver-workspace':
      return 'Deliver'
    case 'sales-lists':
      return 'Listen'
    case 'sales-list-detail':
      return 'Liste'
    case 'intelligence-pipeline-forecast':
      return 'Reports'
    case 'intelligence-win-loss':
      return 'Focus'
    default:
      return s.type
  }
}

export function ClosedModulesTray() {
  const tray = useModuleManager((s) => s.closedTray)
  const reopenFromTray = useModuleManager((s) => s.reopenFromTray)
  const dismissTrayEntry = useModuleManager((s) => s.dismissTrayEntry)

  if (!tray.length) return null

  return (
    <div
      className="mb-2"
      style={{
        paddingTop: 8,
        borderTop: '1px solid var(--glass-border-1)',
      }}
    >
      <div
        className="font-mono mb-1.5"
        style={{
          fontSize: 8,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}
      >
        Geschlossen
      </div>
      <div className="flex flex-wrap gap-1">
        {tray.map((snap) => (
          <div
            key={`${snap.slot}-${snap.id}`}
            className="flex items-center gap-0.5 rounded-md"
            style={{
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-1)',
              maxWidth: '100%',
            }}
          >
            <button
              type="button"
              title={`${trayLabel(snap)} wieder öffnen`}
              data-no-scale
              className="font-mono min-w-0 truncate px-1.5 py-1 text-left"
              style={{
                fontSize: 9,
                color: 'var(--text-secondary)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                flex: 1,
              }}
              onClick={() => reopenFromTray(snap)}
            >
              {snap.slot === 'main'
                ? '◆'
                : snap.slot === 'side-top'
                  ? '▴'
                  : '▾'}{' '}
              {trayLabel(snap)}
            </button>
            <button
              type="button"
              title="Aus Liste entfernen"
              data-no-scale
              className="font-mono shrink-0 px-1 py-0.5"
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => dismissTrayEntry(snap.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
