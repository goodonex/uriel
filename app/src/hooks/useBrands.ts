import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brand, ICP, Positioning, WordBankEntry } from '../types/db'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { isLocalFallbackBrandId } from '../lib/brandResolve'
import { generateId, loadOne, saveList, saveOne } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULT_BRANDS: Omit<Brand, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Herrmann & Co.', slug: 'herrmann', color: 'var(--accent-blue)' },
  { name: 'Wertavio', slug: 'wertavio', color: '#C8A97A' },
  { name: 'Culturefit', slug: 'culturefit', color: 'var(--accent-ember)' },
  { name: 'Eversmell', slug: 'eversmell', color: '#F5C518' },
  { name: 'Homeflower', slug: 'homeflower', color: 'var(--accent-teal)' },
]

/** Wenn die DB-Migrationen noch nicht laufen: gleiche Slugs wie später in Supabase, damit Navigation stimmt. */
const FALLBACK_BRANDS: Brand[] = [
  {
    id: 'local-fallback-herrmann',
    user_id: null,
    name: 'Herrmann & Co.',
    slug: 'herrmann',
    color: 'var(--accent-blue)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-wertavio',
    user_id: null,
    name: 'Wertavio',
    slug: 'wertavio',
    color: '#C8A97A',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-culturefit',
    user_id: null,
    name: 'Culturefit',
    slug: 'culturefit',
    color: 'var(--accent-ember)',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-eversmell',
    user_id: null,
    name: 'Eversmell',
    slug: 'eversmell',
    color: '#F5C518',
    created_at: new Date().toISOString(),
  },
  {
    id: 'local-fallback-homeflower',
    user_id: null,
    name: 'Homeflower',
    slug: 'homeflower',
    color: 'var(--accent-teal)',
    created_at: new Date().toISOString(),
  },
]

const WERTAVIO_SLUG = 'wertavio' as const

/** Erhöhen, wenn sich die Startwerte ändern — triggert erneutes Schreiben von localStorage + ggf. DB-Leerstand. */
const WERTAVIO_SEED_VERSION = 2

const WERTAVIO_LS_SENTINEL = 'wertavio-foundation-seed' as const

const WERTAVIO_POSITIONING_STATEMENT =
  'Wertavio verbindet Immobilieneigentümer kostenlos mit dem passenden Makler aus einem kuratierten Netzwerk spezialisierter Profis. Nicht Masse — sondern Match.'

const WERTAVIO_TONE_OF_VOICE =
  'Vertrauensvoll, klar, persönlich. Kein Immobilien-Slang. Kurze Sätze. Konkrete Aussagen. Wir nehmen dem Eigentümer die Unsicherheit.'

const WERTAVIO_BUSINESS_MODEL: NonNullable<Positioning['business_model']> = {
  who: 'Wertavio',
  what: 'Makler-Matching für Eigentümer',
  how: 'kuratiertes Netzwerk + Ads',
  for_whom: 'Eigentümer die verkaufen wollen',
  revenue: 'Makler-Abo 750€/Monat + Setup',
}

function buildWertavioPositioningDoc(brandKey: string, now: string): Positioning {
  return {
    id: generateId(),
    brand_id: brandKey,
    statement: WERTAVIO_POSITIONING_STATEMENT,
    tone_of_voice: WERTAVIO_TONE_OF_VOICE,
    business_model: WERTAVIO_BUSINESS_MODEL,
    updated_at: now,
  }
}

function buildWertavioIcps(brandKey: string, now: string): ICP[] {
  return [
    {
      id: generateId(),
      brand_id: brandKey,
      name: 'Urban Eigentümer',
      age_range: '45–70',
      location: 'Deutschland',
      pain_points: ['Welchem Makler kann ich vertrauen?'],
      word_clusters: [],
      priority: 1,
      notes: '',
      updated_at: now,
    },
    {
      id: generateId(),
      brand_id: brandKey,
      name: 'Wachstums-Makler',
      age_range: '30–52',
      location: 'Deutschland',
      pain_points: ['Keine verlässliche Lead-Quelle'],
      word_clusters: [],
      priority: 2,
      notes: '',
      updated_at: now,
    },
  ]
}

function buildWertavioWordBank(brandKey: string, now: string): WordBankEntry[] {
  const yesWords = [
    'Vertrauen',
    'passend',
    'geprüft',
    'kostenlos',
    'Spezialist',
    'bester Preis',
    'unkompliziert',
    'Pipeline',
    'planbar',
    'exklusiv',
  ]
  const noWords = [
    'Masse',
    'Portal',
    'Datenbank',
    'irgendein Makler',
    'günstig',
    'revolutionär',
    'Spam',
  ]
  return [
    ...yesWords.map((word) => ({
      id: generateId(),
      brand_id: brandKey,
      word,
      type: 'yes' as const,
      cluster: 'Wertavio',
      updated_at: now,
    })),
    ...noWords.map((word) => ({
      id: generateId(),
      brand_id: brandKey,
      word,
      type: 'no' as const,
      cluster: 'Wertavio',
      updated_at: now,
    })),
  ]
}

/**
 * localStorage unter `brand-os:wertavio:*` — gleiche Keys wie usePositioning / useICPs / useWordBank.
 * Supabase-Nutzer sehen Building über DB; dafür `seedWertavioFoundationSupabase` (falls Tabellen leer).
 */
function seedWertavioLocalStorage(): void {
  if (typeof window === 'undefined') return

  const mark = loadOne<{ v: number }>([WERTAVIO_SLUG, WERTAVIO_LS_SENTINEL])
  if (mark?.v === WERTAVIO_SEED_VERSION) return

  const now = new Date().toISOString()
  const key = WERTAVIO_SLUG

  const prevPos = loadOne<Positioning>([key, 'positioning'])
  const doc = buildWertavioPositioningDoc(key, now)
  doc.id = prevPos?.id ?? doc.id
  saveOne([key, 'positioning'], doc)

  saveList([key, 'icps'], buildWertavioIcps(key, now))
  saveList([key, 'word-bank'], buildWertavioWordBank(key, now))

  saveOne([WERTAVIO_SLUG, WERTAVIO_LS_SENTINEL], {
    v: WERTAVIO_SEED_VERSION,
    at: now,
  })
}

/** Foundation-Tabellen in Supabase, nur wenn noch keine Inhalte (damit Building mit aktivem Supabase gefüllt ist). */
async function seedWertavioFoundationSupabase(brandId: string): Promise<void> {
  if (!supabase) return

  const { data: pos, error: posErr } = await supabase
    .from('foundation_positioning')
    .select('id, statement')
    .eq('brand_id', brandId)
    .maybeSingle()

  if (posErr && isMissingSupabaseTableError(posErr.message)) return
  if (posErr) {
    console.warn('[useBrands] Wertavio foundation_positioning:', posErr.message)
    return
  }

  if (!pos?.statement?.trim()) {
    const now = new Date().toISOString()
    const row = {
      id: pos?.id ?? generateId(),
      brand_id: brandId,
      statement: WERTAVIO_POSITIONING_STATEMENT,
      tone_of_voice: WERTAVIO_TONE_OF_VOICE,
      business_model: WERTAVIO_BUSINESS_MODEL,
      updated_at: now,
    }
    const { error: upErr } = await supabase
      .from('foundation_positioning')
      .upsert(row, { onConflict: 'brand_id' })
    if (upErr && !isMissingSupabaseTableError(upErr.message)) {
      console.warn('[useBrands] Wertavio positioning upsert:', upErr.message)
    }
  }

  const { count: icpCount, error: icpCountErr } = await supabase
    .from('foundation_icps')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)

  if (icpCountErr && isMissingSupabaseTableError(icpCountErr.message)) return
  if (!icpCountErr && (icpCount ?? 0) === 0) {
    const now = new Date().toISOString()
    const rows = buildWertavioIcps(brandId, now).map((r) => ({
      brand_id: brandId,
      name: r.name,
      age_range: r.age_range,
      location: r.location,
      pain_points: r.pain_points,
      word_clusters: r.word_clusters,
      priority: r.priority,
      notes: r.notes,
      updated_at: now,
    }))
    const { error: insIcp } = await supabase.from('foundation_icps').insert(rows)
    if (insIcp && !isMissingSupabaseTableError(insIcp.message)) {
      console.warn('[useBrands] Wertavio icps insert:', insIcp.message)
    }
  }

  const { count: wbCount, error: wbCountErr } = await supabase
    .from('foundation_word_bank')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)

  if (wbCountErr && isMissingSupabaseTableError(wbCountErr.message)) return
  if (!wbCountErr && (wbCount ?? 0) === 0) {
    const now = new Date().toISOString()
    const rows = buildWertavioWordBank(brandId, now).map((r) => ({
      brand_id: brandId,
      word: r.word,
      type: r.type,
      cluster: r.cluster,
      updated_at: now,
    }))
    const { error: insWb } = await supabase.from('foundation_word_bank').insert(rows)
    if (insWb && !isMissingSupabaseTableError(insWb.message)) {
      console.warn('[useBrands] Wertavio word_bank insert:', insWb.message)
    }
  }
}

interface UseBrandsResult {
  brands: Brand[]
  loading: boolean
  error: string | null
  /** Explizit neu laden (z. B. nach Seed). */
  reload: () => Promise<void>
}

function mapBrand(row: {
  id: string
  user_id: string | null
  name: string
  slug: string
  color: string | null
  created_at: string
}): Brand {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    slug: row.slug,
    color: row.color ?? '',
    created_at: row.created_at,
  }
}

/** Header + 3D-Nodes: Homeflower zuletzt (rechts); unbekannte Slugs ans Ende. */
const BRAND_DISPLAY_ORDER = [
  'herrmann',
  'wertavio',
  'culturefit',
  'eversmell',
  'homeflower',
] as const

function sortBrandsForDisplay(brands: Brand[]): Brand[] {
  const rank = (slug: string) => {
    const i = (BRAND_DISPLAY_ORDER as readonly string[]).indexOf(slug)
    return i === -1 ? 999 : i
  }
  return [...brands].sort(
    (a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name),
  )
}

/**
 * Bestehende Supabase-Zeilen an die aktuellen Default-Slugs anpassen (einmal pro Reload, wenn nötig).
 * Damit wirken Änderungen an DEFAULT_BRANDS auch, wenn die Tabelle schon ältere Seeds hat.
 */
async function syncCanonicalBrandsForUser(
  userId: string,
  rows: Array<{
    id: string
    user_id: string | null
    name: string
    slug: string
    color: string | null
    created_at: string
  }>,
): Promise<boolean> {
  if (!supabase) return false

  const mine = rows.filter((r) => r.user_id === userId)
  const bySlug = (slug: string) => mine.find((r) => r.slug === slug)

  let changed = false

  const offmarket = bySlug('offmarketbude')
  const wertavio = bySlug('wertavio')

  if (offmarket && !wertavio) {
    const { error } = await supabase
      .from('brands')
      .update({
        name: 'Wertavio',
        slug: 'wertavio',
        color: '#C8A97A',
      })
      .eq('id', offmarket.id)
      .eq('user_id', userId)
    if (!error) changed = true
  }

  const eversmell = bySlug('eversmell')
  const culturefit = bySlug('culturefit')
  if (!culturefit) {
    const { error } = await supabase.from('brands').insert({
      user_id: userId,
      name: 'Culturefit',
      slug: 'culturefit',
      color: 'var(--accent-ember)',
    })
    if (!error) changed = true
    else if (
      !error.message.includes('duplicate') &&
      !error.message.includes('unique')
    ) {
      console.warn('[useBrands] Culturefit einfügen:', error.message)
    }
  }

  if (!eversmell) {
    const { error } = await supabase.from('brands').insert({
      user_id: userId,
      name: 'Eversmell',
      slug: 'eversmell',
      color: '#F5C518',
    })
    if (!error) changed = true
    else if (
      !error.message.includes('duplicate') &&
      !error.message.includes('unique')
    ) {
      console.warn('[useBrands] Eversmell einfügen:', error.message)
    }
  }

  return changed
}

export function useBrands(): UseBrandsResult {
  const { user } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seedAttemptedRef = useRef(false)
  const wertavioSupabaseSeedRef = useRef(false)

  useEffect(() => {
    seedWertavioLocalStorage()
  }, [])

  useEffect(() => {
    if (!user?.id) {
      wertavioSupabaseSeedRef.current = false
      return
    }
    if (!supabase || loading) return
    const w = brands.find((b) => b.slug === WERTAVIO_SLUG)
    if (!w || isLocalFallbackBrandId(w.id)) return
    if (wertavioSupabaseSeedRef.current) return
    wertavioSupabaseSeedRef.current = true
    void seedWertavioFoundationSupabase(w.id).catch(() => {
      wertavioSupabaseSeedRef.current = false
    })
  }, [user?.id, brands, loading])

  const reload = useCallback(async () => {
    if (!supabase || !user?.id) {
      setBrands([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('brands')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        console.warn(
          '[useBrands] Tabelle `brands` fehlt oder Cache — 3D-Graph nutzt Fallback. Migration 0001 im Supabase SQL Editor ausführen.',
          err.message,
        )
        setError(null)
        setBrands(sortBrandsForDisplay(FALLBACK_BRANDS))
      } else {
        setError(err.message)
        setBrands([])
      }
    } else {
      setError(null)
      let rawRows = data ?? []
      const migrated = await syncCanonicalBrandsForUser(user.id, rawRows)
      if (migrated) {
        const { data: again, error: err2 } = await supabase
          .from('brands')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
        if (!err2 && again) {
          rawRows = again
        }
      }
      setBrands(sortBrandsForDisplay(rawRows.map(mapBrand)))
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!supabase || !user?.id || loading) return
    if (brands.length > 0) {
      seedAttemptedRef.current = false
      return
    }
    if (seedAttemptedRef.current) return
    seedAttemptedRef.current = true
    void (async () => {
      const rows = DEFAULT_BRANDS.map((b) => ({
        user_id: user.id,
        name: b.name,
        slug: b.slug,
        color: b.color,
      }))
      const { error: insErr } = await supabase.from('brands').insert(rows)
      if (insErr) {
        if (isMissingSupabaseTableError(insErr.message)) {
          console.warn(
            '[useBrands] Seed übersprungen (keine Tabelle) — Fallback-Nodes.',
            insErr.message,
          )
          setBrands(sortBrandsForDisplay(FALLBACK_BRANDS))
          setError(null)
        } else {
          console.warn('[useBrands] Standard-Brands:', insErr.message)
        }
        seedAttemptedRef.current = false
        return
      }
      await reload()
    })()
  }, [user?.id, brands.length, loading, reload])

  return { brands, loading, error, reload }
}
