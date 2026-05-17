import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { rowRecordToDeliverProject } from '../lib/deliverProjectCoercion'
import type { Contact, ContentPiece, DeliverProject, DiscoveryFeedItem } from '../types/db'
import { DELIVER_STAGE_ORDER } from '../types/db'
import { useBrandId } from './useBrandId'

function monthStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

function sevenDaysAgoIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString()
}

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface BrandWorkspaceMetrics {
  pipeline: number | null
  contentMonth: number | null
  deliverActive: number | null
  discoveryWeek: number | null
  promoUpcoming: number | null
  assets: number | null
  loading: boolean
}

/** Sidebar + Context-Strip + Flow-Kacheln — kompakte Kennzahlen. */
export function useBrandWorkspaceMetrics(
  slug: string | undefined,
): BrandWorkspaceMetrics & { reload: () => void } {
  const brandId = useBrandId(slug)
  const [state, setState] = useState<BrandWorkspaceMetrics>({
    pipeline: null,
    contentMonth: null,
    deliverActive: null,
    discoveryWeek: null,
    promoUpcoming: null,
    assets: null,
    loading: true,
  })

  const load = useCallback(async () => {
    if (!supabase || !brandId) {
      setState({
        pipeline: null,
        contentMonth: null,
        deliverActive: null,
        discoveryWeek: null,
        promoUpcoming: null,
        assets: null,
        loading: false,
      })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const mStart = monthStartIso()
    const d7 = sevenDaysAgoIso()
    const today = todayYmdLocal()

    const [
      pipeRes,
      contentRes,
      delRes,
      discRes,
      promoRes,
      assetRes,
    ] = await Promise.all([
      supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .neq('pipeline_stage', 'paused'),
      supabase
        .from('content_pieces')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('updated_at', mStart),
      supabase
        .from('deliver_projects')
        .select('*', { count: 'exact', head: true })
        .eq('owner_brand_id', brandId)
        .neq('status', 'completed'),
      supabase
        .from('discovery_feed_items')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('recorded_at', d7),
      supabase
        .from('content_pieces')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('scheduled_at', today),
      supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId),
    ])

    setState({
      pipeline: pipeRes.error ? null : (pipeRes.count ?? 0),
      contentMonth: contentRes.error ? null : (contentRes.count ?? 0),
      deliverActive: delRes.error ? null : (delRes.count ?? 0),
      discoveryWeek: discRes.error ? null : (discRes.count ?? 0),
      promoUpcoming: promoRes.error ? null : (promoRes.count ?? 0),
      assets: assetRes.error ? null : (assetRes.count ?? 0),
      loading: false,
    })
  }, [brandId])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}

export interface BrandDashboardData {
  metrics: BrandWorkspaceMetrics
  contacts: Contact[]
  contentPieces: ContentPiece[]
  deliverProjects: DeliverProject[]
  feedItems: DiscoveryFeedItem[]
  loading: boolean
  error: string | null
  reload: () => void
}

function rowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string) ?? '',
    website: (row.website as string) ?? '',
    instagram: (row.instagram as string) ?? '',
    linkedin: (row.linkedin as string) ?? '',
    company: (row.company as string) ?? '',
    source_content_piece_id: (row.source_content_piece_id as string | null) ?? null,
    source_campaign_id: (row.source_campaign_id as string | null) ?? null,
    source_funnel_id: (row.source_funnel_id as string | null) ?? null,
    lead_quality:
      row.lead_quality === 'good' || row.lead_quality === 'bad'
        ? row.lead_quality
        : 'unqualified',
    lead_value:
      row.lead_value != null && Number.isFinite(Number(row.lead_value))
        ? Number(row.lead_value)
        : null,
    pipeline_stage: row.pipeline_stage as Contact['pipeline_stage'],
    last_contact_at: (row.last_contact_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    notes: (row.notes as string) ?? '',
    call_notes: ((row.call_notes as string | undefined) ?? ''),
    activity_log: [],
    bedarf: (row.bedarf as string | undefined) ?? '',
    ansprechpartner: (row.ansprechpartner as string | undefined) ?? '',
    aktuelle_situation: (row.aktuelle_situation as string | undefined) ?? '',
    hauptproblem: (row.hauptproblem as string | undefined) ?? '',
    timeline: (row.timeline as string | undefined) ?? '',
    budget: (row.budget as string | undefined) ?? '',
    ist_entscheider: Boolean(row.ist_entscheider),
    entscheider_name: (row.entscheider_name as string | undefined) ?? '',
    einwaende: (row.einwaende as string | undefined) ?? '',
    naechste_schritte: (row.naechste_schritte as string | undefined) ?? '',
    abschluss_wahrscheinlichkeit:
      typeof row.abschluss_wahrscheinlichkeit === 'number'
        ? row.abschluss_wahrscheinlichkeit
        : Number(row.abschluss_wahrscheinlichkeit) || 0,
    potenzial_betrag:
      typeof row.potenzial_betrag === 'number' ? row.potenzial_betrag : 0,
    potenzial_typ: (() => {
      const t = String(row.potenzial_typ ?? '').toLowerCase()
      if (t === 'monatlich') return 'monatlich' as const
      if (t === 'jährlich' || t === 'jaehrlich') return 'jährlich' as const
      return 'einmalig' as const
    })(),
    potenzial_notiz: (row.potenzial_notiz as string | undefined) ?? '',
    custom_fields:
      row.custom_fields && typeof row.custom_fields === 'object' && !Array.isArray(row.custom_fields)
        ? (row.custom_fields as Contact['custom_fields'])
        : {},
    updated_at: row.updated_at as string,
  }
}

export function deliverStageProgress(stage: DeliverProject['internal_stage']): number {
  const i = DELIVER_STAGE_ORDER.indexOf(stage)
  if (i < 0) return 0
  return Math.round(((i + 1) / DELIVER_STAGE_ORDER.length) * 100)
}

export function useBrandDashboardData(slug: string | undefined): BrandDashboardData {
  const brandId = useBrandId(slug)
  const [metrics, setMetrics] = useState<BrandWorkspaceMetrics>({
    pipeline: null,
    contentMonth: null,
    deliverActive: null,
    discoveryWeek: null,
    promoUpcoming: null,
    assets: null,
    loading: true,
  })
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contentPieces, setContentPieces] = useState<ContentPiece[]>([])
  const [deliverProjects, setDeliverProjects] = useState<DeliverProject[]>([])
  const [feedItems, setFeedItems] = useState<DiscoveryFeedItem[]>([])
  const [loadingExtra, setLoadingExtra] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setMetrics({
        pipeline: null,
        contentMonth: null,
        deliverActive: null,
        discoveryWeek: null,
        promoUpcoming: null,
        assets: null,
        loading: false,
      })
      setContacts([])
      setContentPieces([])
      setDeliverProjects([])
      setFeedItems([])
      setLoadingExtra(false)
      setError(null)
      return
    }
    setMetrics((m) => ({ ...m, loading: true }))
    setLoadingExtra(true)
    setError(null)

    const mStart = monthStartIso()
    const d7 = sevenDaysAgoIso()
    const today = todayYmdLocal()

    const [
      pipeRes,
      contentRes,
      delRes,
      discRes,
      promoRes,
      assetRes,
      cRes,
      cpRes,
      dpRes,
      fRes,
    ] = await Promise.all([
      supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .neq('pipeline_stage', 'paused'),
      supabase
        .from('content_pieces')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('updated_at', mStart),
      supabase
        .from('deliver_projects')
        .select('*', { count: 'exact', head: true })
        .eq('owner_brand_id', brandId)
        .neq('status', 'completed'),
      supabase
        .from('discovery_feed_items')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('recorded_at', d7),
      supabase
        .from('content_pieces')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('scheduled_at', today),
      supabase
        .from('assets')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId),
      supabase
        .from('contacts')
        .select('*')
        .eq('brand_id', brandId)
        .order('next_follow_up_at', { ascending: true, nullsFirst: false })
        .limit(200),
      supabase
        .from('content_pieces')
        .select('*')
        .eq('brand_id', brandId)
        .order('scheduled_at', { ascending: false })
        .limit(80),
      supabase
        .from('deliver_projects')
        .select('*')
        .eq('owner_brand_id', brandId)
        .order('updated_at', { ascending: false })
        .limit(40),
      supabase
        .from('discovery_feed_items')
        .select('*')
        .eq('brand_id', brandId)
        .gte('recorded_at', d7)
        .order('recorded_at', { ascending: false })
        .limit(20),
    ])

    setMetrics({
      pipeline: pipeRes.error ? null : (pipeRes.count ?? 0),
      contentMonth: contentRes.error ? null : (contentRes.count ?? 0),
      deliverActive: delRes.error ? null : (delRes.count ?? 0),
      discoveryWeek: discRes.error ? null : (discRes.count ?? 0),
      promoUpcoming: promoRes.error ? null : (promoRes.count ?? 0),
      assets: assetRes.error ? null : (assetRes.count ?? 0),
      loading: false,
    })

    if (cRes.error) setError(cRes.error.message)
    else setError(null)

    setContacts((cRes.data ?? []).map((r) => rowToContact(r as Record<string, unknown>)))
    setContentPieces((cpRes.data ?? []) as ContentPiece[])
    setDeliverProjects(
      (dpRes.data ?? []).map((r) =>
        rowRecordToDeliverProject(r as Record<string, unknown>),
      ),
    )
    setFeedItems(
      (fRes.data ?? []).map((r) => {
        const row = r as Record<string, unknown>
        return {
          id: row.id as string,
          brand_id: row.brand_id as string,
          category: row.category as DiscoveryFeedItem['category'],
          title: row.title as string,
          summary: row.summary as string,
          signal_strength: row.signal_strength as DiscoveryFeedItem['signal_strength'],
          recorded_at: row.recorded_at as string,
          archived_at: (row.archived_at as string | null) ?? null,
        }
      }),
    )
    setLoadingExtra(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const loading = metrics.loading || loadingExtra

  return {
    metrics,
    contacts,
    contentPieces,
    deliverProjects,
    feedItems,
    loading,
    error,
    reload,
  }
}

export function contactsDueToday(contacts: Contact[]): Contact[] {
  const t = todayYmdLocal()
  return contacts.filter((c) => {
    if (!c.next_follow_up_at) return false
    try {
      const d = new Date(c.next_follow_up_at)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}` === t
    } catch {
      return false
    }
  })
}

export function contactsOverdue(contacts: Contact[]): Contact[] {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return contacts.filter((c) => {
    if (!c.next_follow_up_at) return false
    if (c.pipeline_stage === 'deal' || c.pipeline_stage === 'paused') return false
    try {
      const d = new Date(c.next_follow_up_at)
      return d.getTime() < todayStart.getTime()
    } catch {
      return false
    }
  })
}

export function contactsThisWeek(contacts: Contact[]): Contact[] {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const in7 = new Date(todayStart)
  in7.setDate(in7.getDate() + 7)
  return contacts.filter((c) => {
    if (!c.next_follow_up_at) return false
    try {
      const d = new Date(c.next_follow_up_at)
      return d.getTime() >= todayStart.getTime() && d.getTime() < in7.getTime()
    } catch {
      return false
    }
  })
}

export function stageHistogram(contacts: Contact[]): Record<string, number> {
  const o: Record<string, number> = {}
  for (const c of contacts) {
    o[c.pipeline_stage] = (o[c.pipeline_stage] ?? 0) + 1
  }
  return o
}

export function useMemoizedNextAndLastPieces(pieces: ContentPiece[]) {
  return useMemo(() => {
    const today = todayYmdLocal()
    const upcoming = [...pieces]
      .filter((p) => p.scheduled_at >= today)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    const published = [...pieces]
      .filter((p) => p.published_at)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    return {
      nextPlanned: upcoming[0] ?? null,
      lastPublished: published[0] ?? null,
    }
  }, [pieces])
}
