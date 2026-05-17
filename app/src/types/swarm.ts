export type SwarmMode = 'content' | 'funnel'

export type SwarmEngagementLevel = 'low' | 'medium' | 'high'

export interface SwarmIcpReaction {
  icpName: string
  firstReaction: string
  whatResonates: string
  whatBounces: string
  mainObjection: string
  wouldAct: boolean
}

export interface SwarmPredictionResult {
  qualitative: {
    perIcp: SwarmIcpReaction[]
    summary: string
    biggestRisk: string
    strongestElement: string
  }
  quantitative: {
    expectedEngagementRate: SwarmEngagementLevel
    expectedConversionBand: string
    confidenceNote: string
  }
}

export interface SwarmActualOutcome {
  cpgl?: number | null
  goodLeads?: number
  totalLeads?: number
  goodLeadRate?: number | null
  funnelValue?: number
  conversionVsBand?: 'above' | 'below' | 'within' | 'unknown'
  note?: string
}
