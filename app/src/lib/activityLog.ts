import { supabase } from './supabase'

export type ActivityEntityType =
  | 'contact'
  | 'task'
  | 'project'
  | 'positioning'
  | 'icp'
  | 'business_model'
  | 'word_bank'
  | 'content_piece'
  | 'asset'
  | 'sop'

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'completed'
  | 'reopened'
  | 'stage_changed'
  | 'note_added'
  | 'archived'
  | 'linkedin_sent'
  | 'pitch_sent'
  | 'loom_created'
  | 'qualified'
  | 'client_invited'

export interface ActivityEntry {
  id: string
  brand_id: string
  actor_id: string | null
  entity_type: ActivityEntityType
  entity_id: string | null
  action: ActivityAction
  summary: string
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface LogActivityInput {
  brand_id: string
  entity_type: ActivityEntityType
  entity_id?: string | null
  action: ActivityAction
  summary: string
  metadata?: Record<string, unknown>
}

/**
 * Fire-and-forget Activity-Log Insert.
 * Bei Fehlern stumm — Aktivitäten dürfen die Hauptaktion nie blockieren.
 */
export function logActivity(input: LogActivityInput): void {
  if (!supabase || !input.brand_id) return
  void supabase
    .from('activity_log')
    .insert({
      brand_id: input.brand_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) {
        console.warn('[activity_log] insert failed', error.message)
      }
    })
}

export function rowToActivity(row: Record<string, unknown>): ActivityEntry {
  return {
    id: typeof row.id === 'string' ? row.id : '',
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : '',
    actor_id: typeof row.actor_id === 'string' ? row.actor_id : null,
    entity_type: (row.entity_type as ActivityEntityType) ?? 'contact',
    entity_id: typeof row.entity_id === 'string' ? row.entity_id : null,
    action: (row.action as ActivityAction) ?? 'updated',
    summary: typeof row.summary === 'string' ? row.summary : '',
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    read_at: typeof row.read_at === 'string' ? row.read_at : null,
    created_at:
      typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  }
}
