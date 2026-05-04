import { generateId } from './storage'
import type {
  DiscoveryAnalysis,
  DiscoveryFeedCategory,
  DiscoveryFeedItem,
} from '../types/db'

function clip(s: string, max: number): string {
  const t = s.trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/**
 * Platzhalter-Analyse bis ein echter Agent angebunden ist.
 * Nutzt die drei Freitext-Felder als Kontext für sinnvolle Vorschläge.
 */
export function runMockDiscoveryAnalysis(input: {
  market: string
  competitors: string
  niche: string
}): DiscoveryAnalysis {
  const market = clip(input.market, 120)
  const competitors = clip(input.competitors, 120)
  const niche = clip(input.niche, 120)

  const ctx = [market, niche].filter(Boolean).join(' · ') || 'dein Markt'

  return {
    icp_drafts: [
      {
        name: `Zielgruppe A — ${ctx}`,
        age_range: '',
        location: '',
        pain_hint:
          'Hoher Informationsbedarf vor Kaufentscheidung; vergleicht Anbieter intensiv. Bitte im Building mit echten Daten schärfen.',
      },
      {
        name: `Zielgruppe B — ${competitors ? 'Abgrenzung zu Wettbewerb' : 'Early Adopters'}`,
        age_range: '',
        location: '',
        pain_hint:
          competitors
            ? 'Sucht Differenzierung zu genannten Wettbewerbern — Nutzenargumente klar machen.'
            : 'Sucht schnelle, verlässliche Lösung ohne viel Overhead.',
      },
    ],
    word_bank_suggestions: [
      { word: 'seriös', type: 'yes', cluster: 'Discovery' },
      { word: 'transparent', type: 'yes', cluster: 'Discovery' },
      { word: 'Billigangebot', type: 'no', cluster: 'Discovery' },
      { word: 'Standard-Agentur', type: 'no', cluster: 'Discovery' },
    ],
    positioning_ideas: [
      niche
        ? `Kern-Nische: ${niche} — Positionierung als Spezialist statt Generalist.`
        : 'Nische schärfen: weniger Breite, mehr Tiefe in einem klaren Problemraum.',
      market
        ? `Markt-Angle: ${market} — Fokus auf messbares Ergebnis statt nur Sichtbarkeit.`
        : 'Klares Outcome versprechen (Leads, Termine, Umsatz) statt nur „mehr Reichweite“.',
      competitors
        ? `Wettbewerb: ${competitors} — eine konkrete Gegenposition formulieren (Speed, Qualität, Preis-Modell).`
        : 'Wettbewerber benennen, um eine eindeutige Gegenposition zu finden.',
    ],
  }
}

const FEED_TEMPLATES: Array<{
  category: DiscoveryFeedCategory
  title: string
  summary: string
  signal_strength: DiscoveryFeedItem['signal_strength']
}> = [
  {
    category: 'competitor',
    title: 'Wettbewerber: längere Case-Study-Posts',
    summary:
      'In der Nische mehren sich LinkedIn-Posts mit Vorher/Nachher und klarem CTA. Durchschnittlich 2× höheres Engagement als reine Werbeclips.',
    signal_strength: 'medium',
  },
  {
    category: 'format',
    title: 'Format: Kurz-Video + Untertitel',
    summary:
      'Reels und Shorts mit harten Untertiteln performen stabil — auch ohne großes Produktionsbudget.',
    signal_strength: 'high',
  },
  {
    category: 'trend',
    title: 'Trend: „ROI sichtbar machen“',
    summary:
      'Zielgruppen suchen explizit nach Kennzahlen und Referenzen. Landingpages mit Zahlen-Strip konvertieren besser.',
    signal_strength: 'medium',
  },
  {
    category: 'icp_search',
    title: 'Suchintent: „Kosten vs. Qualität“',
    summary:
      'Viele Suchanfragen kombinieren Preis mit Qualitätssignalen. Content, der beides adressiert, gewinnt Vertrauen.',
    signal_strength: 'low',
  },
]

export function generateMockFeedBatch(
  brandSlug: string,
  count = 3,
): DiscoveryFeedItem[] {
  const now = Date.now()
  const out: DiscoveryFeedItem[] = []
  for (let i = 0; i < count; i++) {
    const tpl = FEED_TEMPLATES[(i + now) % FEED_TEMPLATES.length]
    out.push({
      id: generateId(),
      brand_id: brandSlug,
      category: tpl.category,
      title: tpl.title,
      summary: tpl.summary,
      signal_strength: tpl.signal_strength,
      recorded_at: new Date(now - i * 3600_000).toISOString(),
    })
  }
  return out
}
