import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { BusinessModelDoc, ICP, Positioning, WordBankEntry } from '../types/db'
import type { FoundationAIContext } from './foundationAi'

interface BrandFoundationContextValue {
  brandName: string
  context: FoundationAIContext
}

const Ctx = createContext<BrandFoundationContextValue | null>(null)

interface BrandFoundationProviderProps {
  brandName: string
  positioning: Positioning | null
  icps: ICP[]
  wordBank: WordBankEntry[]
  businessModel: BusinessModelDoc | null
  children: ReactNode
}

export function BrandFoundationProvider({
  brandName,
  positioning,
  icps,
  wordBank,
  businessModel,
  children,
}: BrandFoundationProviderProps) {
  const value = useMemo<BrandFoundationContextValue>(() => {
    const yes: string[] = []
    const no: string[] = []
    for (const w of wordBank) {
      if (w.type === 'yes') yes.push(w.word)
      else if (w.type === 'no') no.push(w.word)
    }
    const ctx: FoundationAIContext = {
      positioning_statement: positioning?.statement ?? '',
      tone_of_voice: positioning?.tone_of_voice ?? '',
      business_model: businessModel
        ? {
            who: businessModel.who,
            what: businessModel.what,
            how: businessModel.how,
            for_whom: businessModel.for_whom,
            revenue: businessModel.revenue,
          }
        : undefined,
      icps: icps.map((i) => ({
        name: i.name,
        pain_points: i.pain_points,
        location: i.location,
        priority: i.priority,
      })),
      word_bank: { yes, no },
    }
    return { brandName, context: ctx }
  }, [brandName, positioning, icps, wordBank, businessModel])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useBrandFoundationContext(): BrandFoundationContextValue | null {
  return useContext(Ctx)
}
