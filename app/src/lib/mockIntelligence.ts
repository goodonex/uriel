import type { Campaign, Contact, ContentPiece, ICP } from '../types/db'

export interface IntelligenceSnapshot {
  morningBrief: string
  patterns: string[]
  icpDrift: string[]
  foundationIdeas: string[]
}

/** Rein deterministische Mock-Auswertung aus lokalen Daten. */
export function buildIntelligenceSnapshot(input: {
  brandName: string
  pieces: ContentPiece[]
  contacts: Contact[]
  campaigns: Campaign[]
  icps: ICP[]
}): IntelligenceSnapshot {
  const published = input.pieces.filter((p) => p.published_at)
  const withPerf = published.filter((p) => p.performance_manual.updated_at)
  const leads = input.pieces.reduce(
    (acc, p) => acc + (p.performance_manual.leads ?? 0),
    0,
  )

  const morningBrief = `Guten Morgen — ${input.brandName}: ${published.length} live Pieces, ${withPerf.length} mit KPIs. Geschätzte Lead-Erfassungen (manuell): ${leads}. Sales-Pipeline: ${input.contacts.length} Kontakte.`

  const patterns: string[] = []
  const byChannel = new Map<string, number>()
  for (const p of input.pieces) {
    const ch = p.tags.channel
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + 1)
  }
  const top = [...byChannel.entries()].sort((a, b) => b[1] - a[1])[0]
  if (top) {
    patterns.push(
      `Kanal-Schwerpunkt: „${top[0]}“ (${top[1]} geplante/live Pieces).`,
    )
  }
  if (withPerf.length >= 2) {
    patterns.push(
      'Performance wird bereits konsistent erfasst — Intelligence kann später Trends vergleichen.',
    )
  } else if (published.length > 0) {
    patterns.push(
      'Noch wenige Performance-Daten — nach jedem Live-Gang KPIs eintragen.',
    )
  }

  const icpDrift: string[] = []
  if (input.icps.length >= 2) {
    icpDrift.push(
      'Mehrere ICPs aktiv — prüfen ob Content-Tags die Prioritäten widerspiegeln.',
    )
  } else if (input.icps.length === 1) {
    icpDrift.push(
      `Single-ICP „${input.icps[0].name}“ — Discovery-Signale sollten dieses Profil periodic gegenlesen.`,
    )
  } else {
    icpDrift.push('Keine ICPs — Drift-Erkennung springt erst nach Foundation-Pflege an.')
  }

  const foundationIdeas: string[] = []
  if (input.campaigns.length === 0 && input.pieces.length >= 3) {
    foundationIdeas.push(
      'Mehrere Pieces ohne aktive Kampagne — Kampagnen-Cluster für Messbarkeit anlegen.',
    )
  }
  const staleContacts = input.contacts.filter((c) => !c.last_contact_at).length
  if (staleContacts > 0) {
    foundationIdeas.push(
      `${staleContacts} Kontakt(e) ohne „Letzter Kontakt“ — Datenbasis für Intelligence schärfen.`,
    )
  }

  return { morningBrief, patterns, icpDrift, foundationIdeas }
}
