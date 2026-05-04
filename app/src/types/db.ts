export type ModeKey =
  | 'building'
  | 'promo'
  | 'sales'
  | 'intelligence'
  | 'discovery'

export type AssetType = 'website' | 'instagram' | 'linkedin' | 'document'

export interface Asset {
  id: string
  brand_id: string
  name: string
  type: AssetType
  url: string
  embed: boolean
  updated_at: string
}

export interface SOP {
  id: string
  brand_id: string
  title: string
  content: Record<string, unknown>
  category: string
  updated_at: string
}

/** Standalone Business Model doc (localStorage key …:businessmodel). */
export interface BusinessModelDoc {
  id: string
  brand_id: string
  who: string
  what: string
  how: string
  for_whom: string
  revenue: string
  updated_at: string
}

export interface Brand {
  id: string
  user_id: string | null
  name: string
  slug: string
  color: string
  created_at: string
}

export type ICPPriority = 1 | 2 | 3

export interface ICP {
  id: string
  brand_id: string
  name: string
  age_range: string
  location: string
  pain_points: string[]
  word_clusters: string[]
  priority: ICPPriority
  notes: string
  updated_at: string
}

export type WordBankType = 'yes' | 'no'

export interface WordBankEntry {
  id: string
  brand_id: string
  word: string
  type: WordBankType
  cluster: string
  updated_at: string
}

export interface BusinessModel {
  who: string
  what: string
  how: string
  for_whom: string
  revenue: string
}

export interface Positioning {
  id: string
  brand_id: string
  statement: string
  tone_of_voice: string
  business_model: BusinessModel | null
  updated_at: string
}
