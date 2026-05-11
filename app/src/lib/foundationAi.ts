import { supabase } from './supabase'

export type FoundationField =
  | 'positioning_statement'
  | 'tone_of_voice'
  | 'business_model_who'
  | 'business_model_what'
  | 'business_model_how'
  | 'business_model_for_whom'
  | 'business_model_revenue'
  | 'icp_notes'

export interface FoundationAIContext {
  positioning_statement?: string
  tone_of_voice?: string
  business_model?: {
    who?: string
    what?: string
    how?: string
    for_whom?: string
    revenue?: string
  }
  icps?: Array<{
    name?: string
    pain_points?: string[]
    location?: string
    priority?: number
  }>
  word_bank?: { yes?: string[]; no?: string[] }
}

export interface FoundationAIRequest {
  field: FoundationField
  current_value?: string
  brand_name?: string
  context?: FoundationAIContext
}

export interface FoundationAIResponse {
  variants: string[]
}

export async function requestFoundationSuggestion(
  req: FoundationAIRequest,
): Promise<FoundationAIResponse> {
  if (!supabase) throw new Error('Supabase nicht initialisiert')
  const { data, error } = await supabase.functions.invoke<FoundationAIResponse>(
    'foundation-ai',
    { body: req },
  )
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Leere Antwort von foundation-ai')
  if (!Array.isArray(data.variants) || data.variants.length === 0) {
    throw new Error('Keine Vorschläge erhalten')
  }
  return data
}
