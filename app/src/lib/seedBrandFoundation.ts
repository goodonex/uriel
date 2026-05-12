/**
 * Generische Seed-Layer für die Building-Mode-Foundation.
 *
 * Zwei Phasen pro Brand:
 *  1. `seedFoundationLocalStorage(seed)` — sofort beim Start, deckt Fallback ab.
 *  2. `seedFoundationSupabase(brandId, seed)` — sobald Brand in DB resolved ist
 *     und die Tabellen wirklich leer sind. Idempotent: schreibt nur,
 *     wenn keine Inhalte existieren.
 *
 * Versioniert über `seed.version` + Sentinel-Eintrag in localStorage.
 */
import type {
  BusinessModelDoc,
  ICP,
  Positioning,
  WordBankEntry,
} from '../types/db'
import { generateId, loadOne, saveList, saveOne } from './storage'
import { isMissingSupabaseTableError } from './supabaseErrors'
import { supabase } from './supabase'
import type { BrandFoundationSeed } from '../data/brandFoundationSeeds'

const SENTINEL_PART = 'foundation-seed' as const

function sentinelKey(slug: string): [string, string] {
  return [slug, SENTINEL_PART]
}

function buildPositioning(seed: BrandFoundationSeed, brandKey: string, now: string): Positioning {
  return {
    id: generateId(),
    brand_id: brandKey,
    statement: seed.positioning_statement,
    tone_of_voice: seed.tone_of_voice,
    business_model: { ...seed.business_model },
    updated_at: now,
  }
}

function buildBusinessModelDoc(
  seed: BrandFoundationSeed,
  brandKey: string,
  now: string,
): BusinessModelDoc {
  return {
    id: generateId(),
    brand_id: brandKey,
    ...seed.business_model,
    updated_at: now,
  }
}

function buildICPs(seed: BrandFoundationSeed, brandKey: string, now: string): ICP[] {
  return seed.icps.map((i) => ({
    id: generateId(),
    brand_id: brandKey,
    name: i.name,
    age_range: i.age_range,
    location: i.location,
    pain_points: [...i.pain_points],
    word_clusters: [...i.word_clusters],
    priority: i.priority,
    notes: i.notes,
    updated_at: now,
  }))
}

function buildWordBank(
  seed: BrandFoundationSeed,
  brandKey: string,
  now: string,
): WordBankEntry[] {
  const yes = seed.word_bank.yes.map((w) => ({
    id: generateId(),
    brand_id: brandKey,
    word: w.word,
    type: 'yes' as const,
    cluster: w.cluster ?? seed.defaultWordCluster,
    updated_at: now,
  }))
  const no = seed.word_bank.no.map((w) => ({
    id: generateId(),
    brand_id: brandKey,
    word: w.word,
    type: 'no' as const,
    cluster: w.cluster ?? seed.defaultWordCluster,
    updated_at: now,
  }))
  return [...yes, ...no]
}

/**
 * Schreibt die Foundation-Inhalte unter `brand-os:{slug}:*` —
 * exakt die Keys, die `usePositioning`, `useICPs`, `useWordBank`, `useBusinessModel` lesen.
 * Wird nur ausgeführt, wenn `seed.version` ≠ aktueller Sentinel.
 */
export function seedFoundationLocalStorage(seed: BrandFoundationSeed): void {
  if (typeof window === 'undefined') return
  const mark = loadOne<{ v: number }>(sentinelKey(seed.slug))
  if (mark?.v === seed.version) return

  const now = new Date().toISOString()
  const brandKey = seed.slug

  const prevPos = loadOne<Positioning>([brandKey, 'positioning'])
  const pos = buildPositioning(seed, brandKey, now)
  pos.id = prevPos?.id ?? pos.id
  saveOne([brandKey, 'positioning'], pos)

  const prevBm = loadOne<BusinessModelDoc>([brandKey, 'businessmodel'])
  const bm = buildBusinessModelDoc(seed, brandKey, now)
  bm.id = prevBm?.id ?? bm.id
  saveOne([brandKey, 'businessmodel'], bm)

  saveList([brandKey, 'icps'], buildICPs(seed, brandKey, now))
  saveList([brandKey, 'word-bank'], buildWordBank(seed, brandKey, now))

  saveOne(sentinelKey(seed.slug), { v: seed.version, at: now })
}

/**
 * Foundation in Supabase auffüllen — pro Tabelle nur, wenn dort
 * für diese `brand_id` noch nichts steht. Verhindert dadurch
 * Überschreiben händisch gepflegter Inhalte.
 */
export async function seedFoundationSupabase(
  brandId: string,
  seed: BrandFoundationSeed,
): Promise<void> {
  if (!supabase) return

  /* foundation_positioning ─────────────────────────────────────────── */
  {
    const { data: pos, error: posErr } = await supabase
      .from('foundation_positioning')
      .select('id, statement')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (posErr && isMissingSupabaseTableError(posErr.message)) return
    if (posErr) {
      console.warn(`[seedFoundationSupabase:${seed.slug}] positioning`, posErr.message)
    } else if (!pos?.statement?.trim()) {
      const now = new Date().toISOString()
      const row = {
        id: pos?.id ?? generateId(),
        brand_id: brandId,
        statement: seed.positioning_statement,
        tone_of_voice: seed.tone_of_voice,
        business_model: { ...seed.business_model },
        updated_at: now,
      }
      const { error: upErr } = await supabase
        .from('foundation_positioning')
        .upsert(row, { onConflict: 'brand_id' })
      if (upErr && !isMissingSupabaseTableError(upErr.message)) {
        console.warn(`[seedFoundationSupabase:${seed.slug}] positioning upsert`, upErr.message)
      }
    }
  }

  /* foundation_business_models ─────────────────────────────────────── */
  {
    const { data: bm, error: bmErr } = await supabase
      .from('foundation_business_models')
      .select('id, who, what, how, for_whom, revenue')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (bmErr && isMissingSupabaseTableError(bmErr.message)) {
      /* Tabelle fehlt — Skip nur diesen Block, der Rest funktioniert weiter. */
    } else if (bmErr) {
      console.warn(`[seedFoundationSupabase:${seed.slug}] business_model`, bmErr.message)
    } else {
      const isEmpty =
        !bm ||
        ![bm.who, bm.what, bm.how, bm.for_whom, bm.revenue].some(
          (v) => typeof v === 'string' && v.trim().length > 0,
        )
      if (isEmpty) {
        const now = new Date().toISOString()
        const row = {
          id: bm?.id ?? generateId(),
          brand_id: brandId,
          ...seed.business_model,
          updated_at: now,
        }
        const { error: upErr } = await supabase
          .from('foundation_business_models')
          .upsert(row, { onConflict: 'brand_id' })
        if (upErr && !isMissingSupabaseTableError(upErr.message)) {
          console.warn(
            `[seedFoundationSupabase:${seed.slug}] business_model upsert`,
            upErr.message,
          )
        }
      }
    }
  }

  /* foundation_icps ────────────────────────────────────────────────── */
  {
    const { count, error: countErr } = await supabase
      .from('foundation_icps')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)

    if (countErr && isMissingSupabaseTableError(countErr.message)) return
    if (!countErr && (count ?? 0) === 0) {
      const now = new Date().toISOString()
      const rows = buildICPs(seed, brandId, now).map((r) => ({
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
      const { error: insErr } = await supabase.from('foundation_icps').insert(rows)
      if (insErr && !isMissingSupabaseTableError(insErr.message)) {
        console.warn(`[seedFoundationSupabase:${seed.slug}] icps insert`, insErr.message)
      }
    }
  }

  /* foundation_word_bank ───────────────────────────────────────────── */
  {
    const { count, error: countErr } = await supabase
      .from('foundation_word_bank')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)

    if (countErr && isMissingSupabaseTableError(countErr.message)) return
    if (!countErr && (count ?? 0) === 0) {
      const now = new Date().toISOString()
      const rows = buildWordBank(seed, brandId, now).map((r) => ({
        brand_id: brandId,
        word: r.word,
        type: r.type,
        cluster: r.cluster,
        updated_at: now,
      }))
      const { error: insErr } = await supabase.from('foundation_word_bank').insert(rows)
      if (insErr && !isMissingSupabaseTableError(insErr.message)) {
        console.warn(`[seedFoundationSupabase:${seed.slug}] word_bank insert`, insErr.message)
      }
    }
  }
}
