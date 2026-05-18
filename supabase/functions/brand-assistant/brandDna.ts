import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export async function loadBrandDna(
  client: SupabaseClient,
  brandId: string,
): Promise<{ brandName: string; dnaMarkdown: string }> {
  const { data: brand } = await client
    .from('brands')
    .select('name')
    .eq('id', brandId)
    .maybeSingle()

  const brandName = (brand?.name as string) ?? 'Brand'

  const [icpsQ, posQ, wbQ, bmQ] = await Promise.all([
    client.from('foundation_icps').select('*').eq('brand_id', brandId).order('priority', { ascending: true }),
    client.from('foundation_positioning').select('*').eq('brand_id', brandId).maybeSingle(),
    client.from('foundation_word_bank').select('*').eq('brand_id', brandId),
    client.from('foundation_business_models').select('*').eq('brand_id', brandId).maybeSingle(),
  ])

  const icps = (icpsQ.data ?? []) as Array<{
    name: string
    age_range: string | null
    location: string | null
    pain_points: string[] | null
    word_clusters: string[] | null
    notes: string | null
    priority: number | null
  }>

  const pos = posQ.data as {
    statement?: string
    tone_of_voice?: string
    business_model?: Record<string, string> | null
  } | null

  const wb = (wbQ.data ?? []) as Array<{ word: string; type: string; cluster: string | null }>
  const bm = bmQ.data as {
    who?: string
    what?: string
    how?: string
    for_whom?: string
    revenue?: string
  } | null

  const yes = wb.filter((w) => w.type === 'yes').map((w) => w.word)
  const no = wb.filter((w) => w.type === 'no').map((w) => w.word)

  const icpBlock = icps
    .map((icp, i) => {
      const pains = (icp.pain_points ?? []).join(', ') || '—'
      const clusters = (icp.word_clusters ?? []).join(', ') || '—'
      return `### ICP ${i + 1}: ${icp.name} (Priorität ${icp.priority ?? '—'})
- Alter: ${icp.age_range ?? '—'}
- Ort: ${icp.location ?? '—'}
- Schmerzpunkte: ${pains}
- Word-Cluster: ${clusters}
- Notizen: ${icp.notes ?? '—'}`
    })
    .join('\n\n')

  const bmFromPos = pos?.business_model
  const businessLines = bm
    ? `Wer: ${bm.who ?? ''}\nWas: ${bm.what ?? ''}\nWie: ${bm.how ?? ''}\nFür wen: ${bm.for_whom ?? ''}\nUmsatz: ${bm.revenue ?? ''}`
    : bmFromPos
      ? `Wer: ${bmFromPos.who ?? ''}\nWas: ${bmFromPos.what ?? ''}\nWie: ${bmFromPos.how ?? ''}\nFür wen: ${bmFromPos.for_whom ?? ''}\nUmsatz: ${bmFromPos.revenue ?? ''}`
      : '—'

  const dnaMarkdown = `# Brand-DNA: ${brandName}

## Positioning
${pos?.statement?.trim() || '—'}

## Tone of Voice
${pos?.tone_of_voice?.trim() || '—'}

## Business Model
${businessLines}

## ICPs
${icpBlock || '—'}

## Word Bank
Ja-Wörter: ${yes.length ? yes.join(' · ') : '—'}
Nein-Wörter: ${no.length ? no.join(' · ') : '—'}
`

  return { brandName, dnaMarkdown }
}

export type BrandDnaClient = SupabaseClient
