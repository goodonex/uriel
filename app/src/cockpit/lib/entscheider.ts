/**
 * „Entscheider zuerst" — die reine Logik hinter der Liste „Heute anfragen"
 * (22.09.2026). Die Kandidaten legt der Runner an
 * (`runner/linkedin/entscheider.mjs`, Tabelle aus Migration 0091); hier steht
 * nur, was die Oberfläche daraus macht.
 */

export type EntscheiderStatus = 'offen' | 'angefragt' | 'verworfen'

export interface EntscheiderKandidat {
  id: string
  gf_name: string
  firma: string
  website: string
  quelle_name: string
  grund: string
  linkedin_url: string | null
  status: EntscheiderStatus
  status_at: string | null
  created_at: string
}

/**
 * Wohin der Knopf führt: das Profil, wenn es bekannt ist, sonst die
 * LinkedIn-Personensuche mit Name + Firma. Die Rechtsform bleibt draußen —
 * „GmbH" im Suchfeld findet auf LinkedIn eher weniger als mehr.
 */
export function linkedinZiel(k: Pick<EntscheiderKandidat, 'gf_name' | 'firma' | 'linkedin_url'>): string {
  if (k.linkedin_url && /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(k.linkedin_url)) return k.linkedin_url
  const firma = String(k.firma ?? '')
    .replace(/\b(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|ag|ug|kg|ohg|gbr|e\.\s?k\.?|se)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const suche = [k.gf_name.trim(), firma].filter(Boolean).join(' ')
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(suche)}`
}

/** Offene zuerst, darin die ältesten oben — wer am längsten wartet, ist dran. */
export function heuteAnfragen(items: EntscheiderKandidat[]): EntscheiderKandidat[] {
  return items
    .filter((k) => k.status === 'offen')
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
}
