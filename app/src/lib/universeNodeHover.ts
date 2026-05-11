import { create } from 'zustand'

let leaveTimer: ReturnType<typeof setTimeout> | null = null

/** Sync zwischen 3D-Node-Hover und Universe HUD-Cards (DOM), damit Karten nicht flackern. */
export const useUniverseNodeHover = create<{
  hoveredBrandSlug: string | null
  nodeEnter: (slug: string) => void
  nodeLeave: () => void
  hudEnter: (slug: string) => void
  hudLeave: () => void
}>((set) => ({
  hoveredBrandSlug: null,
  nodeEnter: (slug) => {
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    set({ hoveredBrandSlug: slug })
  },
  nodeLeave: () => {
    if (leaveTimer) clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => {
      set({ hoveredBrandSlug: null })
      leaveTimer = null
    }, 220)
  },
  hudEnter: (slug) => {
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    set({ hoveredBrandSlug: slug })
  },
  hudLeave: () => {
    if (leaveTimer) clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => {
      set({ hoveredBrandSlug: null })
      leaveTimer = null
    }, 220)
  },
}))
