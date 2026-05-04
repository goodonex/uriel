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

/* --- Discovery Mode (Phase 3) --- */

export type DiscoveryFeedCategory =
  | 'competitor'
  | 'format'
  | 'trend'
  | 'icp_search'

export interface DiscoveryIcpDraft {
  name: string
  age_range: string
  location: string
  pain_hint: string
}

export interface DiscoveryWordSuggestion {
  word: string
  type: WordBankType
  cluster: string
}

export interface DiscoveryAnalysis {
  icp_drafts: DiscoveryIcpDraft[]
  word_bank_suggestions: DiscoveryWordSuggestion[]
  positioning_ideas: string[]
}

export interface DiscoveryFoundationDoc {
  id: string
  brand_id: string
  market: string
  competitors: string
  niche: string
  analysis: DiscoveryAnalysis | null
  analysis_run_at: string | null
  updated_at: string
}

export interface DiscoveryFeedItem {
  id: string
  brand_id: string
  category: DiscoveryFeedCategory
  title: string
  summary: string
  signal_strength: 'low' | 'medium' | 'high'
  recorded_at: string
}

export type DiscoveryFeedIntervalDays = 1 | 7 | 14

export interface DiscoverySettingsDoc {
  feed_interval_days: DiscoveryFeedIntervalDays
  last_feed_generated_at: string | null
  updated_at: string
}

/* --- Promo Mode (Phase 4) --- */

export type ContentFormat =
  | 'post'
  | 'reel'
  | 'story'
  | 'article'
  | 'email'
  | 'carousel'
  | 'other'

export type ContentChannel =
  | 'instagram'
  | 'linkedin'
  | 'website'
  | 'email'
  | 'tiktok'
  | 'other'

export type ContentGoal =
  | 'awareness'
  | 'leads'
  | 'nurture'
  | 'sales'
  | 'other'

export interface ContentPieceTags {
  icp_ids: string[]
  cluster_tags: string[]
  format: ContentFormat
  channel: ContentChannel
  goal: ContentGoal
}

export interface ContentPerformanceManual {
  impressions: number | null
  engagements: number | null
  leads: number | null
  notes: string
  updated_at: string | null
}

/** Platzhalter für Instagram / LinkedIn APIs — später echte Keys & Sync. */
export interface ContentPerformanceApiStub {
  instagram_last_sync_at: string | null
  linkedin_last_sync_at: string | null
  instagram_metrics_json: Record<string, unknown> | null
  linkedin_metrics_json: Record<string, unknown> | null
}

export interface ContentPiece {
  id: string
  brand_id: string
  title: string
  content: Record<string, unknown>
  /** Kalender-Datum (YYYY-MM-DD oder ISO mit Zeit) */
  scheduled_at: string
  published_at: string | null
  campaign_id: string | null
  tags: ContentPieceTags
  performance_manual: ContentPerformanceManual
  performance_api: ContentPerformanceApiStub
  updated_at: string
}

export interface Campaign {
  id: string
  brand_id: string
  name: string
  goal: string
  start_at: string
  end_at: string | null
  content_piece_ids: string[]
  updated_at: string
}

/* --- Sales CRM (Phase 5) --- */

export type PipelineStage =
  | 'first_contact'
  | 'conversation'
  | 'proposal'
  | 'deal'
  | 'paused'

export interface Contact {
  id: string
  brand_id: string
  name: string
  email: string
  source_content_piece_id: string | null
  source_campaign_id: string | null
  pipeline_stage: PipelineStage
  last_contact_at: string | null
  next_follow_up_at: string | null
  notes: string
  updated_at: string
}

/* --- Intelligence / Focus (Phase 6) --- */

export type FocusTaskImpact = 'high' | 'medium' | 'low'

export type FocusTaskSource =
  | 'promo'
  | 'sales'
  | 'discovery'
  | 'building'
  | 'intelligence'

export interface FocusTask {
  id: string
  brand_id: string
  title: string
  detail: string
  impact: FocusTaskImpact
  source: FocusTaskSource
  related_ids: string[]
  created_at: string
}
