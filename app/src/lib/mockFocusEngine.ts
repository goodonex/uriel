import type {
  Contact,
  ContentPiece,
  DiscoveryFeedItem,
  FocusTask,
  ICP,
  WordBankEntry,
} from '../types/db'

function task(
  brandSlug: string,
  partial: Omit<FocusTask, 'brand_id' | 'created_at'>,
): FocusTask {
  return {
    ...partial,
    brand_id: brandSlug,
    created_at: new Date().toISOString(),
  }
}

/** Lokale Heuristik — keine APIs. Ids stabil für Dismiss-Persistenz. */
export function computeFocusTasks(input: {
  brandSlug: string
  pieces: ContentPiece[]
  contacts: Contact[]
  discoveryItems: DiscoveryFeedItem[]
  icps: ICP[]
  wordBank: WordBankEntry[]
  dismissed: Set<string>
}): FocusTask[] {
  const out: FocusTask[] = []
  const now = Date.now()

  if (input.wordBank.length < 3 && !input.dismissed.has('wb-min')) {
    out.push(
      task(input.brandSlug, {
        id: 'wb-min',
        title: 'Word Bank ausbauen',
        detail:
          'Weniger als 3 Begriffe hinterlegt. Ergänze Ja/Nein-Wörter für schärfere Promo-Tags.',
        impact: 'medium',
        source: 'building',
        related_ids: [],
      }),
    )
  }

  if (input.icps.length === 0 && !input.dismissed.has('icp-empty')) {
    out.push(
      task(input.brandSlug, {
        id: 'icp-empty',
        title: 'Mindestens einen ICP definieren',
        detail: 'Ohne ICP fehlt die Zielrichtung für Content und Sales.',
        impact: 'high',
        source: 'building',
        related_ids: [],
      }),
    )
  }

  for (const c of input.contacts) {
    const id = `followup-${c.id}`
    if (input.dismissed.has(id)) continue
    if (c.next_follow_up_at) {
      const t = new Date(c.next_follow_up_at).getTime()
      if (!Number.isNaN(t) && t < now) {
        out.push(
          task(input.brandSlug, {
            id,
            title: `Follow-up überfällig: ${c.name}`,
            detail: 'Nächster Schritt war geplant — nachfassen oder neu terminieren.',
            impact: 'high',
            source: 'sales',
            related_ids: [c.id],
          }),
        )
      }
    }
  }

  for (const p of input.pieces) {
    const id = `performance-${p.id}`
    if (input.dismissed.has(id)) continue
    if (p.published_at && !p.performance_manual.updated_at) {
      out.push(
        task(input.brandSlug, {
          id,
          title: `Performance eintragen: ${p.title}`,
          detail: 'Piece ist live, aber noch keine manuellen KPIs erfasst.',
          impact: 'medium',
          source: 'promo',
          related_ids: [p.id],
        }),
      )
    }
  }

  for (const d of input.discoveryItems) {
    const id = `discovery-${d.id}`
    if (input.dismissed.has(id)) continue
    if (d.signal_strength === 'high') {
      out.push(
        task(input.brandSlug, {
          id,
          title: `Discovery-Signal: ${d.title}`,
          detail: d.summary,
          impact: 'medium',
          source: 'discovery',
          related_ids: [d.id],
        }),
      )
      break
    }
  }

  out.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 }
    return rank[a.impact] - rank[b.impact]
  })

  return out.slice(0, 8)
}
