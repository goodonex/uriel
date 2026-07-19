import { create } from 'zustand'
import type { ViewMode } from '../cockpit/graph/nebulaLayout'

/**
 * Uriel-Command-Bus: entkoppelt den Uriel-Assistenten von Komponenten, deren
 * State lokal ist (v.a. der Nebula-Graph in OsNebula.tsx). Uriel legt eine
 * „Anfrage" ab; OsNebula abonniert sie und wendet sie auf seinen lokalen
 * set()/setQuery() an. Der nonce erzwingt, dass auch dieselbe Ansicht erneut
 * geschaltet werden kann (neue Objekt-Identität → useEffect feuert).
 */
export interface GraphRequest {
  view?: ViewMode
  query?: string
  nonce: number
}

interface UrielBusState {
  graphRequest: GraphRequest | null
  requestGraph: (r: { view?: ViewMode; query?: string }) => void
}

let nonce = 0

export const useUrielBus = create<UrielBusState>((set) => ({
  graphRequest: null,
  requestGraph: (r) => set({ graphRequest: { ...r, nonce: ++nonce } }),
}))
