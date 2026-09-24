// Welcher LinkedIn-Lead gehört zu diesem Kontakt? (24.09.2026)
//
// **Der Anlass.** Das Angebot hängt an einem Kontakt aus dem Sales-Bereich
// (`contacts`), der Lead lebt in `leads`. Zwischen beiden gab es keine eigene
// Spalte, deshalb blieb `angebote.lead_id` leer — der Kontakt sprang beim
// Unterschreiben auf „Deal", der LinkedIn-Lead blieb „aktiv" und lief in der
// Nachfass-Kadenz weiter, als wäre nichts passiert.
//
// **Die Brücke gibt es schon: der Gesprächsverlauf.** Der Postfach-Sync hängt
// jeden Verlauf an einen Kontakt (`linkedin_threads.contact_id`, über
// LinkedIn-Adresse oder eindeutigen Namen, runner/linkedin/upsert.mjs) und an
// einen Lead (`linkedin_threads.lead_id`, 0076). Am 24.09. in Prod: Reichentrog,
// Akbary und Dettler sind auf genau diesem Weg verbunden. Deshalb zuerst der
// Verlauf — er ist eine geprüfte Verbindung, kein Raten.
//
// **Der Name nur als Rückfall und nur eindeutig.** Ohne Verlauf (der Makler kam
// über einen Anruf oder eine Empfehlung) bleibt der Name. Zwei Leads mit
// demselben Namen sind dann KEIN Treffer: Einen fremden Lead auf „Kunde" zu
// setzen, nimmt ihn still aus jeder Nachfass-Liste — schlimmer als gar keiner.
//
// Die Datei ist bewusst ohne Deno-Importe, damit scripts/verify-angebot.ts
// dieselbe Regel prüft, die hier läuft.

export type Zuordnungsweg = 'angebot' | 'verlauf' | 'name' | null

export interface Zuordnung {
  /** Diese Leads werden „Kunde". Bei einer Firma können es mehrere Ansprechpartner sein. */
  leadIds: string[]
  /** Was am Angebot gespeichert wird — nur wenn es genau EINER ist. */
  angebotLeadId: string | null
  weg: Zuordnungsweg
}

/** Reine Entscheidung, ohne Datenbank. */
export function waehleLeads({
  angebotLeadId,
  verlaufLeadIds,
  namensTreffer,
}: {
  angebotLeadId: string | null
  verlaufLeadIds: string[]
  namensTreffer: string[]
}): Zuordnung {
  if (angebotLeadId) return { leadIds: [angebotLeadId], angebotLeadId, weg: 'angebot' }
  const verlauf = [...new Set(verlaufLeadIds.filter(Boolean))]
  if (verlauf.length) return { leadIds: verlauf, angebotLeadId: verlauf.length === 1 ? verlauf[0] : null, weg: 'verlauf' }
  // `namensTreffer` enthält je Kontakt höchstens einen Lead — nur die, deren
  // Name eindeutig war (siehe `findeLeads`). Mehrere heißt: mehrere Personen.
  const namen = [...new Set(namensTreffer.filter(Boolean))]
  if (namen.length) return { leadIds: namen, angebotLeadId: namen.length === 1 ? namen[0] : null, weg: 'name' }
  return { leadIds: [], angebotLeadId: null, weg: null }
}

/** `%` und `_` sind in `ilike` Platzhalter — ein Name wie „Müller_Bau" darf nicht zum Muster werden. */
function alsExakterName(name: string): string {
  return name.replace(/[\\%_]/g, (z) => `\\${z}`)
}

// Nur die Aufrufe, die hier gebraucht werden — so passt der Deno-Client wie der aus der App.
// deno-lint-ignore no-explicit-any
type Db = { from: (tabelle: string) => any }

/**
 * Die Leads zu einem Kontakt aus der Datenbank holen.
 *
 * Ist der Kontakt eine Firma, zählen ihre Ansprechpartner mit
 * (`parent_company_id`): Das Angebot geht meist an „Reichentrog & Kollegen
 * GmbH", der LinkedIn-Verlauf aber an Norbert Reichentrog.
 */
export async function findeLeads(
  db: Db,
  { brandId, contactId, angebotLeadId }: { brandId: string; contactId: string; angebotLeadId: string | null },
): Promise<Zuordnung> {
  if (angebotLeadId) return waehleLeads({ angebotLeadId, verlaufLeadIds: [], namensTreffer: [] })

  const { data: kontakt } = await db.from('contacts').select('id, name').eq('id', contactId).maybeSingle()
  const { data: personen } = await db.from('contacts').select('id, name').eq('parent_company_id', contactId)
  const kontakte: { id: string; name: string }[] = [...(kontakt ? [kontakt] : []), ...(personen ?? [])]
  if (!kontakte.length) return waehleLeads({ angebotLeadId: null, verlaufLeadIds: [], namensTreffer: [] })

  const { data: verlaeufe } = await db
    .from('linkedin_threads')
    .select('lead_id')
    .eq('brand_id', brandId)
    .in('contact_id', kontakte.map((k) => k.id))
    .not('lead_id', 'is', null)
  const verlaufLeadIds = (verlaeufe ?? []).map((v: { lead_id: string }) => v.lead_id)
  if (verlaufLeadIds.length) return waehleLeads({ angebotLeadId: null, verlaufLeadIds, namensTreffer: [] })

  // Rückfall Name: je Kontakt einzeln — ein Treffer zählt nur, wenn er für
  // SEINEN Namen eindeutig ist. Sonst würde „zwei Personen, je ein Treffer"
  // mit „eine Person, zwei Treffer" verwechselt.
  const namensTreffer: string[] = []
  for (const k of kontakte) {
    const name = (k.name ?? '').trim()
    if (name.length < 5 || !name.includes(' ')) continue
    const { data: treffer } = await db
      .from('leads')
      .select('id')
      .eq('brand_id', brandId)
      .ilike('name', alsExakterName(name))
      .limit(2)
    if (treffer?.length === 1) namensTreffer.push(treffer[0].id)
  }
  return waehleLeads({ angebotLeadId: null, verlaufLeadIds: [], namensTreffer })
}
