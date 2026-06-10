import { useCallback, useMemo } from 'react'
import { useBrandWorkspaceTabs, useBrandWorkspaceTabActions } from '../../hooks/useBrandWorkspaceTabs'
import { useBrandNavigate } from '../../hooks/useBrandNavigate'
import { isEntityDetailPath, parseWorkspaceTabMeta } from '../../lib/workspaceTabs'

export const WORKSPACE_TAB_BAR_HEIGHT = 36

export function workspaceTabBarOffset(isMobile = false): number {
  return WORKSPACE_TAB_BAR_HEIGHT + (isMobile ? 58 : 0)
}

function tabAccent(path: string): string {
  const kind = parseWorkspaceTabMeta(path).kind
  switch (kind) {
    case 'contact':
    case 'sales-list':
      return 'var(--mode-sales)'
    case 'project':
      return 'var(--mode-deliver, var(--accent-teal))'
    case 'ad-campaign':
      return 'var(--mode-promo, var(--accent-blue))'
    default:
      return 'var(--text-tertiary)'
  }
}

export function WorkspaceTabBar({ slug }: { slug: string }) {
  const { tabs, activeId } = useBrandWorkspaceTabs(slug)
  const { closeTab } = useBrandWorkspaceTabActions()
  const { go, navigate } = useBrandNavigate(slug)

  const entityTabs = useMemo(
    () => tabs.filter((t) => isEntityDetailPath(t.path)),
    [tabs],
  )

  const onSelect = useCallback((path: string) => go(path), [go])

  const onClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation()
      const next = closeTab(slug, tabId)
      if (next) {
        navigate(next.path)
      } else {
        navigate(`/brand/${slug}/sales`)
      }
    },
    [closeTab, navigate, slug],
  )

  if (entityTabs.length === 0) return null

  return (
    <div
      className="font-mono"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minHeight: WORKSPACE_TAB_BAR_HEIGHT,
        marginBottom: 8,
        padding: '4px 0',
        overflowX: 'auto',
        overflowY: 'hidden',
        borderBottom: '1px solid var(--glass-border-1)',
        scrollbarWidth: 'thin',
      }}
    >
      {entityTabs.map((tab) => {
        const active = tab.id === activeId
        const accent = tabAccent(tab.path)
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.path)}
            title={tab.path}
            className="shrink-0"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              maxWidth: 196,
              height: 28,
              padding: '0 8px 0 10px',
              borderRadius: 8,
              border: `1px solid ${active ? `color-mix(in srgb, ${accent} 45%, var(--glass-border-2))` : 'var(--glass-border-2)'}`,
              background: active
                ? `color-mix(in srgb, ${accent} 14%, var(--glass-2))`
                : 'color-mix(in srgb, var(--glass-1) 90%, transparent)',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 10,
              letterSpacing: '0.04em',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: accent,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.title}
            </span>
            <span
              role="button"
              tabIndex={-1}
              aria-label={`${tab.title} schließen`}
              onClick={(e) => onClose(e, tab.id)}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 16,
                height: 16,
                borderRadius: 4,
                color: 'var(--text-tertiary)',
                flexShrink: 0,
              }}
            >
              ×
            </span>
          </button>
        )
      })}
    </div>
  )
}
