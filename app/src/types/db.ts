export type ModeKey =
  | 'building'
  | 'promo'
  | 'sales'
  | 'intelligence'
  | 'discovery'
  | 'deliver'

export type AssetType = 'website' | 'instagram' | 'linkedin' | 'document' | 'social'

export type SocialPlatform =
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'twitter'

export interface Asset {
  id: string
  brand_id: string
  name: string
  type: AssetType
  url: string
  embed: boolean
  notes: string
  social_platform?: SocialPlatform | null
  created_at: string
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

export type DiscoveryAnalysisStatus =
  | 'idle'
  | 'running'
  | 'complete'
  | 'error'

export interface DiscoveryContentFormatInsight {
  format_name: string
  rationale: string
}

export interface DiscoveryCompetitorInsightBrief {
  headline: string
  detail: string
}

export interface DiscoveryAnalysis {
  icp_drafts: DiscoveryIcpDraft[]
  word_bank_suggestions: DiscoveryWordSuggestion[]
  positioning_ideas: string[]
  /** Aus Claude-Analyse */
  content_formats?: DiscoveryContentFormatInsight[]
  competitor_insights?: DiscoveryCompetitorInsightBrief[]
  tone_of_voice?: string
  /** Gekürzte Perplexity-Auszüge (optional) */
  research_snippets?: string[]
}

export interface DiscoveryFoundationDoc {
  id: string
  brand_id: string
  market: string
  competitors: string
  niche: string
  analysis: DiscoveryAnalysis | null
  analysis_run_at: string | null
  analysis_status?: DiscoveryAnalysisStatus
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
  archived_at?: string | null
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

export interface ContactActivityEntry {
  id: string
  text: string
  /** ISO timestamp */
  at: string
}

export type PotenzialTyp = 'einmalig' | 'monatlich' | 'jährlich'

export interface Contact {
  id: string
  brand_id: string
  name: string
  email: string
  phone: string
  website: string
  instagram: string
  linkedin: string
  company: string
  source_content_piece_id: string | null
  source_campaign_id: string | null
  pipeline_stage: PipelineStage
  last_contact_at: string | null
  next_follow_up_at: string | null
  notes: string
  call_notes: string
  activity_log: ContactActivityEntry[]
  /** Erstgespräch */
  bedarf: string
  ansprechpartner: string
  aktuelle_situation: string
  hauptproblem: string
  timeline: string
  /** Qualifikation */
  budget: string
  ist_entscheider: boolean
  entscheider_name: string
  einwaende: string
  naechste_schritte: string
  abschluss_wahrscheinlichkeit: number
  /** Geschätzter Auftragswert EUR */
  potenzial_betrag: number
  potenzial_typ: PotenzialTyp
  potenzial_notiz: string
  /** Konfigurierbare Felder, key = Feld-id */
  custom_fields: Record<string, string | number | boolean>
  /** Sales-Pro */
  pipeline_id?: string | null
  tags?: string[]
  stage_changed_at?: string | null
  won_at?: string | null
  lost_at?: string | null
  lost_reason?: string
  updated_at: string
}

export type SalesFieldType = 'textarea' | 'text' | 'number' | 'toggle'

export interface SalesFieldItem {
  id: string
  label: string
  placeholder: string
  type: SalesFieldType
  required: boolean
  order: number
  /** contacts-Spalte oder Key in custom_fields */
  db_key: string
}

export interface SalesFieldConfigRow {
  id: string
  brand_id: string
  tab: 'erstgespraech' | 'qualifikation'
  fields: SalesFieldItem[]
  created_at: string
  updated_at: string
}

/** Promo: Ideen-Tabelle (Migration 0020) */
export type ContentIdeaFormat =
  | 'post'
  | 'reel'
  | 'story'
  | 'mail'
  | 'artikel'
  | 'karussell'
  | 'ad'

export type ContentIdeaStatus = 'idee' | 'skript' | 'produktion' | 'fertig'

export interface ContentIdea {
  id: string
  brand_id: string
  title: string
  hook: string
  a_roll: string
  b_roll: string
  skript: string
  format: string
  kanal: string
  status: string
  woche: number | null
  created_at: string
}

export interface ContentSequencePlanPiece {
  format: string
  titel: string
  kanal: string
}

export interface ContentSequencePlanWeek {
  woche: number
  thema: string
  pieces: ContentSequencePlanPiece[]
}

export interface ContentSequence {
  id: string
  brand_id: string
  name: string
  description: string
  wochen: number
  plan: ContentSequencePlanWeek[]
  status: string
  /** 'content' = Social/Kalender, 'email' = E-Mail-Sequenzen */
  sequence_kind: 'content' | 'email'
  created_at: string
}

export type ContactListItemStatus =
  | 'offen'
  | 'angerufen'
  | 'kein_interesse'
  | 'in_pipeline'

export interface ContactList {
  id: string
  brand_id: string
  name: string
  description: string | null
  created_at: string
}

export interface ContactListItem {
  id: string
  list_id: string
  name: string
  email: string
  phone: string
  company: string
  linkedin_url: string
  notes: string
  status: ContactListItemStatus
  called_at: string | null
  created_at: string
}

export type DeliverableStatus = 'geplant' | 'in_arbeit' | 'fertig'

export interface DeliverableItem {
  title: string
  status: DeliverableStatus
  updated_at: string
}

export type DeliverProjectStage =
  | 'onboarding'
  | 'discover'
  | 'inner_world'
  | 'visual_world'
  | 'execute'

export const DELIVER_STAGE_ORDER: DeliverProjectStage[] = [
  'onboarding',
  'discover',
  'inner_world',
  'visual_world',
  'execute',
]

export interface ClientDocumentLink {
  label: string
  url: string
  /** Optional — Kurzbeschreibung im Kundenportal */
  description?: string
}

export interface DeliverProject {
  id: string
  brand_id: string
  name: string
  client_name: string
  client_email: string
  client_contact_id: string | null
  status: 'active' | 'completed'
  internal_stage: DeliverProjectStage
  client_stage: DeliverProjectStage
  /** Tiptap JSON */
  internal_notes_doc: Record<string, unknown>
  internal_file_links: string[]
  team_notes: string
  client_welcome_text: string
  client_documents: ClientDocumentLink[]
  deliverables: DeliverableItem[]
  booking_url: string
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

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 1 | 2 | 3
export type TaskSource = 'manual' | 'follow_up' | 'system' | 'onboarding'

export interface Task {
  id: string
  brand_id: string
  contact_id: string | null
  project_id: string | null
  title: string
  notes: string
  due_at: string | null
  status: TaskStatus
  priority: TaskPriority
  source: TaskSource
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ===== Sales-Pro =====

export interface PipelineStageDef {
  key: string
  label: string
  accent?: string
  won?: boolean
  lost?: boolean
}

export interface SalesPipeline {
  id: string
  brand_id: string
  name: string
  slug: string
  stages: PipelineStageDef[]
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SalesEmailTemplate {
  id: string
  brand_id: string
  name: string
  subject: string
  body: string
  stage: string | null
  variables: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export type SalesEmailDirection = 'outbound' | 'inbound'

export interface SalesEmailLog {
  id: string
  brand_id: string
  contact_id: string
  template_id: string | null
  direction: SalesEmailDirection
  subject: string
  body_preview: string
  sent_at: string
  opened_at: string | null
  replied_at: string | null
  bounced_at: string | null
  tracking_id: string | null
  resend_id: string
  from_email: string
  from_name: string
  to_email: string
  sequence_id: string | null
  enrollment_id: string | null
  created_at: string
  updated_at: string
}

// =================================================================
// E-Mail-Sequenzen (Whiteboard-Builder + Auto-Send)
// =================================================================

export type SequenceNodeType = 'start' | 'wait' | 'email' | 'condition' | 'end'

export type SequenceConditionCheck =
  | 'opened'
  | 'replied'
  | 'not_opened'
  | 'not_replied'

export interface SequenceNodeConfig {
  delay_days?: number
  delay_hours?: number
  template_id?: string | null
  subject?: string
  body?: string
  check?: SequenceConditionCheck
  within_days?: number
  label?: string
}

export interface SequenceNode {
  id: string
  type: SequenceNodeType
  position: { x: number; y: number }
  config: SequenceNodeConfig
  next?: string | null
  next_no?: string | null
}

export interface EmailSequence {
  id: string
  brand_id: string
  name: string
  slug: string
  description: string
  nodes: SequenceNode[]
  active: boolean
  from_email: string
  from_name: string
  created_at: string
  updated_at: string
}

// =================================================================
// Recruiting (Stellenanzeigen)
// =================================================================

export type RecruitingJobStatus = 'draft' | 'active' | 'paused' | 'closed'
export type RecruitingJobFormat =
  | 'linkedin_organic'
  | 'linkedin_ad'
  | 'culturefit'
  | 'other'

export interface RecruitingJob {
  id: string
  brand_id: string
  title: string
  description: string
  requirements: string
  benefits: string
  format: RecruitingJobFormat
  status: RecruitingJobStatus
  external_url: string
  utm_campaign: string
  utm_source: string
  utm_medium: string
  views_count: number
  applications_count: number
  created_at: string
  updated_at: string
}

export type SequenceEnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'stopped'
  | 'error'

export interface SequenceEnrollment {
  id: string
  sequence_id: string
  contact_id: string
  brand_id: string
  status: SequenceEnrollmentStatus
  current_node_id: string
  next_run_at: string
  started_at: string
  completed_at: string | null
  last_error: string
  history: Array<{ node_id: string; at: string; result?: string }>
}

export type SalesCallOutcome =
  | 'connected'
  | 'no_pickup'
  | 'voicemail'
  | 'wrong_number'
  | 'callback_requested'

export interface SalesCallLog {
  id: string
  brand_id: string
  contact_id: string
  outcome: SalesCallOutcome
  duration_seconds: number | null
  notes: string
  called_at: string
  created_at: string
}

export type SalesGoalPeriod = 'week' | 'month'

export interface SalesGoal {
  id: string
  brand_id: string
  period: SalesGoalPeriod
  period_start: string
  calls_target: number
  mails_target: number
  meetings_target: number
  deals_target: number
  linkedin_target: number
  qualifications_target: number
  created_at: string
  updated_at: string
}

export interface SalesViewFilter {
  stage?: string | null
  pipelineId?: string | null
  potential?: string | null
  follow?: string | null
  tags?: string[]
  search?: string
}

export interface SalesView {
  id: string
  brand_id: string
  name: string
  filter: SalesViewFilter
  is_pinned: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AvailabilitySlot {
  from: string // 'HH:MM'
  to: string
}

export interface AvailabilityWeek {
  mon?: AvailabilitySlot[]
  tue?: AvailabilitySlot[]
  wed?: AvailabilitySlot[]
  thu?: AvailabilitySlot[]
  fri?: AvailabilitySlot[]
  sat?: AvailabilitySlot[]
  sun?: AvailabilitySlot[]
}

export interface SalesMeetingLink {
  id: string
  brand_id: string
  slug: string
  title: string
  description: string
  duration_minutes: number
  availability: AvailabilityWeek
  buffer_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type SalesBookingStatus = 'confirmed' | 'cancelled' | 'no_show' | 'done'

export interface SalesBooking {
  id: string
  brand_id: string
  meeting_link_id: string | null
  contact_id: string | null
  name: string
  email: string
  phone: string
  message: string
  starts_at: string
  ends_at: string
  status: SalesBookingStatus
  cancelled_at: string | null
  created_at: string
}
