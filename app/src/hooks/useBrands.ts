import { useCallback, useEffect, useRef, useState } from 'react'
import type { Brand, ICP, Positioning, WordBankEntry } from '../types/db'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { generateId, loadList, loadOne, saveList, saveOne } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const DEFAULT_BRANDS: Omit<Brand, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Herrmann & Co.', slug: 'herrmann', color: 'var(--accent-blue)' },
  { name: 'Wertavio', slug: 'wertavio', color: '#C8A97A' },
  { name: 'Homeflower', slug: 'homeflower', color: 'var(--accent-teal)' },
  { name: 'Eversmell', slug: 'eversmell', color: '#F5C518' },
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
    id: 'local-fallback-homeflower',
    user_id: null,
    name: 'Homeflower',
    slug: 'homeflower',
    color: 'var(--accent-teal)',
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
]

const WERTAVIO_SLUG = 'wertavio' as const

/** Einmalige localStorage-Startwerte für Wertavio (gleiche Keys wie usePositioning / useICPs / useWordBank). */
function seedWertavioLocalStorage(): void {
  if (typeof window === 'undefined') return

  const now = new Date().toISOString()
  const key = WERTAVIO_SLUG

  const pos = loadOne<Positioning>([key, 'positioning'])
  if (!pos?.statement?.trim()) {
    const doc: Positioning = {
      id: pos?.id ?? generateId(),
      brand_id: key,
      statement:
        'Wertavio verbindet Immobilieneigentümer kostenlos mit dem passenden Makler aus einem kuratierten Netzwerk spezialisierter Profis. Nicht Masse — sondern Match.',
      tone_of_voice:
        'Vertrauensvoll, klar, persönlich. Kein Immobilien-Slang. Kurze Sätze. Konkrete Aussagen. Wir nehmen dem Eigentümer die Unsicherheit.',
      business_model: {
        who: 'Wertavio',
        what: 'Makler-Matching für Eigentümer',
        how: 'kuratiertes Netzwerk + Ads',
        for_whom: 'Eigentümer die verkaufen wollen',
        revenue: 'Makler-Abo 750€/Monat + Setup',
      },
      updated_at: now,
    }
    saveOne([key, 'positioning'], doc)
  }

  if (loadList<ICP>([key, 'icps']).length === 0) {
    const icps: ICP[] = [
      {
        id: generateId(),
        brand_id: key,
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
        brand_id: key,
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
    saveList([key, 'icps'], icps)
  }

  if (loadList<WordBankEntry>([key, 'word-bank']).length === 0) {
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
    const words: WordBankEntry[] = [
      ...yesWords.map((word) => ({
        id: generateId(),
        brand_id: key,
        word,
        type: 'yes' as const,
        cluster: 'Wertavio',
        updated_at: now,
      })),
      ...noWords.map((word) => ({
        id: generateId(),
        brand_id: key,
        word,
        type: 'no' as const,
        cluster: 'Wertavio',
        updated_at: now,
      })),
    ]
    saveList([key, 'word-bank'], words)
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

export function useBrands(): UseBrandsResult {
  const { user } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const seedAttemptedRef = useRef(false)

  useEffect(() => {
    seedWertavioLocalStorage()
  }, [])

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
        setBrands(FALLBACK_BRANDS)
      } else {
        setError(err.message)
        setBrands([])
      }
    } else {
      setError(null)
      setBrands((data ?? []).map(mapBrand))
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
          setBrands(FALLBACK_BRANDS)
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
