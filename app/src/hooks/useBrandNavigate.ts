import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceTabs } from '../store/workspaceTabs'
export function useBrandNavigate(slug: string) {
  const navigate = useNavigate()

  /** Normal navigation — no new tabs. Activates existing tab if path matches. */
  const go = useCallback(
    (path: string) => {
      if (!slug || !path.startsWith(`/brand/${slug}`)) {
        navigate(path)
        return
      }
      const { setActive, getTabs } = useWorkspaceTabs.getState()
      const existing = getTabs(slug).find((t) => t.path === path)
      if (existing) setActive(slug, existing.id)
      navigate(path)
    },
    [navigate, slug],
  )

  /** Explicit new-tab open — default: background (kein Navigieren). */
  const openNewTab = useCallback(
    (path: string, title?: string, opts?: { activate?: boolean }) => {
      if (!slug) return
      const activate = opts?.activate ?? false
      useWorkspaceTabs.getState().openTab(slug, path, { title, activate })
      if (activate) navigate(path)
    },
    [navigate, slug],
  )

  return { go, openNewTab, navigate }
}

export function useOpenInNewTabHandler(slug: string, path: string, title?: string) {
  const { openNewTab } = useBrandNavigate(slug)
  return useCallback(() => openNewTab(path, title), [openNewTab, path, title])
}
