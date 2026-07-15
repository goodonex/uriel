import { supabase } from '../../lib/supabase'
import { isMissingSupabaseTableError } from '../../lib/supabaseErrors'

/**
 * Supabase-Speicher der Content-Batches (Tabelle social_batches, 0056).
 * Das lokal geöffnete Cockpit spiegelt die vom Runner gelesenen Wochen hierher
 * (saveSocialBatch); Live-Domain/Handy lesen sie über HTTPS. Die Liste kommt
 * OHNE HTML (nur Meta) — das ~100 KB HTML wird pro Woche einzeln nachgeladen.
 */
export interface SocialBatchMeta {
  week: string
  title: string
  postsCount: number
  sourceMtime: number | null
  generatedAt: string | null
  posted: boolean
}

export async function loadSocialBatchList(brandSlug: string): Promise<SocialBatchMeta[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('social_batches')
    .select('week, title, posts_count, source_mtime, generated_at, posted')
    .eq('brand_slug', brandSlug)
    .order('week', { ascending: false })
  if (error) {
    if (!isMissingSupabaseTableError(error.message)) console.warn('[social] Liste laden:', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    week: r.week as string,
    title: (r.title as string) ?? '',
    postsCount: (r.posts_count as number) ?? 0,
    sourceMtime: (r.source_mtime as number) ?? null,
    generatedAt: (r.generated_at as string) ?? null,
    posted: Boolean(r.posted),
  }))
}

export async function loadSocialBatchHtml(brandSlug: string, week: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('social_batches')
    .select('html')
    .eq('brand_slug', brandSlug)
    .eq('week', week)
    .maybeSingle()
  if (error) {
    if (!isMissingSupabaseTableError(error.message)) console.warn('[social] HTML laden:', error.message)
    return null
  }
  return (data?.html as string | undefined) ?? null
}

export interface SocialBatchInput {
  week: string
  title: string
  html: string
  postsCount: number
  sourceMtime: number | null
}

export async function saveSocialBatch(brandSlug: string, batch: SocialBatchInput): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('social_batches').upsert(
    {
      brand_slug: brandSlug,
      week: batch.week,
      title: batch.title,
      html: batch.html,
      posts_count: batch.postsCount,
      source_mtime: batch.sourceMtime,
      generated_at: batch.sourceMtime ? new Date(batch.sourceMtime).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'brand_slug,week' },
  )
  if (error && !isMissingSupabaseTableError(error.message)) {
    console.warn('[social] Batch-Upsert:', error.message)
  }
}
