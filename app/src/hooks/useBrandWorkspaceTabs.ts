import { useWorkspaceTabs, EMPTY_WORKSPACE_TABS, type WorkspaceTab } from '../store/workspaceTabs'

export { EMPTY_WORKSPACE_TABS }
export type { WorkspaceTab }

export function useBrandWorkspaceTabs(slug: string) {
  const tabs = useWorkspaceTabs((s) => s.tabsByBrand[slug] ?? EMPTY_WORKSPACE_TABS)
  const activeId = useWorkspaceTabs((s) => s.activeByBrand[slug] ?? null)
  return { tabs, activeId }
}

/** Store-Actions sind stabile Referenzen — einzeln selektieren, kein Objekt-Literal. */
export function useWorkspaceTabActions() {
  const openTab = useWorkspaceTabs((s) => s.openTab)
  const openMany = useWorkspaceTabs((s) => s.openMany)
  const setActive = useWorkspaceTabs((s) => s.setActive)
  const closeTab = useWorkspaceTabs((s) => s.closeTab)
  const updateTabTitle = useWorkspaceTabs((s) => s.updateTabTitle)
  const updateActivePath = useWorkspaceTabs((s) => s.updateActivePath)
  const syncFromPath = useWorkspaceTabs((s) => s.syncFromPath)
  const clearBrand = useWorkspaceTabs((s) => s.clearBrand)
  return {
    openTab,
    openMany,
    setActive,
    closeTab,
    updateTabTitle,
    updateActivePath,
    syncFromPath,
    clearBrand,
  }
}

/** @deprecated use useWorkspaceTabActions */
export const useBrandWorkspaceTabActions = useWorkspaceTabActions
