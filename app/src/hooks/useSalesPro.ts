/**
 * Zentrale Sales-Pro-Hooks für alle 8 neuen Tabellen.
 * Bewusst kompakt gehalten: jede Entität hat einen list-Hook + CRUD-Funktionen.
 * Fallback auf localStorage wenn Supabase fehlt oder Tabelle nicht existiert.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type {
  PipelineStageDef,
  SalesBooking,
  SalesCallLog,
  SalesEmailLog,
  SalesEmailTemplate,
  SalesGoal,
  SalesMeetingLink,
  SalesPipeline,
  SalesView,
  SalesViewFilter,
} from '../types/db'
import { useBrandId } from './useBrandId'

interface BaseResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

function nowIso() {
  return new Date().toISOString()
}

// =========================================================================
// PIPELINES
// =========================================================================

const DEFAULT_PIPELINE_STAGES: PipelineStageDef[] = [
  { key: 'first_contact', label: 'Erstkontakt' },
  { key: 'conversation', label: 'Gespräch' },
  { key: 'proposal', label: 'Pitch' },
  { key: 'deal', label: 'Deal', won: true },
  { key: 'paused', label: 'Pause' },
]

interface UseSalesPipelinesResult extends BaseResult<SalesPipeline> {
  defaultPipeline: SalesPipeline | null
  create: (input: Partial<SalesPipeline> & { name: string; slug: string }) => Promise<void>
  update: (id: string, patch: Partial<SalesPipeline>) => Promise<void>
  remove: (id: string) => Promise<void>
  setDefault: (id: string) => Promise<void>
}

export function useSalesPipelines(brandSlug: string | undefined): UseSalesPipelinesResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesPipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(loadList<SalesPipeline>([brandSlug, 'sales-pipelines']))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_pipelines')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(loadList<SalesPipeline>([brandSlug, 'sales-pipelines']))
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as SalesPipeline[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  // Auto-Seed: default pipeline anlegen, wenn keine vorhanden ist
  useEffect(() => {
    if (loading || !brandSlug) return
    if (items.length > 0) return
    if (localOnly.current || !supabase || !brandId) {
      const seeded: SalesPipeline = {
        id: generateId(),
        brand_id: brandSlug,
        name: 'Standard',
        slug: 'default',
        stages: DEFAULT_PIPELINE_STAGES,
        is_default: true,
        sort_order: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      const next = [seeded]
      setItems(next)
      saveList([brandSlug, 'sales-pipelines'], next)
      return
    }
    void supabase
      .from('sales_pipelines')
      .insert({
        brand_id: brandId,
        name: 'Standard',
        slug: 'default',
        stages: DEFAULT_PIPELINE_STAGES,
        is_default: true,
        sort_order: 0,
      })
      .then(({ error: insErr }) => {
        if (insErr && !isMissingSupabaseTableError(insErr.message)) {
          console.warn('[useSalesPipelines] seed:', insErr.message)
        }
        void reload()
      })
  }, [items.length, loading, brandSlug, brandId, reload])

  const create = useCallback(
    async (input: Partial<SalesPipeline> & { name: string; slug: string }) => {
      if (!brandSlug) return
      const row: SalesPipeline = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        name: input.name,
        slug: input.slug,
        stages: input.stages ?? DEFAULT_PIPELINE_STAGES,
        is_default: input.is_default ?? false,
        sort_order: input.sort_order ?? items.length,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      const next = [...items, row]
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'sales-pipelines'], next)
        return
      }
      const { error: insErr } = await supabase.from('sales_pipelines').insert({
        brand_id: brandId,
        name: row.name,
        slug: row.slug,
        stages: row.stages,
        is_default: row.is_default,
        sort_order: row.sort_order,
      })
      if (insErr) setError(insErr.message)
      void reload()
    },
    [brandId, brandSlug, items, reload],
  )

  const update = useCallback(
    async (id: string, patch: Partial<SalesPipeline>) => {
      if (!brandSlug) return
      const next = items.map((p) => (p.id === id ? { ...p, ...patch, updated_at: nowIso() } : p))
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'sales-pipelines'], next)
        return
      }
      const { error: updErr } = await supabase
        .from('sales_pipelines')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', brandId)
      if (updErr) setError(updErr.message)
    },
    [brandId, brandSlug, items],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      const next = items.filter((p) => p.id !== id)
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'sales-pipelines'], next)
        return
      }
      await supabase.from('sales_pipelines').delete().eq('id', id).eq('brand_id', brandId)
    },
    [brandId, brandSlug, items],
  )

  const setDefault = useCallback(
    async (id: string) => {
      const next = items.map((p) => ({ ...p, is_default: p.id === id }))
      setItems(next)
      if (localOnly.current || !supabase || !brandId || !brandSlug) {
        if (brandSlug) saveList([brandSlug, 'sales-pipelines'], next)
        return
      }
      await supabase.from('sales_pipelines').update({ is_default: false }).eq('brand_id', brandId)
      await supabase
        .from('sales_pipelines')
        .update({ is_default: true })
        .eq('id', id)
        .eq('brand_id', brandId)
    },
    [brandId, brandSlug, items],
  )

  const defaultPipeline = useMemo(
    () => items.find((p) => p.is_default) ?? items[0] ?? null,
    [items],
  )

  return { items, loading, error, reload, defaultPipeline, create, update, remove, setDefault }
}

// =========================================================================
// EMAIL TEMPLATES
// =========================================================================

interface UseEmailTemplatesResult extends BaseResult<SalesEmailTemplate> {
  create: (input: Partial<SalesEmailTemplate> & { name: string }) => Promise<SalesEmailTemplate>
  update: (id: string, patch: Partial<SalesEmailTemplate>) => Promise<void>
  remove: (id: string) => Promise<void>
  recordUsage: (id: string) => Promise<void>
  ensureDefaults: () => Promise<void>
}

export function useEmailTemplates(brandSlug: string | undefined): UseEmailTemplatesResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesEmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(loadList<SalesEmailTemplate>([brandSlug, 'email-templates']))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_email_templates')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(loadList<SalesEmailTemplate>([brandSlug, 'email-templates']))
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as SalesEmailTemplate[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (input: Partial<SalesEmailTemplate> & { name: string }): Promise<SalesEmailTemplate> => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const row: SalesEmailTemplate = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        name: input.name,
        subject: input.subject ?? '',
        body: input.body ?? '',
        stage: input.stage ?? null,
        variables: input.variables ?? [],
        sort_order: input.sort_order ?? items.length,
        last_used_at: input.last_used_at ?? null,
        use_count: input.use_count ?? 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      const next = [...items, row]
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'email-templates'], next)
        return row
      }
      const { data, error: insErr } = await supabase
        .from('sales_email_templates')
        .insert({
          brand_id: brandId,
          name: row.name,
          subject: row.subject,
          body: row.body,
          stage: row.stage,
          variables: row.variables,
          sort_order: row.sort_order,
        })
        .select('*')
        .maybeSingle()
      if (insErr) setError(insErr.message)
      if (data) {
        setItems((cur) => cur.map((t) => (t.id === row.id ? (data as SalesEmailTemplate) : t)))
        return data as SalesEmailTemplate
      }
      return row
    },
    [brandId, brandSlug, items],
  )

  const update = useCallback(
    async (id: string, patch: Partial<SalesEmailTemplate>) => {
      if (!brandSlug) return
      const next = items.map((t) => (t.id === id ? { ...t, ...patch, updated_at: nowIso() } : t))
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'email-templates'], next)
        return
      }
      const { error: updErr } = await supabase
        .from('sales_email_templates')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', brandId)
      if (updErr) setError(updErr.message)
    },
    [brandId, brandSlug, items],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      const next = items.filter((t) => t.id !== id)
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'email-templates'], next)
        return
      }
      await supabase.from('sales_email_templates').delete().eq('id', id).eq('brand_id', brandId)
    },
    [brandId, brandSlug, items],
  )

  const recordUsage = useCallback(
    async (id: string) => {
      const t = items.find((x) => x.id === id)
      if (!t) return
      await update(id, {
        last_used_at: nowIso(),
        use_count: (t.use_count ?? 0) + 1,
      })
    },
    [items, update],
  )

  const ensureDefaults = useCallback(async () => {
    if (!brandSlug || localOnly.current) return
    const { DEFAULT_EMAIL_TEMPLATE_SEEDS } = await import('../lib/seedEmailTemplates')
    const existing = new Set(items.map((t) => t.name.toLowerCase()))
    for (const seed of DEFAULT_EMAIL_TEMPLATE_SEEDS) {
      if (existing.has(seed.name.toLowerCase())) continue
      await create({
        name: seed.name,
        subject: seed.subject,
        body: seed.body,
      })
    }
  }, [brandSlug, items, create])

  return { items, loading, error, reload, create, update, remove, recordUsage, ensureDefaults }
}

// =========================================================================
// EMAIL LOGS (pro Contact oder gesamt)
// =========================================================================

interface UseEmailLogsOpts {
  contactId?: string
  limit?: number
}

interface UseEmailLogsResult extends BaseResult<SalesEmailLog> {
  log: (input: Partial<SalesEmailLog> & { contact_id: string; subject: string }) => Promise<SalesEmailLog>
  update: (id: string, patch: Partial<SalesEmailLog>) => Promise<void>
}

export function useEmailLogs(
  brandSlug: string | undefined,
  opts: UseEmailLogsOpts = {},
): UseEmailLogsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesEmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const { contactId, limit = 200 } = opts

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    const stored = loadList<SalesEmailLog>([brandSlug, 'email-logs'])
    if (!supabase || !brandId) {
      localOnly.current = true
      const filtered = contactId ? stored.filter((x) => x.contact_id === contactId) : stored
      setItems(filtered)
      setLoading(false)
      return
    }
    setLoading(true)
    let q = supabase
      .from('sales_email_logs')
      .select('*')
      .eq('brand_id', brandId)
      .order('sent_at', { ascending: false })
      .limit(limit)
    if (contactId) q = q.eq('contact_id', contactId)
    const { data, error: err } = await q
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        const filtered = contactId ? stored.filter((x) => x.contact_id === contactId) : stored
        setItems(filtered)
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as SalesEmailLog[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, contactId, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  const log = useCallback(
    async (
      input: Partial<SalesEmailLog> & { contact_id: string; subject: string },
    ): Promise<SalesEmailLog> => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const row: SalesEmailLog = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        contact_id: input.contact_id,
        template_id: input.template_id ?? null,
        direction: input.direction ?? 'outbound',
        subject: input.subject,
        body_preview: input.body_preview ?? '',
        sent_at: input.sent_at ?? nowIso(),
        opened_at: input.opened_at ?? null,
        replied_at: input.replied_at ?? null,
        bounced_at: input.bounced_at ?? null,
        tracking_id: input.tracking_id ?? null,
        resend_id: input.resend_id ?? '',
        from_email: input.from_email ?? '',
        from_name: input.from_name ?? '',
        to_email: input.to_email ?? '',
        sequence_id: input.sequence_id ?? null,
        enrollment_id: input.enrollment_id ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      setItems((cur) => [row, ...cur])
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<SalesEmailLog>([brandSlug, 'email-logs'])
        saveList([brandSlug, 'email-logs'], [row, ...all])
        return row
      }
      const { error: insErr } = await supabase.from('sales_email_logs').insert({
        brand_id: brandId,
        contact_id: row.contact_id,
        template_id: row.template_id,
        direction: row.direction,
        subject: row.subject,
        body_preview: row.body_preview,
        sent_at: row.sent_at,
        tracking_id: row.tracking_id,
      })
      if (insErr) setError(insErr.message)
      return row
    },
    [brandId, brandSlug],
  )

  const update = useCallback(
    async (id: string, patch: Partial<SalesEmailLog>) => {
      if (!brandSlug) return
      setItems((cur) =>
        cur.map((l) => (l.id === id ? { ...l, ...patch, updated_at: nowIso() } : l)),
      )
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<SalesEmailLog>([brandSlug, 'email-logs'])
        saveList(
          [brandSlug, 'email-logs'],
          all.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        )
        return
      }
      const { error: updErr } = await supabase
        .from('sales_email_logs')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', brandId)
      if (updErr) setError(updErr.message)
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, reload, log, update }
}

// =========================================================================
// CALL LOGS
// =========================================================================

interface UseCallLogsOpts {
  contactId?: string
  limit?: number
}

interface UseCallLogsResult extends BaseResult<SalesCallLog> {
  log: (input: Partial<SalesCallLog> & { contact_id: string }) => Promise<SalesCallLog>
}

export function useCallLogs(
  brandSlug: string | undefined,
  opts: UseCallLogsOpts = {},
): UseCallLogsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesCallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const { contactId, limit = 200 } = opts

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    const stored = loadList<SalesCallLog>([brandSlug, 'call-logs'])
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(contactId ? stored.filter((x) => x.contact_id === contactId) : stored)
      setLoading(false)
      return
    }
    setLoading(true)
    let q = supabase
      .from('sales_call_logs')
      .select('*')
      .eq('brand_id', brandId)
      .order('called_at', { ascending: false })
      .limit(limit)
    if (contactId) q = q.eq('contact_id', contactId)
    const { data, error: err } = await q
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(contactId ? stored.filter((x) => x.contact_id === contactId) : stored)
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as SalesCallLog[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, contactId, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  const log = useCallback(
    async (input: Partial<SalesCallLog> & { contact_id: string }): Promise<SalesCallLog> => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const row: SalesCallLog = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        contact_id: input.contact_id,
        outcome: input.outcome ?? 'no_pickup',
        duration_seconds: input.duration_seconds ?? null,
        notes: input.notes ?? '',
        called_at: input.called_at ?? nowIso(),
        created_at: nowIso(),
      }
      setItems((cur) => [row, ...cur])
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<SalesCallLog>([brandSlug, 'call-logs'])
        saveList([brandSlug, 'call-logs'], [row, ...all])
        return row
      }
      const { error: insErr } = await supabase.from('sales_call_logs').insert({
        brand_id: brandId,
        contact_id: row.contact_id,
        outcome: row.outcome,
        duration_seconds: row.duration_seconds,
        notes: row.notes,
        called_at: row.called_at,
      })
      if (insErr) setError(insErr.message)
      return row
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, reload, log }
}

// =========================================================================
// GOALS
// =========================================================================

export function startOfIsoWeekDate(d = new Date()): string {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

interface UseSalesGoalsResult {
  current: SalesGoal | null
  loading: boolean
  error: string | null
  upsert: (
    patch: Partial<
      Pick<
        SalesGoal,
        | 'calls_target'
        | 'mails_target'
        | 'meetings_target'
        | 'deals_target'
        | 'linkedin_target'
        | 'qualifications_target'
      >
    >,
  ) => Promise<void>
  reload: () => Promise<void>
}

export function useSalesGoals(
  brandSlug: string | undefined,
  period: 'week' | 'month' = 'week',
): UseSalesGoalsResult {
  const brandId = useBrandId(brandSlug)
  const [current, setCurrent] = useState<SalesGoal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const periodStart = startOfIsoWeekDate()

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setCurrent(null)
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      const list = loadList<SalesGoal>([brandSlug, 'sales-goals'])
      setCurrent(
        list.find((g) => g.period === period && g.period_start === periodStart) ?? null,
      )
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_goals')
      .select('*')
      .eq('brand_id', brandId)
      .eq('period', period)
      .eq('period_start', periodStart)
      .maybeSingle()
    if (err && !isMissingSupabaseTableError(err.message)) {
      setError(err.message)
      setLoading(false)
      return
    }
    localOnly.current = false
    setCurrent((data as SalesGoal | null) ?? null)
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, period, periodStart])

  useEffect(() => {
    void reload()
  }, [reload])

  const upsert = useCallback(
    async (
      patch: Partial<
        Pick<
          SalesGoal,
          | 'calls_target'
          | 'mails_target'
          | 'meetings_target'
          | 'deals_target'
          | 'linkedin_target'
          | 'qualifications_target'
        >
      >,
    ) => {
      if (!brandSlug) return
      const merged: SalesGoal = {
        id: current?.id ?? generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        period,
        period_start: periodStart,
        calls_target: patch.calls_target ?? current?.calls_target ?? 0,
        mails_target: patch.mails_target ?? current?.mails_target ?? 0,
        meetings_target: patch.meetings_target ?? current?.meetings_target ?? 0,
        deals_target: patch.deals_target ?? current?.deals_target ?? 0,
        linkedin_target: patch.linkedin_target ?? current?.linkedin_target ?? 0,
        qualifications_target: patch.qualifications_target ?? current?.qualifications_target ?? 0,
        created_at: current?.created_at ?? nowIso(),
        updated_at: nowIso(),
      }
      setCurrent(merged)
      if (localOnly.current || !supabase || !brandId) {
        const list = loadList<SalesGoal>([brandSlug, 'sales-goals'])
        const others = list.filter(
          (g) => !(g.period === period && g.period_start === periodStart),
        )
        saveList([brandSlug, 'sales-goals'], [...others, merged])
        return
      }
      const { error: upErr } = await supabase
        .from('sales_goals')
        .upsert(
          {
            brand_id: brandId,
            period,
            period_start: periodStart,
            calls_target: merged.calls_target,
            mails_target: merged.mails_target,
            meetings_target: merged.meetings_target,
            deals_target: merged.deals_target,
            linkedin_target: merged.linkedin_target,
            qualifications_target: merged.qualifications_target,
          },
          { onConflict: 'brand_id,period,period_start' },
        )
      if (upErr) setError(upErr.message)
      void reload()
    },
    [brandId, brandSlug, current, period, periodStart, reload],
  )

  return { current, loading, error, upsert, reload }
}

// =========================================================================
// VIEWS (saved filters)
// =========================================================================

interface UseSalesViewsResult extends BaseResult<SalesView> {
  create: (name: string, filter: SalesViewFilter) => Promise<SalesView>
  remove: (id: string) => Promise<void>
}

export function useSalesViews(brandSlug: string | undefined): UseSalesViewsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(loadList<SalesView>([brandSlug, 'sales-views']))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_views')
      .select('*')
      .eq('brand_id', brandId)
      .order('sort_order', { ascending: true })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(loadList<SalesView>([brandSlug, 'sales-views']))
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as SalesView[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (name: string, filter: SalesViewFilter): Promise<SalesView> => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const row: SalesView = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        name,
        filter,
        is_pinned: false,
        sort_order: items.length,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      const next = [...items, row]
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'sales-views'], next)
        return row
      }
      await supabase.from('sales_views').insert({
        brand_id: brandId,
        name,
        filter,
        sort_order: row.sort_order,
      })
      return row
    },
    [brandId, brandSlug, items],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      const next = items.filter((v) => v.id !== id)
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'sales-views'], next)
        return
      }
      await supabase.from('sales_views').delete().eq('id', id).eq('brand_id', brandId)
    },
    [brandId, brandSlug, items],
  )

  return { items, loading, error, reload, create, remove }
}

// =========================================================================
// MEETING LINKS
// =========================================================================

interface UseMeetingLinksResult extends BaseResult<SalesMeetingLink> {
  create: (input: Partial<SalesMeetingLink> & { slug: string; title: string }) => Promise<SalesMeetingLink>
  update: (id: string, patch: Partial<SalesMeetingLink>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useMeetingLinks(brandSlug: string | undefined): UseMeetingLinksResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesMeetingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(loadList<SalesMeetingLink>([brandSlug, 'meeting-links']))
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_meeting_links')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(loadList<SalesMeetingLink>([brandSlug, 'meeting-links']))
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as SalesMeetingLink[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (
      input: Partial<SalesMeetingLink> & { slug: string; title: string },
    ): Promise<SalesMeetingLink> => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const row: SalesMeetingLink = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        slug: input.slug,
        title: input.title,
        description: input.description ?? '',
        duration_minutes: input.duration_minutes ?? 30,
        availability: input.availability ?? {
          mon: [{ from: '09:00', to: '17:00' }],
          tue: [{ from: '09:00', to: '17:00' }],
          wed: [{ from: '09:00', to: '17:00' }],
          thu: [{ from: '09:00', to: '17:00' }],
          fri: [{ from: '09:00', to: '15:00' }],
        },
        buffer_minutes: input.buffer_minutes ?? 15,
        is_active: input.is_active ?? true,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      const next = [row, ...items]
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'meeting-links'], next)
        return row
      }
      await supabase.from('sales_meeting_links').insert({
        brand_id: brandId,
        slug: row.slug,
        title: row.title,
        description: row.description,
        duration_minutes: row.duration_minutes,
        availability: row.availability,
        buffer_minutes: row.buffer_minutes,
        is_active: row.is_active,
      })
      return row
    },
    [brandId, brandSlug, items],
  )

  const update = useCallback(
    async (id: string, patch: Partial<SalesMeetingLink>) => {
      if (!brandSlug) return
      const next = items.map((m) => (m.id === id ? { ...m, ...patch, updated_at: nowIso() } : m))
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'meeting-links'], next)
        return
      }
      await supabase
        .from('sales_meeting_links')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', brandId)
    },
    [brandId, brandSlug, items],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      const next = items.filter((m) => m.id !== id)
      setItems(next)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'meeting-links'], next)
        return
      }
      await supabase.from('sales_meeting_links').delete().eq('id', id).eq('brand_id', brandId)
    },
    [brandId, brandSlug, items],
  )

  return { items, loading, error, reload, create, update, remove }
}

// =========================================================================
// BOOKINGS
// =========================================================================

interface UseBookingsResult extends BaseResult<SalesBooking> {}

export function useBookings(brandSlug: string | undefined): UseBookingsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SalesBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!brandSlug || !supabase || !brandId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_bookings')
      .select('*')
      .eq('brand_id', brandId)
      .order('starts_at', { ascending: false })
      .limit(200)
    if (err) {
      if (!isMissingSupabaseTableError(err.message)) setError(err.message)
      setLoading(false)
      return
    }
    setItems((data ?? []) as SalesBooking[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, loading, error, reload }
}
