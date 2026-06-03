import { useCallback, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import {
  isMissingSupabaseTableError,
  shouldFallbackToLocalSupabase,
  supabaseErrorMessage,
} from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Opportunity, OpportunityProduct, OpportunityStage } from '../types/db'

const STORAGE_KEY = 'opportunities' as const

function rowToOpportunity(row: Record<string, unknown>): Opportunity {
  return {
    id: String(row.id ?? ''),
    contact_id: String(row.contact_id ?? ''),
    product: (row.product as OpportunityProduct) ?? 'herrmann',
    stage: (row.stage as OpportunityStage) ?? 'erstkontakt',
    notes: typeof row.notes === 'string' ? row.notes : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  }
}

function readLocalForContact(contactId: string): Opportunity[] {
  return loadList<Opportunity>([STORAGE_KEY, contactId]).filter((o) => o.contact_id === contactId)
}

function persistLocalForContact(contactId: string, items: Opportunity[]): void {
  saveList([STORAGE_KEY, contactId], items)
}

function isLocalFallbackError(message: string): boolean {
  return isMissingSupabaseTableError(message) || shouldFallbackToLocalSupabase(message)
}

interface UseOpportunitiesResult {
  items: Opportunity[]
  loading: boolean
  error: string | null
  loadByContact: (contactId: string) => Promise<void>
  loadForContacts: (contactIds: string[]) => Promise<void>
  create: (contactId: string, product: OpportunityProduct) => Promise<Opportunity | null>
  updateStage: (id: string, stage: OpportunityStage) => Promise<boolean>
  updateNotes: (id: string, notes: string) => Promise<boolean>
}

export function useOpportunities(): UseOpportunitiesResult {
  const [items, setItems] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const localOnlyRef = useRef(false)

  const applyForContact = useCallback((contactId: string, next: Opportunity[]) => {
    setActiveContactId(contactId)
    setItems(next)
    persistLocalForContact(contactId, next)
  }, [])

  const loadByContact = useCallback(async (contactId: string) => {
    if (!contactId) {
      setItems([])
      return
    }
    setActiveContactId(contactId)
    setLoading(true)

    const localRows = readLocalForContact(contactId)

    if (localOnlyRef.current || !supabase) {
      setItems(localRows)
      setError(null)
      setLoading(false)
      return
    }

    const { data, error: err } = await supabase
      .from('opportunities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true })

    if (err) {
      const msg = supabaseErrorMessage(err)
      if (isLocalFallbackError(msg)) {
        localOnlyRef.current = true
        setItems(localRows)
        setError(null)
      } else {
        setItems(localRows.length > 0 ? localRows : [])
        setError(msg)
      }
      setLoading(false)
      return
    }

    const serverRows = (data ?? []).map((row) => rowToOpportunity(row as Record<string, unknown>))
    const byId = new Map<string, Opportunity>()
    for (const row of serverRows) byId.set(row.id, row)
    for (const row of localRows) {
      if (!byId.has(row.id)) byId.set(row.id, row)
    }
    const merged = Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at))
    applyForContact(contactId, merged)
    setError(null)
    setLoading(false)
  }, [applyForContact])

  const loadForContacts = useCallback(async (contactIds: string[]) => {
    if (contactIds.length === 0) {
      setItems([])
      return
    }
    const localMerged = contactIds.flatMap((id) => readLocalForContact(id))
    if (localOnlyRef.current || !supabase) {
      setItems(localMerged)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('opportunities')
      .select('*')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: true })
    if (err) {
      const msg = supabaseErrorMessage(err)
      if (isLocalFallbackError(msg)) {
        localOnlyRef.current = true
        setError(null)
        setItems(localMerged)
      } else {
        setError(msg)
        setItems(localMerged)
      }
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []).map((row) => rowToOpportunity(row as Record<string, unknown>)))
    setLoading(false)
  }, [])

  const create = useCallback(async (contactId: string, product: OpportunityProduct) => {
    if (!contactId) return null
    const now = new Date().toISOString()
    const optimistic: Opportunity = {
      id: generateId(),
      contact_id: contactId,
      product,
      stage: 'erstkontakt',
      notes: '',
      created_at: now,
      updated_at: now,
    }

    setItems((prev) => {
      const next = [...prev, optimistic]
      persistLocalForContact(contactId, next)
      return next
    })
    setActiveContactId(contactId)
    setError(null)

    if (localOnlyRef.current || !supabase) return optimistic

    const { data, error: err } = await supabase
      .from('opportunities')
      .insert({
        contact_id: contactId,
        product,
        stage: 'erstkontakt',
        updated_at: now,
      })
      .select('*')
      .single()

    if (err) {
      const msg = supabaseErrorMessage(err)
      if (isLocalFallbackError(msg)) {
        localOnlyRef.current = true
        return optimistic
      }
      setItems((prev) => {
        const next = prev.filter((o) => o.id !== optimistic.id)
        persistLocalForContact(contactId, next)
        return next
      })
      setError(msg)
      return null
    }

    const saved = rowToOpportunity(data as Record<string, unknown>)
    setItems((prev) => {
      const next = prev.map((o) => (o.id === optimistic.id ? saved : o))
      persistLocalForContact(contactId, next)
      return next
    })
    return saved
  }, [])

  const updateStage = useCallback(async (id: string, stage: OpportunityStage) => {
    const now = new Date().toISOString()
    let contactId = activeContactId
    let snapshot: Opportunity[] = []

    setItems((prev) => {
      snapshot = prev
      const row = prev.find((o) => o.id === id)
      contactId = contactId ?? row?.contact_id ?? null
      if (!contactId) return prev
      const next = prev.map((o) => (o.id === id ? { ...o, stage, updated_at: now } : o))
      persistLocalForContact(contactId, next)
      return next
    })

    if (!contactId) return false
    setActiveContactId(contactId)
    setError(null)

    if (localOnlyRef.current || !supabase) return true

    const { error: err } = await supabase
      .from('opportunities')
      .update({ stage, updated_at: now })
      .eq('id', id)

    if (err) {
      const msg = supabaseErrorMessage(err)
      if (isLocalFallbackError(msg)) {
        localOnlyRef.current = true
        return true
      }
      setItems(snapshot)
      persistLocalForContact(contactId, snapshot)
      setError(msg)
      return false
    }
    return true
  }, [activeContactId])

  const updateNotes = useCallback(async (id: string, notes: string) => {
    const now = new Date().toISOString()
    let contactId = activeContactId
    let snapshot: Opportunity[] = []

    setItems((prev) => {
      snapshot = prev
      const row = prev.find((o) => o.id === id)
      contactId = contactId ?? row?.contact_id ?? null
      if (!contactId) return prev
      const next = prev.map((o) => (o.id === id ? { ...o, notes, updated_at: now } : o))
      persistLocalForContact(contactId, next)
      return next
    })

    if (!contactId) return false
    setActiveContactId(contactId)
    setError(null)

    if (localOnlyRef.current || !supabase) return true

    const { error: err } = await supabase
      .from('opportunities')
      .update({ notes, updated_at: now })
      .eq('id', id)

    if (err) {
      const msg = supabaseErrorMessage(err)
      if (isLocalFallbackError(msg)) {
        localOnlyRef.current = true
        return true
      }
      setItems(snapshot)
      persistLocalForContact(contactId, snapshot)
      setError(msg)
      return false
    }
    return true
  }, [activeContactId])

  return { items, loading, error, loadByContact, loadForContacts, create, updateStage, updateNotes }
}
