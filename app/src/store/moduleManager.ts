import { create } from 'zustand'
import type { ModuleSlot } from '../modules/slots'
import { OVERLAY_SLOTS, SINGLETON_SLOTS } from '../modules/slots'

export type ModuleId = string

export interface OpenModule {
  id: ModuleId
  type: string
  slot: ModuleSlot
  data?: unknown
  /** Optional: Header-Titel im ModuleContainer */
  title?: string
  focusedAt: number
}

/** Snapshot zum Wiederherstellen geschlossener Side-Module (ohne focusedAt). */
export interface ClosedModuleSnapshot {
  id: ModuleId
  type: string
  slot: ModuleSlot
  title?: string
  data?: unknown
}

function isOverlaySlot(slot: ModuleSlot): boolean {
  return OVERLAY_SLOTS.includes(slot)
}

function nextFocusTime(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function isSideSlot(slot: ModuleSlot): boolean {
  return slot === 'side-top' || slot === 'side-bottom'
}

export interface ModuleManagerState {
  modules: OpenModule[]
  /** Zuletzt per Schließen entfernte Side-Module (max. 6), für Restore-Leiste */
  closedTray: ClosedModuleSnapshot[]
  open: (module: Omit<OpenModule, 'focusedAt'>) => void
  close: (id: ModuleId) => void
  focus: (id: ModuleId) => void
  closeAll: () => void
  closeAllExcept: (ids: ModuleId[]) => void
  reopenFromTray: (snapshot: ClosedModuleSnapshot) => void
  dismissTrayEntry: (id: ModuleId) => void
}

export const useModuleManager = create<ModuleManagerState>((set, get) => ({
  modules: [],
  closedTray: [],

  open: (mod) => {
    const focusedAt = nextFocusTime()
    set((state) => {
      let next = [...state.modules]
      let tray = state.closedTray

      if (isOverlaySlot(mod.slot)) {
        const existingIdx = next.findIndex((m) => m.id === mod.id)
        if (existingIdx >= 0) {
          next[existingIdx] = { ...mod, focusedAt }
          return { modules: next, closedTray: tray }
        }
        next.push({ ...mod, focusedAt })
        return { modules: next, closedTray: tray }
      }

      if (SINGLETON_SLOTS.includes(mod.slot)) {
        next = next.filter((m) => m.slot !== mod.slot || m.id === mod.id)
        const idx = next.findIndex((m) => m.id === mod.id)
        if (idx >= 0) {
          next[idx] = { ...mod, focusedAt }
        } else {
          next.push({ ...mod, focusedAt })
        }
        tray = tray.filter((t) => !(t.slot === mod.slot && t.id === mod.id))
        return { modules: next, closedTray: tray }
      }

      next.push({ ...mod, focusedAt })
      return { modules: next, closedTray: tray }
    })
  },

  close: (id) => {
    set((state) => {
      const found = state.modules.find((m) => m.id === id)
      let tray = state.closedTray
      if (found && isSideSlot(found.slot)) {
        const snap: ClosedModuleSnapshot = {
          id: found.id,
          type: found.type,
          slot: found.slot,
          title: found.title,
          data: found.data,
        }
        tray = [
          snap,
          ...tray.filter((t) => !(t.slot === snap.slot && t.id === snap.id)),
        ].slice(0, 6)
      }
      return {
        modules: state.modules.filter((m) => m.id !== id),
        closedTray: tray,
      }
    })
  },

  focus: (id) => {
    const t = nextFocusTime()
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, focusedAt: t } : m,
      ),
    }))
  },

  closeAll: () => set({ modules: [], closedTray: [] }),

  closeAllExcept: (ids) => {
    const keep = new Set(ids)
    set((state) => ({
      modules: state.modules.filter((m) => keep.has(m.id)),
    }))
  },

  reopenFromTray: (snapshot) => {
    const { open, dismissTrayEntry } = get()
    dismissTrayEntry(snapshot.id)
    open({
      id: snapshot.id,
      type: snapshot.type,
      slot: snapshot.slot,
      title: snapshot.title,
      data: snapshot.data,
    })
  },

  dismissTrayEntry: (id) => {
    set((state) => ({
      closedTray: state.closedTray.filter((t) => t.id !== id),
    }))
  },
}))

export function overlayStackIndex(
  modules: OpenModule[],
  slot: ModuleSlot,
  id: ModuleId,
): number {
  if (!isOverlaySlot(slot)) return 0
  const same = modules.filter((m) => m.slot === slot).sort((a, b) => a.focusedAt - b.focusedAt)
  const idx = same.findIndex((m) => m.id === id)
  return Math.max(0, idx)
}
