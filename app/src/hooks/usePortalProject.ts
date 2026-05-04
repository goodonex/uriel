import { useEffect, useState } from 'react'
import {
  findDeliverProjectAcrossLocalStorage,
  rowRecordToDeliverProject,
} from '../lib/deliverProjectCoercion'
import { supabase } from '../lib/supabase'
import type { DeliverProject } from '../types/db'
import type { AppUserRole } from './useAuth'

export interface PortalBrandInfo {
  name: string
  slug: string
  color: string
}

export function usePortalProject(
  projectId: string | undefined,
  opts: {
    preview: boolean
    role: AppUserRole | null
    clientProjectId: string | null
    userId: string | null
  },
) {
  const [project, setProject] = useState<DeliverProject | null>(null)
  const [brand, setBrand] = useState<PortalBrandInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!projectId) {
      setProject(null)
      setBrand(null)
      setLoading(false)
      setError(null)
      return () => {
        cancelled = true
      }
    }

    async function run() {
      setLoading(true)
      setError(null)

      if (!projectId) {
        setLoading(false)
        return
      }

      if (opts.preview) {
        const local = findDeliverProjectAcrossLocalStorage(projectId)
        if (cancelled) return
        if (local) {
          setProject(local.project)
          setBrand({
            name: local.slug,
            slug: local.slug,
            color: 'var(--accent-teal)',
          })
        } else {
          setProject(null)
          setBrand(null)
        }
        setLoading(false)
        return
      }

      if (!supabase) {
        if (!cancelled) {
          setError('Supabase nicht konfiguriert')
          setProject(null)
          setBrand(null)
          setLoading(false)
        }
        return
      }

      if (!opts.userId) {
        if (!cancelled) {
          setProject(null)
          setBrand(null)
          setLoading(false)
        }
        return
      }

      if (
        opts.role === 'client' &&
        opts.clientProjectId &&
        projectId !== opts.clientProjectId
      ) {
        if (!cancelled) {
          setError('Kein Zugriff auf dieses Projekt.')
          setProject(null)
          setBrand(null)
          setLoading(false)
        }
        return
      }

      const { data: row, error: qErr } = await supabase
        .from('deliver_projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()

      if (cancelled) return

      if (qErr) {
        setError(qErr.message)
        setProject(null)
        setBrand(null)
        setLoading(false)
        return
      }

      if (!row) {
        setProject(null)
        setBrand(null)
        setLoading(false)
        return
      }

      const p = rowRecordToDeliverProject(row as Record<string, unknown>)
      setProject(p)

      const brandId = (row as { owner_brand_id: string }).owner_brand_id
      const { data: bRow, error: bErr } = await supabase
        .from('brands')
        .select('name, slug, color')
        .eq('id', brandId)
        .maybeSingle()

      if (cancelled) return

      if (bErr || !bRow) {
        setBrand(null)
      } else {
        setBrand({
          name: String(bRow.name ?? ''),
          slug: String(bRow.slug ?? ''),
          color: String(bRow.color ?? 'var(--accent-teal)'),
        })
      }
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    projectId,
    opts.preview,
    opts.role,
    opts.clientProjectId,
    opts.userId,
  ])

  return { project, brand, loading, error }
}
