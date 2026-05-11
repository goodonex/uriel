/**
 * process-sequences — Cron-Worker für E-Mail-Sequenzen.
 *
 * Aufruf:
 *   - manuell: POST /functions/v1/process-sequences  (Service-Role-Auth)
 *   - per Supabase Scheduled Function (alle 5 Min)
 *
 * Algorithmus:
 *   1. Hole alle Enrollments mit status='active' und next_run_at <= now()
 *   2. Pro Enrollment: lade Sequence → finde current_node
 *   3. Verarbeite Node nach Typ (wait/email/condition/end)
 *   4. Schreibe history, current_node_id, next_run_at fort
 *
 * Sicherheit: Cron nutzt den Service-Role-Key, der nur intern verfügbar ist.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'

interface SequenceNode {
  id: string
  type: 'start' | 'wait' | 'email' | 'condition' | 'end'
  position?: { x: number; y: number }
  config: {
    delay_days?: number
    delay_hours?: number
    template_id?: string | null
    subject?: string
    body?: string
    check?: 'opened' | 'replied' | 'not_opened' | 'not_replied'
    within_days?: number
  }
  next?: string | null
  next_no?: string | null
}

interface Sequence {
  id: string
  brand_id: string
  name: string
  nodes: SequenceNode[]
  from_email: string
  from_name: string
  active: boolean
}

interface Enrollment {
  id: string
  sequence_id: string
  contact_id: string
  brand_id: string
  status: string
  current_node_id: string
  next_run_at: string
  history: Array<{ node_id: string; at: string; result?: string }>
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = new Date().toISOString()

  const { data: dueRaw, error: dueErr } = await supabase
    .from('email_sequence_enrollments')
    .select('id, sequence_id, contact_id, brand_id, status, current_node_id, next_run_at, history')
    .eq('status', 'active')
    .lte('next_run_at', now)
    .limit(100)

  if (dueErr) return json({ error: 'fetch_due_failed', detail: dueErr.message }, 500)
  const due = (dueRaw ?? []) as Enrollment[]

  const results: Array<{ enrollment_id: string; node?: string; action?: string; error?: string }> = []

  for (const e of due) {
    try {
      const action = await processOne(supabase, e)
      results.push({ enrollment_id: e.id, ...action })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase
        .from('email_sequence_enrollments')
        .update({ status: 'error', last_error: msg })
        .eq('id', e.id)
      results.push({ enrollment_id: e.id, error: msg })
    }
  }

  return json({ ok: true, processed: results.length, results })
})

async function processOne(
  supabase: SupabaseClient,
  e: Enrollment,
): Promise<{ node?: string; action?: string }> {
  const { data: seq } = await supabase
    .from('email_sequences')
    .select('id, brand_id, name, nodes, from_email, from_name, active')
    .eq('id', e.sequence_id)
    .maybeSingle()
  const sequence = seq as Sequence | null
  if (!sequence) throw new Error('sequence_not_found')
  if (!sequence.active) {
    await supabase
      .from('email_sequence_enrollments')
      .update({ status: 'paused' })
      .eq('id', e.id)
    return { action: 'sequence_inactive' }
  }

  const nodes = sequence.nodes ?? []
  const current = nodes.find((n) => n.id === e.current_node_id) ?? nodes.find((n) => n.type === 'start')
  if (!current) throw new Error('node_not_found')

  const historyEntry: { node_id: string; at: string; result?: string } = {
    node_id: current.id,
    at: new Date().toISOString(),
  }

  if (current.type === 'end') {
    await supabase
      .from('email_sequence_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        history: [...(e.history ?? []), historyEntry],
      })
      .eq('id', e.id)
    return { node: current.id, action: 'completed' }
  }

  if (current.type === 'start') {
    return advance(supabase, e, sequence, current, current.next ?? null, historyEntry)
  }

  if (current.type === 'wait') {
    // Delay-Berechnung wurde schon beim Eintritt in den Wait-Node gesetzt (siehe advance()).
    // Wenn wir hier ankommen und next_run_at <= now, dann ist die Wartezeit um → weiter zum next-Node.
    return advance(supabase, e, sequence, current, current.next ?? null, historyEntry)
  }

  if (current.type === 'email') {
    const contact = await loadContact(supabase, e.contact_id)
    if (!contact?.email) {
      historyEntry.result = 'skipped_no_email'
      return advance(supabase, e, sequence, current, current.next ?? null, historyEntry)
    }
    const rendered = renderTemplate(current.config.subject ?? '', current.config.body ?? '', contact)

    const sendResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        brand_id: sequence.brand_id,
        contact_id: e.contact_id,
        subject: rendered.subject,
        body: rendered.body,
        template_id: current.config.template_id ?? null,
        sequence_id: sequence.id,
        enrollment_id: e.id,
        from_email: sequence.from_email,
        from_name: sequence.from_name,
      }),
    })
    if (!sendResp.ok) {
      const text = await sendResp.text().catch(() => '')
      throw new Error(`send-email failed: ${sendResp.status} ${text.slice(0, 200)}`)
    }
    historyEntry.result = 'email_sent'
    return advance(supabase, e, sequence, current, current.next ?? null, historyEntry)
  }

  if (current.type === 'condition') {
    const within = current.config.within_days ?? 7
    const sinceIso = new Date(Date.now() - within * 86_400_000).toISOString()
    const { data: logs } = await supabase
      .from('sales_email_logs')
      .select('id, opened_at, replied_at')
      .eq('contact_id', e.contact_id)
      .eq('sequence_id', sequence.id)
      .gte('sent_at', sinceIso)
      .order('sent_at', { ascending: false })
      .limit(50)
    const all = logs ?? []
    let truthy = false
    if (current.config.check === 'opened') truthy = all.some((l) => l.opened_at)
    else if (current.config.check === 'not_opened') truthy = all.length > 0 && !all.some((l) => l.opened_at)
    else if (current.config.check === 'replied') truthy = all.some((l) => l.replied_at)
    else if (current.config.check === 'not_replied') truthy = all.length > 0 && !all.some((l) => l.replied_at)
    historyEntry.result = `condition:${truthy ? 'yes' : 'no'}`
    return advance(
      supabase,
      e,
      sequence,
      current,
      (truthy ? current.next : current.next_no) ?? null,
      historyEntry,
    )
  }

  return {}
}

async function advance(
  supabase: SupabaseClient,
  e: Enrollment,
  sequence: Sequence,
  prev: SequenceNode,
  nextId: string | null,
  history: { node_id: string; at: string; result?: string },
) {
  const history2 = [...(e.history ?? []), history]
  if (!nextId) {
    await supabase
      .from('email_sequence_enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        history: history2,
      })
      .eq('id', e.id)
    return { node: prev.id, action: 'completed_dead_end' }
  }
  const nextNode = sequence.nodes.find((n) => n.id === nextId)
  if (!nextNode) {
    await supabase
      .from('email_sequence_enrollments')
      .update({
        status: 'error',
        last_error: `next_node_not_found:${nextId}`,
        history: history2,
      })
      .eq('id', e.id)
    return { node: prev.id, action: 'error_next_missing' }
  }

  // Wait-Node: next_run_at in die Zukunft setzen, aber das current_node_id aktualisieren.
  // Beim nächsten Cron-Lauf landen wir dann oben im processOne mit current=wait.
  // Damit wir den wait nicht zweimal warten lassen, springen wir hier direkt durch
  // und setzen next_run_at = now() + delay, current_node_id = nextNode.next.
  if (nextNode.type === 'wait') {
    const days = nextNode.config.delay_days ?? 0
    const hours = nextNode.config.delay_hours ?? 0
    const ms = days * 86_400_000 + hours * 3_600_000
    const nextRun = new Date(Date.now() + Math.max(60_000, ms)).toISOString()
    const afterWaitId = nextNode.next ?? null
    await supabase
      .from('email_sequence_enrollments')
      .update({
        current_node_id: afterWaitId ?? nextNode.id,
        next_run_at: nextRun,
        history: [...history2, { node_id: nextNode.id, at: new Date().toISOString(), result: `waiting:${ms}ms` }],
      })
      .eq('id', e.id)
    return { node: nextNode.id, action: 'wait_scheduled' }
  }

  // Normal: direkt mit nächstem Node weitermachen (kein Wait)
  await supabase
    .from('email_sequence_enrollments')
    .update({
      current_node_id: nextNode.id,
      next_run_at: new Date().toISOString(),
      history: history2,
    })
    .eq('id', e.id)
  return { node: nextNode.id, action: 'advanced' }
}

async function loadContact(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from('contacts')
    .select('id, name, email, company, ansprechpartner')
    .eq('id', id)
    .maybeSingle()
  return data
}

function renderTemplate(
  subjectTpl: string,
  bodyTpl: string,
  contact: { name?: string; email?: string; company?: string; ansprechpartner?: string },
) {
  const vars: Record<string, string> = {
    name: contact.name ?? '',
    email: contact.email ?? '',
    company: contact.company ?? '',
    ansprechpartner: contact.ansprechpartner ?? '',
    first_name: (contact.name ?? '').split(' ')[0] ?? '',
  }
  const apply = (s: string) =>
    s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? '')
  return { subject: apply(subjectTpl), body: apply(bodyTpl) }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
