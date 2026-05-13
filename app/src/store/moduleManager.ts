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

function isOverlaySlot(slot: ModuleSlot): boolean {
  return OVERLAY_SLOTS.includes(slot)
}

function nextFocusTime(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export interface ModuleManagerState {
  modules: OpenModule[]
  open: (module: Omit<OpenModule, 'focusedAt'>) => void
  close: (id: ModuleId) => void
  focus: (id: ModuleId) => void
  closeAll: () => void
  closeAllExcept: (ids: ModuleId[]) => void
}

export const useModuleManager = create<ModuleManagerState>((set) => ({
  modules: [],

  open: (mod) => {
    const focusedAt = nextFocusTime()
    set((state) => {
      let next = [...state.modules]

      if (isOverlaySlot(mod.slot)) {
        const existingIdx = next.findIndex((m) => m.id === mod.id)
        if (existingIdx >= 0) {
          next[existingIdx] = { ...mod, focusedAt }
          return { modules: next }
        }
        next.push({ ...mod, focusedAt })
        return { modules: next }
      }

      if (SINGLETON_SLOTS.includes(mod.slot)) {
        next = next.filter((m) => m.slot !== mod.slot || m.id === mod.id)
        const idx = next.findIndex((m) => m.id === mod.id)
        if (idx >= 0) {
          next[idx] = { ...mod, focusedAt }
        } else {
          next.push({ ...mod, focusedAt })
        }
        return { modules: next }
      }

      next.push({ ...mod, focusedAt })
      return { modules: next }
    })
  },

  close: (id) => {
    set((state) => ({
      modules: state.modules.filter((m) => m.id !== id),
    }))
  },

  focus: (id) => {
    const t = nextFocusTime()
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, focusedAt: t } : m,
      ),
    }))
  },

  closeAll: () => set({ modules: [] }),

  closeAllExcept: (ids) => {
    const keep = new Set(ids)
    set((state) => ({
      modules: state.modules.filter((m) => keep.has(m.id)),
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
