import { useCallback, useEffect, useState } from 'react'
import { generateId, loadOne, saveOne } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { SalesFieldItem } from '../types/db'
import { useBrandId } from './useBrandId'

const LS_PREFIX = 'sales-field-config' as const

function sortFields(fs: SalesFieldItem[]): SalesFieldItem[] {
  return [...fs].sort((a, b) => a.order - b.order)
}

export function defaultErstgespraechFields(): SalesFieldItem[] {
  return [
    {
      id: 'f-bedarf',
      label: 'Was brauchen sie? (Leads, Website, Branding …)',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 0,
      db_key: 'bedarf',
    },
    {
      id: 'f-ansprech',
      label: 'Wer ist der richtige Ansprechpartner?',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 1,
      db_key: 'ansprechpartner',
    },
    {
      id: 'f-aktuell',
      label: 'Wie machen sie es gerade?',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 2,
      db_key: 'aktuelle_situation',
    },
    {
      id: 'f-problem',
      label: 'Was ist ihr größtes Problem?',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 3,
      db_key: 'hauptproblem',
    },
    {
      id: 'f-timeline',
      label: 'Wann wollen sie starten?',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 4,
      db_key: 'timeline',
    },
  ]
}

export function defaultQualifikationFields(): SalesFieldItem[] {
  return [
    {
      id: 'f-budget',
      label: 'Budget',
      placeholder: 'Was ist ihr Budget?',
      type: 'textarea',
      required: false,
      order: 0,
      db_key: 'budget',
    },
    {
      id: 'f-entscheider',
      label: 'Ist Entscheider',
      placeholder: '',
      type: 'toggle',
      required: false,
      order: 1,
      db_key: 'ist_entscheider',
    },
    {
      id: 'f-en-name',
      label: 'Entscheider-Name',
      placeholder: '',
      type: 'text',
      required: false,
      order: 2,
      db_key: 'entscheider_name',
    },
    {
      id: 'f-einwaende',
      label: 'Einwände',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 3,
      db_key: 'einwaende',
    },
    {
      id: 'f-schritte',
      label: 'Nächste Schritte',
      placeholder: '',
      type: 'textarea',
      required: false,
      order: 4,
      db_key: 'naechste_schritte',
    },
    {
      id: 'f-wkeit',
      label: 'Abschlusswahrscheinlichkeit (%)',
      placeholder: '0–100',
      type: 'number',
      required: false,
      order: 5,
      db_key: 'abschluss_wahrscheinlichkeit',
    },
  ]
}

export function getDefaultFieldsForTab(
  tab: 'erstgespraech' | 'qualifikation',
): SalesFieldItem[] {
  return sortFields(
    tab === 'erstgespraech' ? defaultErstgespraechFields() : defaultQualifikationFields(),
  )
}

function parseFieldsJson(raw: unknown): SalesFieldItem[] | null {
  if (!Array.isArray(raw)) return null
  const out: SalesFieldItem[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const label = typeof o.label === 'string' ? o.label : ''
    const db_key = typeof o.db_key === 'string' ? o.db_key : ''
    const type =
      o.type === 'textarea' || o.type === 'text' || o.type === 'number' || o.type === 'toggle'
        ? o.type
        : 'text'
    if (!id || !db_key) continue
    out.push({
      id,
      label,
      placeholder: typeof o.placeholder === 'string' ? o.placeholder : '',
      type,
      required: Boolean(o.required),
      order: typeof o.order === 'number' ? o.order : out.length,
      db_key,
    })
  }
  return out.length > 0 ? sortFields(out) : null
}

export const KNOWN_CONTACT_DB_KEYS = new Set<string>([
  'bedarf',
  'ansprechpartner',
  'aktuelle_situation',
  'hauptproblem',
  'timeline',
  'budget',
  'ist_entscheider',
  'entscheider_name',
  'einwaende',
  'naechste_schritte',
  'abschluss_wahrscheinlichkeit',
])

export function useContactFieldConfig(
  brandSlug: string | undefined,
  tab: 'erstgespraech' | 'qualifikation',
) {
  const brandId = useBrandId(brandSlug)

  const [fields, setFields] = useState<SalesFieldItem[]>(() =>
    getDefaultFieldsForTab(tab),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowId, setRowId] = useState<string | null>(null)

  const persistLocal = useCallback(
    (next: SalesFieldItem[]) => {
      if (!brandSlug) return
      saveOne([brandSlug, LS_PREFIX, tab], { fields: next })
    },
    [brandSlug, tab],
  )

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    const raw = loadOne<{ fields?: unknown }>([brandSlug, LS_PREFIX, tab])
    const parsed = parseFieldsJson(raw?.fields)
    setFields(sortFields(parsed ?? getDefaultFieldsForTab(tab)))
    setRowId(null)
    setError(null)
  }, [brandSlug, tab])

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setFields(getDefaultFieldsForTab(tab))
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('sales_field_configs')
      .select('*')
      .eq('brand_id', brandId)
      .eq('tab', tab)
      .maybeSingle()

    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        loadLocal()
        setError(null)
      } else {
        setError(err.message)
        loadLocal()
      }
      setLoading(false)
      return
    }
    if (!data) {
      setFields(getDefaultFieldsForTab(tab))
      setRowId(null)
      setError(null)
      setLoading(false)
      return
    }
    const parsed = parseFieldsJson((data as { fields?: unknown }).fields)
    setFields(sortFields(parsed ?? getDefaultFieldsForTab(tab)))
    setRowId((data as { id: string }).id)
    setError(null)
    setLoading(false)
  }, [brandId, brandSlug, loadLocal, tab])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveFields = useCallback(
    async (next: SalesFieldItem[]) => {
      const sorted = sortFields(next.map((f, i) => ({ ...f, order: i })))
      setFields(sorted)
      if (!brandSlug) return
      if (!supabase || !brandId) {
        persistLocal(sorted)
        return
      }
      const now = new Date().toISOString()
      if (rowId) {
        const { error: upErr } = await supabase
          .from('sales_field_configs')
          .update({ fields: sorted, updated_at: now })
          .eq('id', rowId)
          .eq('brand_id', brandId)
        if (upErr && !isMissingSupabaseTableError(upErr.message)) {
          setError(upErr.message)
          return
        }
        if (upErr) {
          persistLocal(sorted)
          return
        }
      } else {
        const id = generateId()
        const { error: insErr } = await supabase.from('sales_field_configs').insert({
          id,
          brand_id: brandId,
          tab,
          fields: sorted,
          created_at: now,
          updated_at: now,
        })
        if (insErr && !isMissingSupabaseTableError(insErr.message)) {
          setError(insErr.message)
          return
        }
        if (insErr) {
          persistLocal(sorted)
          return
        }
        setRowId(id)
      }
      setError(null)
    },
    [brandId, brandSlug, persistLocal, rowId, tab],
  )

  const resetToDefaults = useCallback(() => {
    void saveFields(getDefaultFieldsForTab(tab))
  }, [saveFields, tab])

  return {
    fields,
    loading,
    error,
    reload,
    saveFields,
    resetToDefaults,
    defaultFields: getDefaultFieldsForTab(tab),
  }
}
