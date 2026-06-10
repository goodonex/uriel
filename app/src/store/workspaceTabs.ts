import { create } from 'zustand'
import { defaultTabTitle, tabIdFromPath } from '../lib/workspaceTabs'

export interface WorkspaceTab {
  id: string
  path: string
  title: string
}

/** Stabile leere Referenz — verhindert Zustand getSnapshot-Loops. */
export const EMPTY_WORKSPACE_TABS: readonly WorkspaceTab[] = []

const MAX_TABS_PER_BRAND = 32

interface WorkspaceTabsState {
  tabsByBrand: Record<string, WorkspaceTab[]>
  activeByBrand: Record<string, string>
  getTabs: (slug: string) => WorkspaceTab[]
  getActiveId: (slug: string) => string | null
  getActiveTab: (slug: string) => WorkspaceTab | null
  openTab: (
    slug: string,
    path: string,
    opts?: { title?: string; activate?: boolean; replaceActive?: boolean },
  ) => WorkspaceTab
  openMany: (
    slug: string,
    paths: string[],
    opts?: { activateIndex?: number; titles?: string[] },
  ) => { opened: number; blocked: number }
  setActive: (slug: string, tabId: string) => void
  closeTab: (slug: string, tabId: string) => WorkspaceTab | null
  updateTabTitle: (slug: string, tabId: string, title: string) => void
  updateActivePath: (slug: string, path: string, title?: string) => void
  syncFromPath: (slug: string, path: string, title?: string) => void
  clearBrand: (slug: string) => void
}

function trimTabs(tabs: WorkspaceTab[]): WorkspaceTab[] {
  return tabs.slice(-MAX_TABS_PER_BRAND)
}

export const useWorkspaceTabs = create<WorkspaceTabsState>((set, get) => ({
  tabsByBrand: {},
  activeByBrand: {},

  getTabs: (slug) => get().tabsByBrand[slug] ?? EMPTY_WORKSPACE_TABS,

  getActiveId: (slug) => get().activeByBrand[slug] ?? null,

  getActiveTab: (slug) => {
    const id = get().activeByBrand[slug]
    if (!id) return null
    return (get().tabsByBrand[slug] ?? EMPTY_WORKSPACE_TABS).find((t) => t.id === id) ?? null
  },

  openTab: (slug, path, opts = {}) => {
    const id = tabIdFromPath(path)
    const title = opts.title ?? defaultTabTitle(path)
    const activate = opts.activate !== false
    const replaceActive = opts.replaceActive === true

    let created: WorkspaceTab = { id, path, title }
    set((state) => {
      const prev = state.tabsByBrand[slug] ?? []
      const activeId = state.activeByBrand[slug]
      const existingIdx = prev.findIndex((t) => t.id === id)

      if (existingIdx >= 0) {
        const next = [...prev]
        next[existingIdx] = { ...next[existingIdx], path, title }
        created = next[existingIdx]
        return {
          tabsByBrand: { ...state.tabsByBrand, [slug]: next },
          activeByBrand: activate
            ? { ...state.activeByBrand, [slug]: id }
            : state.activeByBrand,
        }
      }

      let next = [...prev]
      if (replaceActive && activeId) {
        const activeIdx = next.findIndex((t) => t.id === activeId)
        if (activeIdx >= 0) {
          next[activeIdx] = created
          return {
            tabsByBrand: { ...state.tabsByBrand, [slug]: next },
            activeByBrand: { ...state.activeByBrand, [slug]: id },
          }
        }
      }

      next = trimTabs([...next, created])
      return {
        tabsByBrand: { ...state.tabsByBrand, [slug]: next },
        activeByBrand: activate
          ? { ...state.activeByBrand, [slug]: id }
          : state.activeByBrand,
      }
    })
    return created
  },

  openMany: (slug, paths, opts = {}) => {
    let opened = 0
    let blocked = 0
    const activateIndex = opts.activateIndex ?? 0
    paths.forEach((path, i) => {
      const before = get().tabsByBrand[slug]?.length ?? 0
      get().openTab(slug, path, {
        title: opts.titles?.[i],
        activate: i === activateIndex,
      })
      const after = get().tabsByBrand[slug]?.length ?? 0
      if (after > before || get().tabsByBrand[slug]?.some((t) => t.path === path)) {
        opened += 1
      } else {
        blocked += 1
      }
    })
    return { opened, blocked }
  },

  setActive: (slug, tabId) => {
    set((state) => {
      const tabs = state.tabsByBrand[slug] ?? []
      if (!tabs.some((t) => t.id === tabId)) return state
      return { activeByBrand: { ...state.activeByBrand, [slug]: tabId } }
    })
  },

  closeTab: (slug, tabId) => {
    let fallback: WorkspaceTab | null = null
    set((state) => {
      const prev = state.tabsByBrand[slug] ?? []
      const idx = prev.findIndex((t) => t.id === tabId)
      if (idx < 0) return state
      const next = prev.filter((t) => t.id !== tabId)
      const wasActive = state.activeByBrand[slug] === tabId
      let nextActive = state.activeByBrand[slug]
      if (wasActive) {
        const neighbor = next[idx] ?? next[idx - 1] ?? null
        nextActive = neighbor?.id
        fallback = neighbor
      }
      const activeByBrand = { ...state.activeByBrand }
      if (nextActive) activeByBrand[slug] = nextActive
      else delete activeByBrand[slug]
      return {
        tabsByBrand: { ...state.tabsByBrand, [slug]: next },
        activeByBrand,
      }
    })
    return fallback
  },

  updateTabTitle: (slug, tabId, title) => {
    set((state) => {
      const prev = state.tabsByBrand[slug] ?? EMPTY_WORKSPACE_TABS
      const existing = prev.find((t) => t.id === tabId)
      if (!existing || existing.title === title) return state
      const next = prev.map((t) => (t.id === tabId ? { ...t, title } : t))
      return { tabsByBrand: { ...state.tabsByBrand, [slug]: next } }
    })
  },

  updateActivePath: (slug, path, title) => {
    const id = tabIdFromPath(path)
    set((state) => {
      const prev = state.tabsByBrand[slug] ?? []
      const activeId = state.activeByBrand[slug]
      if (!activeId) {
        const tab: WorkspaceTab = { id, path, title: title ?? defaultTabTitle(path) }
        return {
          tabsByBrand: { ...state.tabsByBrand, [slug]: trimTabs([...prev, tab]) },
          activeByBrand: { ...state.activeByBrand, [slug]: id },
        }
      }
      const next = prev.map((t) =>
        t.id === activeId
          ? { ...t, id, path, title: title ?? t.title }
          : t,
      )
      const activeByBrand = { ...state.activeByBrand, [slug]: id }
      return { tabsByBrand: { ...state.tabsByBrand, [slug]: next }, activeByBrand }
    })
  },

  syncFromPath: (slug, path, title) => {
    if (!path.startsWith(`/brand/${slug}`)) return
    const id = tabIdFromPath(path)
    set((state) => {
      const prev = state.tabsByBrand[slug] ?? EMPTY_WORKSPACE_TABS
      const existing = prev.find((t) => t.id === id)
      const nextTitle = title ?? existing?.title ?? defaultTabTitle(path)

      if (existing) {
        const unchanged =
          state.activeByBrand[slug] === id &&
          existing.path === path &&
          existing.title === nextTitle
        if (unchanged) return state

        return {
          activeByBrand: { ...state.activeByBrand, [slug]: id },
          tabsByBrand: {
            ...state.tabsByBrand,
            [slug]: prev.map((t) =>
              t.id === id ? { ...t, title: nextTitle, path } : t,
            ),
          },
        }
      }

      const tab: WorkspaceTab = {
        id,
        path,
        title: nextTitle,
      }
      return {
        tabsByBrand: { ...state.tabsByBrand, [slug]: trimTabs([...prev, tab]) },
        activeByBrand: { ...state.activeByBrand, [slug]: id },
      }
    })
  },

  clearBrand: (slug) => {
    set((state) => {
      const tabsByBrand = { ...state.tabsByBrand }
      const activeByBrand = { ...state.activeByBrand }
      delete tabsByBrand[slug]
      delete activeByBrand[slug]
      return { tabsByBrand, activeByBrand }
    })
  },
}))
