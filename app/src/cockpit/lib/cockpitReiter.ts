/** Die Reiter im Cockpit (25.09.2026) — `?heute=` in der Adresse. */
export type CockpitReiterId = 'aufgaben' | 'termine' | 'freigaben' | 'agenten'

export function istReiter(x: string | null): x is CockpitReiterId {
  return x === 'aufgaben' || x === 'termine' || x === 'freigaben' || x === 'agenten'
}
