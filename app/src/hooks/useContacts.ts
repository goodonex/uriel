import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type {
  Contact,
  ContactActivityEntry,
  PipelineStage,
  PotenzialTyp,
} from '../types/db'
import { useBrandId } from './useBrandId'

export type CreateContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; duplicate: Contact }

export type CreateContactOptions = {
  /** Wenn true: Duplikat-Check (E-Mail / Name) überspringen */
  skipDuplicateCheck?: boolean
}

function parseActivityLog(raw: unknown): ContactActivityEntry[] {
  if (!Array.isArray(raw)) return []
  const out: ContactActivityEntry[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const text = typeof o.text === 'string' ? o.text : ''
    const at = typeof o.at === 'string' ? o.at : new Date().toISOString()
    if (id && text) out.push({ id, text, at })
  }
  return out
}

function parseCustomFields(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return out
}

function normalizePotenzialTyp(raw: unknown): PotenzialTyp {
  const s = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (s === 'monatlich' || s === 'jährlich' || s === 'jaehrlich') {
    return s === 'monatlich' ? 'monatlich' : 'jährlich'
  }
  return 'einmalig'
}

/** Vor create: gleiche Brand-Liste (items) nach Dubletten durchsuchen */
export function findDuplicateInContacts(
  items: Contact[],
  partial: Partial<Pick<Contact, 'name' | 'email'>>,
): Contact | null {
  const email = (partial.email ?? '').trim().toLowerCase()
  if (email.length > 0) {
    const hit = items.find((c) => (c.email ?? '').trim().toLowerCase() === email)
    if (hit) return hit
  }
  const name = (partial.name ?? '').trim().toLowerCase()
  if (name.length >= 2) {
    const hit = items.find((c) => (c.name ?? '').trim().toLowerCase() === name)
    if (hit) return hit
  }
  return null
}

function normalizeContact(
  c: Partial<Contact> & Pick<Contact, 'id' | 'brand_id'>,
): Contact {
  const now = new Date().toISOString()
  const prob = Number(c.abschluss_wahrscheinlichkeit)
  const clampedProb =
    Number.isFinite(prob) ? Math.max(0, Math.min(100, Math.round(prob))) : 0
  const potRaw = Number(c.potenzial_betrag)
  const potenzial_betrag = Number.isFinite(potRaw) ? Math.max(0, Math.round(potRaw)) : 0
  return {
    id: c.id,
    brand_id: c.brand_id,
    name: c.name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    instagram: c.instagram ?? '',
    linkedin: c.linkedin ?? '',
    company: c.company ?? '',
    source_content_piece_id: c.source_content_piece_id ?? null,
    source_campaign_id: c.source_campaign_id ?? null,
    pipeline_stage: (c.pipeline_stage ?? 'first_contact') as PipelineStage,
    last_contact_at: c.last_contact_at ?? null,
    next_follow_up_at: c.next_follow_up_at ?? null,
    notes: c.notes ?? '',
    call_notes: c.call_notes ?? '',
    activity_log: Array.isArray(c.activity_log)
      ? parseActivityLog(c.activity_log)
      : [],
    bedarf: c.bedarf ?? '',
    ansprechpartner: c.ansprechpartner ?? '',
    aktuelle_situation: c.aktuelle_situation ?? '',
    hauptproblem: c.hauptproblem ?? '',
    timeline: c.timeline ?? '',
    budget: c.budget ?? '',
    ist_entscheider: Boolean(c.ist_entscheider),
    entscheider_name: c.entscheider_name ?? '',
    einwaende: c.einwaende ?? '',
    naechste_schritte: c.naechste_schritte ?? '',
    abschluss_wahrscheinlichkeit: clampedProb,
    potenzial_betrag,
    potenzial_typ: normalizePotenzialTyp(c.potenzial_typ),
    potenzial_notiz: c.potenzial_notiz ?? '',
    custom_fields: parseCustomFields(c.custom_fields),
    updated_at: c.updated_at ?? now,
  }
}

function rowToContact(row: Record<string, unknown>): Contact {
  const probRaw = row.abschluss_wahrscheinlichkeit
  const prob =
    typeof probRaw === 'number'
      ? probRaw
      : typeof probRaw === 'string'
        ? Number(probRaw)
        : 0
  const potRaw = row.potenzial_betrag
  const pot =
    typeof potRaw === 'number' ? potRaw : potRaw != null ? Number(potRaw) : 0
  return normalizeContact({
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string | undefined) ?? '',
    website: (row.website as string | undefined) ?? '',
    instagram: (row.instagram as string | undefined) ?? '',
    linkedin: (row.linkedin as string | undefined) ?? '',
    company: (row.company as string | undefined) ?? '',
    source_content_piece_id: (row.source_content_piece_id as string | null) ?? null,
    source_campaign_id: (row.source_campaign_id as string | null) ?? null,
    pipeline_stage: row.pipeline_stage as PipelineStage,
    last_contact_at: (row.last_contact_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    notes: row.notes as string,
    call_notes: ((row.call_notes as string | undefined) ?? ''),
    activity_log: parseActivityLog(row.activity_log),
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
    abschluss_wahrscheinlichkeit: Number.isFinite(prob) ? prob : 0,
    potenzial_betrag: Number.isFinite(pot) ? Math.max(0, Math.round(pot)) : 0,
    potenzial_typ: normalizePotenzialTyp(row.potenzial_typ),
    potenzial_notiz: (row.potenzial_notiz as string | undefined) ?? '',
    custom_fields: parseCustomFields(row.custom_fields),
    updated_at: row.updated_at as string,
  })
}

function enrichContactFromLocal(
  server: Contact,
  local: Contact | undefined,
): Contact {
  if (!local) return normalizeContact(server)
  const blank = (s: string | null | undefined) => !s || !String(s).trim()
  const cfMerge = { ...server.custom_fields, ...local.custom_fields }
  return normalizeContact({
    ...server,
    name: blank(server.name) ? local.name : server.name,
    email: blank(server.email) ? local.email : server.email,
    phone: blank(server.phone) ? local.phone : server.phone,
    website: blank(server.website) ? local.website : server.website,
    instagram: blank(server.instagram) ? local.instagram : server.instagram,
    linkedin: blank(server.linkedin) ? local.linkedin : server.linkedin,
    company: blank(server.company) ? local.company : server.company,
    notes: blank(server.notes) ? local.notes : server.notes,
    call_notes: blank(server.call_notes) ? local.call_notes : server.call_notes,
    bedarf: blank(server.bedarf) ? local.bedarf : server.bedarf,
    ansprechpartner: blank(server.ansprechpartner) ? local.ansprechpartner : server.ansprechpartner,
    aktuelle_situation: blank(server.aktuelle_situation)
      ? local.aktuelle_situation
      : server.aktuelle_situation,
    hauptproblem: blank(server.hauptproblem) ? local.hauptproblem : server.hauptproblem,
    timeline: blank(server.timeline) ? local.timeline : server.timeline,
    budget: blank(server.budget) ? local.budget : server.budget,
    entscheider_name: blank(server.entscheider_name)
      ? local.entscheider_name
      : server.entscheider_name,
    einwaende: blank(server.einwaende) ? local.einwaende : server.einwaende,
    naechste_schritte: blank(server.naechste_schritte)
      ? local.naechste_schritte
      : server.naechste_schritte,
    potenzial_betrag:
      (server.potenzial_betrag ?? 0) === 0 && (local.potenzial_betrag ?? 0) > 0
        ? local.potenzial_betrag
        : server.potenzial_betrag,
    potenzial_notiz: blank(server.potenzial_notiz) ? local.potenzial_notiz : server.potenzial_notiz,
    custom_fields: cfMerge,
    activity_log:
      server.activity_log.length === 0 && local.activity_log.length > 0
        ? local.activity_log
        : server.activity_log,
    next_follow_up_at: server.next_follow_up_at ?? local.next_follow_up_at,
    last_contact_at: server.last_contact_at ?? local.last_contact_at,
  })
}

function contactToRow(
  c: Contact,
  brandId: string,
): Record<string, unknown> {
  return {
    id: c.id,
    brand_id: brandId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    website: c.website,
    instagram: c.instagram,
    linkedin: c.linkedin,
    company: c.company,
    source_content_piece_id: c.source_content_piece_id,
    source_campaign_id: c.source_campaign_id,
    pipeline_stage: c.pipeline_stage,
    last_contact_at: c.last_contact_at,
    next_follow_up_at: c.next_follow_up_at,
    notes: c.notes,
    call_notes: c.call_notes,
    activity_log: c.activity_log,
    bedarf: c.bedarf,
    ansprechpartner: c.ansprechpartner,
    aktuelle_situation: c.aktuelle_situation,
    hauptproblem: c.hauptproblem,
    timeline: c.timeline,
    budget: c.budget,
    ist_entscheider: c.ist_entscheider,
    entscheider_name: c.entscheider_name,
    einwaende: c.einwaende,
    naechste_schritte: c.naechste_schritte,
    abschluss_wahrscheinlichkeit: c.abschluss_wahrscheinlichkeit,
    potenzial_betrag: c.potenzial_betrag,
    potenzial_typ: c.potenzial_typ,
    potenzial_notiz: c.potenzial_notiz,
    custom_fields: c.custom_fields,
    updated_at: c.updated_at,
  }
}

const STORAGE_KEY = 'contacts' as const

interface UseContactsResult {
  items: Contact[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (
    partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
    options?: CreateContactOptions,
  ) => CreateContactResult
  update: (
    id: string,
    patch: Partial<Omit<Contact, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => void
}

export function readContactsLocal(brandSlug: string): Contact[] {
  const raw = loadList<Partial<Contact> & { id: string; brand_id: string }>([
    brandSlug,
    STORAGE_KEY,
  ])
  return raw.map((r) => normalizeContact(r as Contact))
}

export function useContacts(brandSlug: string | undefined): UseContactsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<Contact[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(readContactsLocal(brandSlug))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: Contact[]) => {
      if (!brandSlug) return
      saveList([brandSlug, STORAGE_KEY], next)
    },
    [brandSlug],
  )

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    if (!supabase || !brandId) {
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('contacts')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useContacts] → localStorage', err.message)
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    if (err) {
      setError(err.message)
      const localRows = readContactsLocal(brandSlug)
      if (localRows.length > 0) {
        console.warn('[useContacts] Supabase-Fehler — zeige localStorage')
        localOnlyRef.current = true
        setItems(localRows)
      } else {
        setItems([])
      }
      setLoading(false)
      return
    }
    const serverRows = (data ?? []).map(rowToContact)
    const localRows = readContactsLocal(brandSlug)

    if (serverRows.length === 0 && localRows.length > 0) {
      console.warn(
        '[useContacts] Supabase liefert 0 Zeilen — nutze localStorage (leere DB / RLS / noch nicht migriert).',
      )
      localOnlyRef.current = true
      setItems(localRows)
      setLoading(false)
      return
    }

    localOnlyRef.current = false
    setError(null)
    const byId = new Map<string, Contact>()
    for (const r of serverRows) {
      const local = localRows.find((l) => l.id === r.id)
      byId.set(r.id, enrichContactFromLocal(r, local))
    }
    for (const l of localRows) {
      if (!byId.has(l.id)) byId.set(l.id, l)
    }
    const merged = Array.from(byId.values()).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    )
    setItems(merged)
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<Contact, 'id' | 'brand_id' | 'updated_at'>>,
      options?: CreateContactOptions,
    ): CreateContactResult => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      if (!options?.skipDuplicateCheck) {
        const dup = findDuplicateInContacts(itemsRef.current, {
          name: partial?.name,
          email: partial?.email,
        })
        if (dup) return { ok: false, duplicate: dup }
      }
      const now = new Date().toISOString()
      const item = normalizeContact({
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        ...partial,
        updated_at: now,
      })
      if (localOnlyRef.current || !supabase || !brandId) {
        const next = [...itemsRef.current, item]
        setItems(next)
        persistLocal(next)
        return { ok: true, contact: item }
      }
      const row = contactToRow(item, brandId)
      setItems([...itemsRef.current, item])
      void supabase.from('contacts').insert(row).then(({ error: insErr }) => {
        if (insErr) {
          if (isMissingSupabaseTableError(insErr.message)) {
            localOnlyRef.current = true
            const next = [...itemsRef.current, item]
            persistLocal(next)
            setItems(next)
          } else {
            setError(insErr.message)
            void reload()
          }
        }
      })
      return { ok: true, contact: item }
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const prev = itemsRef.current.find((c) => c.id === id)
      if (!prev) return
      const basePatch = { ...patch }
      if (patch.custom_fields && prev.custom_fields) {
        basePatch.custom_fields = {
          ...prev.custom_fields,
          ...patch.custom_fields,
        } as Contact['custom_fields']
      }
      const merged = normalizeContact({ ...prev, ...basePatch, updated_at: now })
      const next = itemsRef.current.map((c) => (c.id === id ? merged : c))
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('contacts')
        .update({ ...basePatch, updated_at: now })
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: updErr }) => {
          if (updErr) {
            if (isMissingSupabaseTableError(updErr.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(updErr.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const remove = useCallback(
    (id: string) => {
      if (!brandSlug) return
      const next = itemsRef.current.filter((c) => c.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: delErr }) => {
          if (delErr) {
            if (isMissingSupabaseTableError(delErr.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(delErr.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { items, loading, error, reload, create, update, remove }
}
