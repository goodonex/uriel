import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Contact, PortalLeadStatus } from '../types/db'
import { useBrandId } from './useBrandId'

function rowToContact(row: Record<string, unknown>): Contact {
  return row as unknown as Contact
}

export function useProjectLeads(
  brandSlug: string | undefined,
  projectId: string | undefined,
  clientContactId: string | null,
) {
  const brandId = useBrandId(brandSlug)
  const [leads, setLeads] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!brandId || !projectId || !supabase) {
      setLeads([])
      setLoading(false)
      return
    }
    setLoading(true)

    const { data: assigned, error: err1 } = await supabase
      .from('contacts')
      .select('*')
      .eq('brand_id', brandId)
      .eq('deliver_project_id', projectId)
      .order('created_at', { ascending: false })

    let rows = assigned ?? []

    if (clientContactId) {
      const { data: primary } = await supabase
        .from('contacts')
        .select('*')
        .eq('brand_id', brandId)
        .eq('id', clientContactId)
        .maybeSingle()
      if (primary && !rows.some((r) => r.id === primary.id)) {
        rows = [primary, ...rows]
      }
    }

    if (err1) {
      setError(err1.message)
      setLeads([])
    } else {
      setError(null)
      setLeads(rows.map((r) => rowToContact(r as Record<string, unknown>)))
    }
    setLoading(false)
  }, [brandId, clientContactId, projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const assignLead = useCallback(
    async (contactId: string) => {
      if (!brandId || !projectId || !supabase) return false
      const { error: err } = await supabase
        .from('contacts')
        .update({ deliver_project_id: projectId, updated_at: new Date().toISOString() })
        .eq('id', contactId)
        .eq('brand_id', brandId)
      if (err) {
        setError(err.message)
        return false
      }
      await reload()
      return true
    },
    [brandId, projectId, reload],
  )

  const unassignLead = useCallback(
    async (contactId: string) => {
      if (!brandId || !projectId || !supabase) return false
      const { error: err } = await supabase
        .from('contacts')
        .update({ deliver_project_id: null, updated_at: new Date().toISOString() })
        .eq('id', contactId)
        .eq('brand_id', brandId)
        .eq('deliver_project_id', projectId)
      if (err) {
        setError(err.message)
        return false
      }
      await reload()
      return true
    },
    [brandId, projectId, reload],
  )

  return { leads, loading, error, reload, assignLead, unassignLead }
}

export function usePortalLeads(projectId: string | undefined) {
  const [leads, setLeads] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!projectId || !supabase) {
      setLeads([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('contacts')
      .select(
        'id, name, email, phone, lead_source, created_at, portal_lead_status, portal_notes, deliver_project_id',
      )
      .eq('deliver_project_id', projectId)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLeads([])
    } else {
      setError(null)
      setLeads((data ?? []) as Contact[])
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateStatus = useCallback(
    async (contactId: string, status: PortalLeadStatus) => {
      if (!projectId || !supabase) return false
      const { error: err } = await supabase
        .from('contacts')
        .update({ portal_lead_status: status, updated_at: new Date().toISOString() })
        .eq('id', contactId)
        .eq('deliver_project_id', projectId)
      if (err) {
        setError(err.message)
        return false
      }
      setLeads((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, portal_lead_status: status } : c)),
      )
      return true
    },
    [projectId],
  )

  const updateNotes = useCallback(
    async (contactId: string, notes: string) => {
      if (!projectId || !supabase) return false
      const { error: err } = await supabase
        .from('contacts')
        .update({ portal_notes: notes.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', contactId)
        .eq('deliver_project_id', projectId)
      if (err) {
        setError(err.message)
        return false
      }
      setLeads((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, portal_notes: notes.trim() || null } : c)),
      )
      return true
    },
    [projectId],
  )

  return { leads, loading, error, reload, updateStatus, updateNotes }
}
