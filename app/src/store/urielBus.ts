import { create } from 'zustand'
import type { ViewMode } from '../cockpit/graph/nebulaLayout'

/**
 * Uriel-Command-Bus: entkoppelt den Uriel-Assistenten von Komponenten, deren
 * State lokal ist (v.a. der Nebula-Graph in OsNebula.tsx) und trägt den
 * geteilten Uriel-Modus-Zustand (offen? Phase?), damit Wortmarke, Dock und die
 * pulsierende Aura synchron reagieren — der sichtbare „Jarvis wacht auf"-Effekt.
 */
export interface GraphRequest {
  view?: ViewMode
  query?: string
  nonce: number
}

/** Was Uriel gerade tut — steuert die Intensität der Aura. */
export type UrielPhase = 'idle' | 'listening' | 'working'

interface UrielBusState {
  // Graph-Fernsteuerung
  graphRequest: GraphRequest | null
  requestGraph: (r: { view?: ViewMode; query?: string }) => void
  // Uriel-Modus (geteilt zwischen Wortmarke, Dock, Aura)
  open: boolean
  phase: UrielPhase
  setOpen: (open: boolean) => void
  toggleOpen: () => void
  setPhase: (phase: UrielPhase) => void
}

let nonce = 0

export const useUrielBus = create<UrielBusState>((set) => ({
  graphRequest: null,
  requestGraph: (r) => set({ graphRequest: { ...r, nonce: ++nonce } }),
  open: false,
  phase: 'idle',
  setOpen: (open) => set({ open, ...(open ? {} : { phase: 'idle' as UrielPhase }) }),
  toggleOpen: () => set((s) => ({ open: !s.open, ...(s.open ? { phase: 'idle' as UrielPhase } : {}) })),
  setPhase: (phase) => set({ phase }),
}))
