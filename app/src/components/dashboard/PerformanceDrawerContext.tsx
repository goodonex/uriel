import { createContext, useContext } from 'react'

interface PerformanceDrawerContextValue {
  openGoals: () => void
  openReview: () => void
}

const PerformanceDrawerContext = createContext<PerformanceDrawerContextValue | null>(null)

export const PerformanceDrawerProvider = PerformanceDrawerContext.Provider

export function usePerformanceDrawers(): PerformanceDrawerContextValue | null {
  return useContext(PerformanceDrawerContext)
}
