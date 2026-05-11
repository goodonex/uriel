/**
 * Client-Wrapper für die `send-email` Edge Function.
 * Ein Klick → Resend-Versand + DB-Log + Open-Tracking-Pixel.
 */
import { supabase } from './supabase'

export interface SendEmailInput {
  brand_id: string
  contact_id: string
  subject: string
  body: string
  template_id?: string | null
  sequence_id?: string | null
  enrollment_id?: string | null
  from_email?: string | null
  from_name?: string | null
}

export interface SendEmailResult {
  ok: boolean
  log_id?: string
  tracking_id?: string
  resend_id?: string
  error?: string
  detail?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!supabase) {
    return { ok: false, error: 'supabase_not_configured' }
  }
  const { data, error } = await supabase.functions.invoke<SendEmailResult>('send-email', {
    body: input,
  })
  if (error) {
    return { ok: false, error: 'invoke_failed', detail: error.message }
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error ?? 'unknown_error', detail: data?.detail }
  }
  return data
}

export async function triggerSequenceWorker(): Promise<{ ok: boolean; processed?: number }> {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; processed?: number }>(
    'process-sequences',
    { body: {} },
  )
  if (error || !data) return { ok: false }
  return data
}
