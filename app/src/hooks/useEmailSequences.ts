/**
 * useEmailSequences + useEnrollments — Hooks für den Whiteboard-Builder
 * und Lead-Enrollment in Mail-Sequenzen.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type {
  EmailSequence,
  SequenceEnrollment,
  SequenceEnrollmentStatus,
  SequenceNode,
} from '../types/db'
import { useBrandId } from './useBrandId'

function nowIso() {
  return new Date().toISOString()
}

function startNodes(): SequenceNode[] {
  return [
    {
      id: 'start',
      type: 'start',
      position: { x: 100, y: 200 },
      config: { label: 'Start' },
      next: null,
    },
  ]
}

// =========================================================================
// useEmailSequences
// =========================================================================

export interface UseEmailSequencesResult {
  items: EmailSequence[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (input: Partial<EmailSequence> & { name: string }) => Promise<EmailSequence>
  update: (id: string, patch: Partial<EmailSequence>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useEmailSequences(brandSlug: string | undefined): UseEmailSequencesResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<EmailSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    const stored = loadList<EmailSequence>([brandSlug, 'email-sequences'])
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(stored)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('email_sequences')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(stored)
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as EmailSequence[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (input: Partial<EmailSequence> & { name: string }): Promise<EmailSequence> => {
      if (!brandSlug) throw new Error('brand_slug missing')
      const row: EmailSequence = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        name: input.name,
        slug: (input.slug ?? input.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48) || generateId(),
        description: input.description ?? '',
        nodes: input.nodes ?? startNodes(),
        active: input.active ?? false,
        from_email: input.from_email ?? '',
        from_name: input.from_name ?? '',
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      setItems((cur) => [...cur, row])
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<EmailSequence>([brandSlug, 'email-sequences'])
        saveList([brandSlug, 'email-sequences'], [...all, row])
        return row
      }
      const { error: insErr } = await supabase.from('email_sequences').insert({
        id: row.id,
        brand_id: brandId,
        name: row.name,
        slug: row.slug,
        description: row.description,
        nodes: row.nodes,
        active: row.active,
        from_email: row.from_email,
        from_name: row.from_name,
      })
      if (insErr) setError(insErr.message)
      return row
    },
    [brandId, brandSlug],
  )

  const update = useCallback(
    async (id: string, patch: Partial<EmailSequence>) => {
      if (!brandSlug) return
      setItems((cur) =>
        cur.map((s) => (s.id === id ? { ...s, ...patch, updated_at: nowIso() } : s)),
      )
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<EmailSequence>([brandSlug, 'email-sequences'])
        saveList(
          [brandSlug, 'email-sequences'],
          all.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        )
        return
      }
      // updated_at, created_at, brand_id nicht überschreiben
      const dbPatch: Record<string, unknown> = { ...patch }
      delete dbPatch.id
      delete dbPatch.brand_id
      delete dbPatch.created_at
      delete dbPatch.updated_at
      const { error: updErr } = await supabase
        .from('email_sequences')
        .update(dbPatch)
        .eq('id', id)
      if (updErr) setError(updErr.message)
    },
    [brandId, brandSlug],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      setItems((cur) => cur.filter((s) => s.id !== id))
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<EmailSequence>([brandSlug, 'email-sequences'])
        saveList([brandSlug, 'email-sequences'], all.filter((s) => s.id !== id))
        return
      }
      const { error: delErr } = await supabase.from('email_sequences').delete().eq('id', id)
      if (delErr) setError(delErr.message)
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, reload, create, update, remove }
}

// =========================================================================
// useEnrollments
// =========================================================================

export interface UseEnrollmentsResult {
  items: SequenceEnrollment[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  enroll: (sequenceId: string, contactId: string) => Promise<SequenceEnrollment | null>
  setStatus: (id: string, status: SequenceEnrollmentStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useEnrollments(
  brandSlug: string | undefined,
  opts: { contactId?: string; sequenceId?: string } = {},
): UseEnrollmentsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<SequenceEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { contactId, sequenceId } = opts

  const reload = useCallback(async () => {
    if (!brandSlug || !supabase || !brandId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    let q = supabase
      .from('email_sequence_enrollments')
      .select('*')
      .eq('brand_id', brandId)
      .order('started_at', { ascending: false })
    if (contactId) q = q.eq('contact_id', contactId)
    if (sequenceId) q = q.eq('sequence_id', sequenceId)
    const { data, error: err } = await q
    if (err) {
      if (!isMissingSupabaseTableError(err.message)) setError(err.message)
      setLoading(false)
      return
    }
    setItems((data ?? []) as SequenceEnrollment[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, contactId, sequenceId])

  useEffect(() => {
    void reload()
  }, [reload])

  const enroll = useCallback(
    async (sId: string, cId: string): Promise<SequenceEnrollment | null> => {
      if (!supabase || !brandId) return null
      const { data, error: insErr } = await supabase
        .from('email_sequence_enrollments')
        .insert({
          sequence_id: sId,
          contact_id: cId,
          brand_id: brandId,
          status: 'active',
          current_node_id: 'start',
          next_run_at: nowIso(),
        })
        .select('*')
        .maybeSingle()
      if (insErr) {
        setError(insErr.message)
        return null
      }
      await reload()
      return (data as SequenceEnrollment) ?? null
    },
    [brandId, reload],
  )

  const setStatus = useCallback(
    async (id: string, status: SequenceEnrollmentStatus) => {
      if (!supabase) return
      setItems((cur) => cur.map((e) => (e.id === id ? { ...e, status } : e)))
      const { error: updErr } = await supabase
        .from('email_sequence_enrollments')
        .update({ status })
        .eq('id', id)
      if (updErr) setError(updErr.message)
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    if (!supabase) return
    setItems((cur) => cur.filter((e) => e.id !== id))
    const { error: delErr } = await supabase
      .from('email_sequence_enrollments')
      .delete()
      .eq('id', id)
    if (delErr) setError(delErr.message)
  }, [])

  return { items, loading, error, reload, enroll, setStatus, remove }
}
