/**
 * Client-Wrapper für die `invite-client` Edge Function.
 */
import { supabase } from './supabase'

export interface InviteClientInput {
  project_id: string
  client_email: string
  client_name?: string
}

export interface InviteClientResult {
  success: boolean
  user_id?: string
  portal_url?: string
  existing_user?: boolean
  resend_id?: string
  error?: string
  detail?: string
}

export async function inviteClient(input: InviteClientInput): Promise<InviteClientResult> {
  if (!supabase) {
    return { success: false, error: 'supabase_not_configured' }
  }
  const { data, error } = await supabase.functions.invoke<InviteClientResult>('invite-client', {
    body: input,
  })
  if (error) {
    return { success: false, error: 'invoke_failed', detail: error.message }
  }
  if (!data?.success) {
    return {
      success: false,
      error: data?.error ?? 'unknown_error',
      detail: data?.detail,
      user_id: data?.user_id,
      portal_url: data?.portal_url,
      existing_user: data?.existing_user,
    }
  }
  return data
}
