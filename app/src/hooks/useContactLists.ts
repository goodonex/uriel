import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import {
  isMissingSupabaseTableError,
  shouldFallbackToLocalSupabase,
  supabaseErrorMessage,
} from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { Contact, ContactList, ContactListItem, ContactListItemStatus } from '../types/db'
import { useBrandId } from './useBrandId'

const LISTS_KEY = 'contact-lists-store' as const

function rowToList(row: Record<string, unknown>): ContactList {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  }
}

function rowToItem(row: Record<string, unknown>): ContactListItem {
  const st = row.status as string
  const status: ContactListItemStatus =
    st === 'angerufen' || st === 'kein_interesse' || st === 'in_pipeline' || st === 'offen'
      ? st
      : 'offen'
  return {
    id: row.id as string,
    list_id: row.list_id as string,
    name: (row.name as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    company: (row.company as string) ?? '',
    linkedin_url: (row.linkedin_url as string) ?? '',
    notes: (row.notes as string) ?? '',
    status,
    called_at: (row.called_at as string | null) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  }
}

function shouldUseLocalLists(brandSlug: string | undefined, brandId: string | null): boolean {
  return !brandSlug || !supabase || !brandId
}

export function useContactLists(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listsRef = useRef<ContactList[]>([])
  listsRef.current = lists

  const persistLocal = useCallback(
   (next: ContactList[]) => {
      if (!brandSlug) return
      saveList([brandSlug, LISTS_KEY], next)
    },
    [brandSlug],
  )

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setLists(loadList<ContactList>([brandSlug, LISTS_KEY]))
    setError(null)
  }, [brandSlug])

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setLists([])
      setLoading(false)
      setError(null)
      return
    }
    if (shouldUseLocalLists(brandSlug, brandId)) {
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase!
      .from('contact_lists')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (err) {
      if (
        isMissingSupabaseTableError(err.message) ||
        shouldFallbackToLocalSupabase(err.message)
      ) {
        loadLocal()
        setError(null)
      } else {
        setError(err.message)
        setLists([])
      }
      setLoading(false)
      return
    }
    setLists((data ?? []).map((r) => rowToList(r as Record<string, unknown>)))
    setError(null)
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const createList = useCallback(
    async (partial: { name: string; description?: string }) => {
      if (!brandSlug) throw new Error('Kein Brand')
      const name = partial.name.trim() || 'Neue Liste'
      const description = partial.description?.trim() ? partial.description.trim() : null
      const pushLocal = (id: string) => {
        const row: ContactList = {
          id,
          brand_id: brandSlug,
          name,
          description,
          created_at: new Date().toISOString(),
        }
        const next = [...listsRef.current, row]
        setLists(next)
        persistLocal(next)
        return id
      }
      if (!supabase || !brandId) {
        return pushLocal(generateId())
      }
      const id = generateId()
      const { error: insErr } = await supabase.from('contact_lists').insert({
        id,
        brand_id: brandId,
        name,
        description,
      })
      if (insErr) {
        const msg = supabaseErrorMessage(insErr)
        if (shouldFallbackToLocalSupabase(msg)) return pushLocal(id)
        throw insErr
      }
      await reload()
      return id
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const updateListMeta = useCallback(
    async (listId: string, patch: { name?: string; description?: string | null }) => {
      if (!brandSlug) return
      if (!supabase || !brandId) {
        const next = listsRef.current.map((l) => (l.id === listId ? { ...l, ...patch } : l))
        setLists(next)
        persistLocal(next)
        return
      }
      const { error: err } = await supabase
        .from('contact_lists')
        .update(patch)
        .eq('id', listId)
        .eq('brand_id', brandId)
      if (err) {
        const msg = supabaseErrorMessage(err)
        if (shouldFallbackToLocalSupabase(msg)) {
          const next = listsRef.current.map((l) => (l.id === listId ? { ...l, ...patch } : l))
          setLists(next)
          persistLocal(next)
          return
        }
        throw err
      }
      await reload()
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { lists, loading, error, reload, createList, updateListMeta }
}

const ITEMS_PREFIX = 'contact-list-items' as const

export function useContactListItems(listId: string | undefined, brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ContactListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ContactListItem[]>([])
  itemsRef.current = items

  const persistItemsLocal = useCallback(
    (rows: ContactListItem[]) => {
      if (!brandSlug || !listId) return
      saveList([brandSlug, ITEMS_PREFIX, listId], rows)
    },
    [brandSlug, listId],
  )

  const loadItemsLocal = useCallback(() => {
    if (!brandSlug || !listId) return
    setItems(loadList<ContactListItem>([brandSlug, ITEMS_PREFIX, listId]))
  }, [brandSlug, listId])

  const reload = useCallback(async () => {
    if (!listId || !brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      loadItemsLocal()
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('contact_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })

    if (err) {
      if (
        isMissingSupabaseTableError(err.message) ||
        shouldFallbackToLocalSupabase(err.message)
      ) {
        loadItemsLocal()
        setError(null)
      } else {
        setError(err.message)
        setItems([])
      }
      setLoading(false)
      return
    }
    setItems((data ?? []).map((r) => rowToItem(r as Record<string, unknown>)))
    setError(null)
    setLoading(false)
  }, [listId, brandId, brandSlug, loadItemsLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const insertRows = useCallback(
    async (
      rows: Array<{
        name?: string
        email?: string
        phone?: string
        company?: string
        linkedin_url?: string
        notes?: string
      }>,
    ) => {
      if (!listId || rows.length === 0) return
      const now = new Date().toISOString()
      if (!supabase || !brandId) {
        const next = [
          ...itemsRef.current,
          ...rows.map((r) => ({
            id: generateId(),
            list_id: listId,
            name: r.name ?? '',
            email: r.email ?? '',
            phone: r.phone ?? '',
            company: r.company ?? '',
            linkedin_url: r.linkedin_url ?? '',
            notes: r.notes ?? '',
            status: 'offen' as const,
            called_at: null,
            created_at: now,
          })),
        ]
        setItems(next)
        persistItemsLocal(next)
        return
      }
      const payload = rows.map((r) => ({
        id: generateId(),
        list_id: listId,
        name: r.name ?? '',
        email: r.email ?? '',
        phone: r.phone ?? '',
        company: r.company ?? '',
        linkedin_url: r.linkedin_url ?? '',
        notes: r.notes ?? '',
        status: 'offen' as const,
      }))
      const { error: err } = await supabase.from('contact_list_items').insert(payload)
      if (err) {
        const msg = supabaseErrorMessage(err)
        if (shouldFallbackToLocalSupabase(msg)) {
          const next = [
            ...itemsRef.current,
            ...rows.map((r) => ({
              id: generateId(),
              list_id: listId,
              name: r.name ?? '',
              email: r.email ?? '',
              phone: r.phone ?? '',
              company: r.company ?? '',
              linkedin_url: r.linkedin_url ?? '',
              notes: r.notes ?? '',
              status: 'offen' as const,
              called_at: null,
              created_at: now,
            })),
          ]
          setItems(next)
          persistItemsLocal(next)
          return
        }
        throw err
      }
      await reload()
    },
    [brandId, listId, persistItemsLocal, reload],
  )

  const updateItem = useCallback(
    async (itemId: string, patch: Partial<ContactListItem>) => {
      if (!listId) return
      if (!supabase || !brandId) {
        const next = itemsRef.current.map((it) =>
          it.id === itemId ? { ...it, ...patch } : it,
        )
        setItems(next)
        persistItemsLocal(next)
        return
      }
      const clean: Record<string, unknown> = {}
      if (patch.name !== undefined) clean.name = patch.name
      if (patch.email !== undefined) clean.email = patch.email
      if (patch.phone !== undefined) clean.phone = patch.phone
      if (patch.company !== undefined) clean.company = patch.company
      if (patch.linkedin_url !== undefined) clean.linkedin_url = patch.linkedin_url
      if (patch.notes !== undefined) clean.notes = patch.notes
      if (patch.status !== undefined) clean.status = patch.status
      if (patch.called_at !== undefined) clean.called_at = patch.called_at

      const { error: err } = await supabase
        .from('contact_list_items')
        .update(clean)
        .eq('id', itemId)
        .eq('list_id', listId)
      if (err) {
        const msg = supabaseErrorMessage(err)
        if (shouldFallbackToLocalSupabase(msg)) {
          const next = itemsRef.current.map((it) =>
            it.id === itemId ? { ...it, ...patch } : it,
          )
          setItems(next)
          persistItemsLocal(next)
          return
        }
        throw err
      }
      await reload()
    },
    [brandId, listId, persistItemsLocal, reload],
  )

  return { items, loading, error, reload, insertRows, updateItem }
}

/** Listen-IDs, in denen der Kontakt (per E-Mail) bereits vorkommt. */
export async function findListIdsForContact(
  brandSlug: string | undefined,
  brandId: string | null,
  contact: Contact,
): Promise<string[]> {
  if (!brandSlug) return []
  const email = (contact.email ?? '').trim().toLowerCase()
  if (!email) return []

  if (supabase && brandId) {
    const { data: listRows } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('brand_id', brandId)
    const listIds = (listRows ?? []).map((r) => r.id as string)
    if (listIds.length === 0) return []

    const { data, error } = await supabase
      .from('contact_list_items')
      .select('list_id, email')
      .in('list_id', listIds)

    if (!error && data) {
      return [
        ...new Set(
          (data as { list_id: string; email: string | null }[])
            .filter((row) => (row.email ?? '').trim().toLowerCase() === email)
            .map((row) => row.list_id),
        ),
      ]
    }
  }

  const lists = loadList<ContactList>([brandSlug, LISTS_KEY])
  const out: string[] = []
  for (const list of lists) {
    const items = loadList<ContactListItem>([brandSlug, ITEMS_PREFIX, list.id])
    if (items.some((it) => (it.email ?? '').trim().toLowerCase() === email)) {
      out.push(list.id)
    }
  }
  return out
}

/** Kontakt als Listeneintrag anlegen (gleiche E-Mail = kein Duplikat in derselben Liste). */
export async function addContactToList(
  brandSlug: string,
  listId: string,
  contact: Contact,
  extraNotes?: string,
): Promise<void> {
  const email = (contact.email ?? '').trim().toLowerCase()
  const items = loadList<ContactListItem>([brandSlug, ITEMS_PREFIX, listId])
  if (email && items.some((it) => (it.email ?? '').trim().toLowerCase() === email)) {
    return
  }

  const row = {
    name: contact.name || contact.email || 'Kontakt',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    company: contact.company ?? '',
    linkedin_url: contact.linkedin ?? '',
    notes: extraNotes?.trim() || contact.notes?.trim() || '',
  }

  const now = new Date().toISOString()

  if (!supabase) {
    const next = [
      ...items,
      {
        id: generateId(),
        list_id: listId,
        ...row,
        status: 'offen' as const,
        called_at: null,
        created_at: now,
      },
    ]
    saveList([brandSlug, ITEMS_PREFIX, listId], next)
    return
  }

  const { error } = await supabase.from('contact_list_items').insert({
    id: generateId(),
    list_id: listId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    linkedin_url: row.linkedin_url,
    notes: row.notes,
    status: 'offen',
  })
  if (error) {
    const msg = supabaseErrorMessage(error)
    if (!shouldFallbackToLocalSupabase(msg)) throw error
    const next = [
      ...items,
      {
        id: generateId(),
        list_id: listId,
        ...row,
        status: 'offen' as const,
        called_at: null,
        created_at: now,
      },
    ]
    saveList([brandSlug, ITEMS_PREFIX, listId], next)
  }
}

export const LIST_PRESETS: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'High Potentials', description: 'Warme Leads — später Batch anrufen' },
  { name: 'Gerade gesprochen', description: 'Heute kontaktiert — Follow-up später' },
  { name: 'Messe / Event', description: 'Herkunft: Veranstaltung' },
  { name: 'Inbound', description: 'Website, Formular, Ads' },
  { name: 'Empfehlungen', description: 'Referrals & Netzwerk' },
  { name: 'Kaltakquise', description: 'Outbound-Liste' },
]
