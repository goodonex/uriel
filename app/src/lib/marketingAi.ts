/**
 * Client-Wrapper für die `marketing-ai` Edge Function.
 * Liefert 3 Varianten pro Anfrage — sowohl für Recruiting als auch für Ads.
 */
import { supabase } from './supabase'

export type MarketingKind = 'recruiting' | 'ad'
export type RecruitingField = 'description' | 'requirements' | 'benefits' | 'full'
export type AdField = 'hook' | 'body' | 'cta' | 'full'
export type MarketingPlatform =
  | 'linkedin_organic'
  | 'linkedin_ad'
  | 'culturefit'
  | 'meta'
  | 'google'
  | 'other'

export interface MarketingAiContext {
  positioning_statement?: string
  tone_of_voice?: string
  business_model?: {
    who?: string
    what?: string
    how?: string
    for_whom?: string
    revenue?: string
  }
  icps?: Array<{ name?: string; pain_points?: string[]; location?: string }>
  word_bank?: { yes?: string[]; no?: string[] }
}

/** Bereits ausgefüllte Ad-Felder — KI soll darauf abstimmen (bidirektional). */
export interface AdCopySiblings {
  hook?: string
  body?: string
  cta?: string
}

export interface MarketingAiInput {
  kind: MarketingKind
  field: RecruitingField | AdField
  brand_id?: string
  brand_name?: string
  platform?: MarketingPlatform
  title?: string
  current_value?: string
  /** Nur bei kind=ad: andere Felder der gleichen Anzeige */
  ad_copy?: AdCopySiblings
  context?: MarketingAiContext
}

export interface MarketingAiResult {
  variants?: string[]
  error?: string
  detail?: string
}

export async function generateMarketingText(input: MarketingAiInput): Promise<MarketingAiResult> {
  if (!supabase) return { error: 'supabase_not_configured' }
  const { data, error } = await supabase.functions.invoke<MarketingAiResult>('marketing-ai', {
    body: input,
  })
  if (error) return { error: 'invoke_failed', detail: error.message }
  return data ?? { error: 'empty_response' }
}
