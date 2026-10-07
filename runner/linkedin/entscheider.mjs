/**
 * runner/linkedin/entscheider.mjs — „Entscheider zuerst" (22.09.2026).
 *
 * **Der Anlass.** Kevins Feedback zu den Erstnachrichten: Angestellte bekamen
 * „Kümmerst du dich … oder liegt das bei der Geschäftsführung?" — ohne
 * geprüfte Rolle. Und wer wirklich angestellt ist, ist der falsche erste
 * Kontakt: *„Wenn der Geschäftsführer ja zum Loom sagt, muss ich mit ihr
 * niemals reden."*
 *
 * **Was hier passiert.** Nach der Recherche, vor dem Schreib-Lauf:
 * 1. Wer laut Impressum angestellt ist (`rolle_impressum = angestellt`), bringt
 *    die Namen der Geschäftsführung mit. Die kommen als Kandidaten in
 *    `entscheider_kandidaten` (Migration 0091) — Kevins Liste „Heute anfragen".
 * 2. Die Erstnachricht des Angestellten wird zurückgestellt (Status
 *    `uebersprungen`, Text „[zurückgestellt] erst GF … anfragen") — er bleibt
 *    Nebenlinie, falls der GF nicht annimmt.
 *
 * **Ausnahmen, in denen der Angestellte trotzdem geschrieben wird:**
 * - Er hat eine eigene Firma nebenher (`stationen` mit `selbststaendig`) —
 *   dafür hat der Skill eine eigene Rapport-Nachricht.
 * - Großer Konzern UND er verantwortet erkennbar Marketing/Vertrieb — dort
 *   ist er der richtige Ansprechpartner; der GF kommt trotzdem auf die Liste.
 * - Kevin hat alle GF dieser Firma schon verworfen.
 *
 * Nichts hier schickt etwas an LinkedIn. Die Liste ist eine Liste.
 */

/** Gleicher Wert wie `GF_WARTEZEIT_TAGE` in `gfSuche.mjs` (dort nicht importierbar: Kreis). */
const GF_WARTEZEIT_TAGE_ENTSCHEIDER = 14

const ohneAkzent = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Dedup-Schlüssel eines Personennamens: klein, ohne Akzente, Titel, Zusätze hinter dem Komma. */
export function namensSchluessel(name) {
  return ohneAkzent(name)
    .replace(/,.*$/, '')
    .replace(/\b(dr|prof|dipl|ing|mba|mrics|msc|herr|frau)\.?(?=\s|$)/g, ' ')
    .replace(/[^a-zß\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Levenshtein-Abstand, gedeckelt — für Namen reicht das. */
function abstand(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/**
 * Derselbe Name, auch mit Tippfehler (22.09.2026): mjconsulting.ch schreibt
 * im Impressum „Maurice Jnglin", auf LinkedIn heißt er Jünglin. Ohne
 * Toleranz wäre er „angestellt" gewesen und hätte sich selbst als GF auf
 * Kevins Liste gefunden — genau die Peinlichkeit, die hier verhindert wird.
 * Ein Buchstabe Unterschied ab fünf Zeichen gilt als gleich.
 */
export function wortGleich(a, b) {
  const x = ohneAkzent(a)
  const y = ohneAkzent(b)
  if (!x || !y) return false
  if (x === y) return true
  return Math.min(x.length, y.length) >= 5 && abstand(x, y) <= 1
}

/** Zwei Personennamen: gleicher Vorname (erste drei Buchstaben) und gleicher Nachname (tolerant). */
export function personGleich(a, b) {
  const ta = namensSchluessel(a).split(' ').filter(Boolean)
  const tb = namensSchluessel(b).split(' ').filter(Boolean)
  if (ta.length < 2 || tb.length < 2) return false
  return ta[0].slice(0, 3) === tb[0].slice(0, 3) && wortGleich(ta[ta.length - 1], tb[tb.length - 1])
}

const MARKETING = /marketing|vertrieb|sales|kommunikation|communication|brand|digital|growth|akquise|business development|\bpr\b|public relations|social media|leadgen/i

/** Nur Zielgruppe: Makler und Projektentwickler (andere filtert `segmentUrteil` vorher schon raus). */
const ZIELGRUPPE = new Set(['makler', 'projektentwickler'])

/**
 * Dachmarken, unter denen Makler als Partner/Franchisenehmer arbeiten (07.10.2026).
 * Kevin: *„An alle, die in Verbund oder Dachfirmen sind wie Evernest, brauchen wir
 * einen eigenen Einstieg. Ich bekomme die sonst nie als Kunden."* Diese Leute
 * haben keine eigene Marke, die Seite gehört der Dachmarke — also weder Analyse
 * noch GF-Suche, sondern die Frage, ob sie sich selbstständig machen wollen.
 */
const DACHMARKEN = /evernest|re\/max|remax|engel\s*(?:&|und)\s*völkers|engel\s*(?:&|und)\s*voelkers|von poll|dahler|\bpmi\b|promak|homeday|ohne makler/i

/** Name der Dachmarke, wenn der Lead unter einer arbeitet, sonst ''. Die Zentrale selbst zählt nicht. */
export function verbundFuer(lead, recherche) {
  const r = recherche ?? {}
  const modell = String(r.verbund ?? '').trim()
  if (modell) return modell
  if (/gründer|founder|ceo|vorstand|geschäftsführer der zentrale/i.test(String(lead?.headline ?? ''))) return ''
  const treffer = `${r.firma ?? ''} ${lead?.headline ?? ''} ${r.taetigkeit ?? ''}`.match(DACHMARKEN)
  return treffer ? treffer[0] : ''
}

/**
 * Ein großer Konzern? Modell-Urteil oder harte Zeichen (AG/SE, Vorstand).
 * Nicht die Zahl der GF: gladigau-immobilien.de nennt vier — ein Familienbetrieb.
 */
export function istKonzern(recherche) {
  const r = recherche ?? {}
  if (String(r.groesse ?? '').toLowerCase() === 'konzern') return true
  if (/\b(ag|se)\b|aktiengesellschaft/i.test(String(r.firma ?? ''))) return true
  return /vorstand|aufsichtsrat/i.test(String(r.geschaeftsfuehrung ?? ''))
}

/** Die Rolle der Person bei der recherchierten Firma, aus den Stationen — sonst leer. */
export function rolleBeiFirma(recherche) {
  const r = recherche ?? {}
  const firma = ohneAkzent(r.firma)
  const s = (r.stationen ?? []).find((x) => {
    const f = ohneAkzent(x.firma)
    return firma && f && (f.includes(firma.split(' ')[0]) || firma.includes(f.split(' ')[0]))
  })
  return s?.rolle ?? ''
}

/**
 * Was mit diesem Lead passiert. Rein, ohne Datenbank.
 *
 * @param {{ name: string, headline?: string }} lead
 * @param {object} recherche — das Destillat aus `leadRecherche.mjs`
 * @param {{ bekannteLeads?: Set<string>, kandidatStatus?: Map<string, string> }} stand
 *   `bekannteLeads`: Namensschlüssel aller Leads/Netzwerk-Kontakte;
 *   `kandidatStatus`: gf_key → Status bereits angelegter Kandidaten
 * @returns {{ zurueckstellen: boolean, text: string, neu: {gf_name: string, gf_key: string}[], gf: string[], warum: string }}
 */
/**
 * Sieht das nach einem Menschen aus? (02.10.2026)
 *
 * Das Impressum-Auslesen lieferte „Allgemeine Geschäftsbedingungen", „Cookie
 * Einstellungen", „Millennium Tower", „Sheikh Zayed Road", „Eingetragener
 * Gegenstand" als Geschäftsführer — sechs der 35 Einträge in „Heute anfragen"
 * waren keine Personen, und die Angestellten dahinter blieben deshalb
 * zurückgestellt, ohne dass irgendjemand anfragbar war.
 */
export function istPersonenname(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim()
  const teile = n.split(' ')
  if (teile.length < 2 || teile.length > 5) return false
  if (!teile.every((t) => /^\p{Lu}/u.test(t) || /^(von|van|de|der|den|zu|zur|da|di|le|la|el)$/i.test(t))) return false
  if ((teile[teile.length - 1].replace(/[.,]/g, '')).length < 3) return false
  return !/geschäfts|bedingung|cookie|einstellung|gegenstand|tower|road|straße|strasse|platz|allee|emirate|vereinigte|design|gmbh|impressum|datenschutz|kontakt|telefon|haftung|register|handels|sitz\b/i.test(n)
}

/**
 * Namen aus Kevins Satz („ist angestellt, GF ist Anna Müller und Mag. Peter Huber").
 * Titel und Rollenwörter fallen weg, übrig bleiben Personennamen.
 */
export function namenAusHinweis(hinweis, leadName = '') {
  const roh = String(hinweis ?? '')
    .replace(/\b(Geschäftsführer(in)?(nen)?|Geschaeftsfuehrer|Geschäftsführung|Inhaber(in)?|Gründer(in)?|Gesellschafter(in)?|GF|CEO|Mag|Dr|Prof|MSc|MBA|Herr|Frau|ist|sind|heißt|heisst|laut|Impressum|Seite)\b\.?/g, ',')
  return roh
    .split(/[,;:/&]|\bund\b|\boder\b/i)
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter((t) => istPersonenname(t) && !personGleich(t, leadName))
    .slice(0, 3)
}

export function entscheiderUrteil(lead, recherche, { bekannteLeads = new Set(), kandidatStatus = new Map() } = {}) {
  const r = recherche ?? {}
  const nichts = (warum) => ({ zurueckstellen: false, text: '', neu: [], gf: [], warum })
  if (verbundFuer(lead, r)) return nichts('Verbund-Partner — eigener Einstieg, keine GF-Suche')
  if (r.rolle_impressum !== 'angestellt') return nichts('nicht als angestellt geprüft')
  if (!ZIELGRUPPE.has(String(r.geschaeftsmodell ?? '').toLowerCase())) return nichts('nicht Zielgruppe')
  const gf = (r.impressum_gf ?? []).filter((n) => istPersonenname(n) && namensSchluessel(n) && !personGleich(n, lead.name)).slice(0, 2)
  const nebenfirma = (r.stationen ?? []).some((s) => s.selbststaendig)
  if (!gf.length && (r.impressum_gf ?? []).some((n) => personGleich(n, lead.name))) return nichts('Impressum nennt ihn selbst (Tippfehler im Namen)')
  if (!gf.length) {
    /**
     * Kein Geschäftsführer im Impressum (02.10.2026): Kevin: „Wenn du den GF
     * nicht findest, kommen die als eigenes Ding in die Prüfenliste." Der
     * Angestellte wartet, bis Kevin den GF gefunden (oder verworfen) hat.
     */
    if (nebenfirma) return nichts('keine GF-Namen, eigene Firma nebenher — Rapport-Nachricht')
    if (istKonzern(r) && MARKETING.test(`${rolleBeiFirma(r)} ${lead.headline ?? ''}`)) return nichts('keine GF-Namen, Konzern — Marketing-Ansprechpartner')
    const firmaKey = namensSchluessel(r.firma ?? '') || namensSchluessel(lead.name)
    const key = `unbekannt:${firmaKey}`
    if (['verworfen', 'abgelaufen'].includes(kandidatStatus.get(key))) return nichts('GF-Suche verworfen — Angestellter wird normal angeschrieben')
    const neu = kandidatStatus.has(key) ? [] : [{ gf_name: `Geschäftsführer von ${r.firma || 'der Firma'} (Name unbekannt)`, gf_key: key, unbekannt: true }]
    return {
      zurueckstellen: true,
      text: `[zurückgestellt] erst Geschäftsführer von ${r.firma || 'der Firma'} finden, im Impressum steht keiner`,
      neu,
      gf: [`${r.firma || 'Firma'} (unbekannt)`],
      warum: 'reiner Angestellter, GF unbekannt',
    }
  }

  // Wen Kevin verworfen hat oder wer seit 14 Tagen ohne Annahme angefragt ist, zählt nicht mehr als Entscheider.
  const offen = gf.filter((n) => !['verworfen', 'abgelaufen'].includes(kandidatStatus.get(namensSchluessel(n))))
  const neu = offen
    .filter((n) => !kandidatStatus.has(namensSchluessel(n)) && !bekannteLeads.has(namensSchluessel(n)))
    .map((n) => ({ gf_name: n, gf_key: namensSchluessel(n) }))
  if (!offen.length) return { zurueckstellen: false, text: '', neu: [], gf, warum: 'GF verworfen oder seit 14 Tagen ohne Annahme — Angestellter wird normal angeschrieben' }

  if (nebenfirma) return { zurueckstellen: false, text: '', neu, gf: offen, warum: 'eigene Firma nebenher — Rapport-Nachricht' }

  const rolle = rolleBeiFirma(r)
  if (istKonzern(r) && MARKETING.test(`${rolle} ${lead.headline ?? ''}`)) {
    return { zurueckstellen: false, text: '', neu, gf: offen, warum: 'Konzern, verantwortet Marketing/Vertrieb' }
  }

  const schonKontakt = offen.every((n) => bekannteLeads.has(namensSchluessel(n)))
  const namen = offen.join(' / ')
  const text = schonKontakt
    ? `[zurückgestellt] erst GF ${namen} anfragen — ist schon in deinen Kontakten${r.firma ? ` (${r.firma})` : ''}`
    : `[zurückgestellt] erst GF ${namen} anfragen${r.firma ? ` — ${r.firma}` : ''}`
  return { zurueckstellen: true, text, neu, gf: offen, warum: 'reiner Angestellter' }
}

/** Der Satz für Kevins Liste: über wen der GF gefunden wurde. */
export function grundFuer(lead, recherche) {
  const rolle = rolleBeiFirma(recherche)
  return `${lead.name}${rolle ? ` (${rolle})` : ''} ist schon in deiner Liste`
}

/* ── Datenbank ────────────────────────────────────────────────────────── */

async function alleSeiten(url, headers) {
  const out = []
  for (let off = 0; off < 50_000; off += 1000) {
    const res = await fetch(`${url}&limit=1000&offset=${off}`, { headers })
    if (!res.ok) throw Object.assign(new Error(`GET HTTP ${res.status}`), { status: res.status, text: await res.text().catch(() => '') })
    const zeilen = await res.json()
    out.push(...zeilen)
    if (zeilen.length < 1000) break
  }
  return out
}

/**
 * Wer ist schon bekannt? Leads, Netzwerk (angefragt oder angenommen) und
 * bereits angelegte Kandidaten. Namensbasiert — LinkedIn gibt für dieselbe
 * Person zwei Sorten IDs aus (siehe 0076), der Name ist die Brücke.
 */
export async function ladeEntscheiderStand({ supabaseUrl, headers, brandId }) {
  const [leads, netzwerk, kandidaten] = await Promise.all([
    alleSeiten(`${supabaseUrl}/rest/v1/leads?brand_id=eq.${brandId}&select=name&order=id`, headers),
    alleSeiten(`${supabaseUrl}/rest/v1/linkedin_netzwerk?brand_id=eq.${brandId}&select=name&order=profil_key`, headers).catch(() => []),
    alleSeiten(`${supabaseUrl}/rest/v1/entscheider_kandidaten?brand_id=eq.${brandId}&select=gf_key,status,status_at&order=id`, headers),
  ])
  return {
    bekannteLeads: new Set([...leads, ...netzwerk].map((z) => namensSchluessel(z.name)).filter(Boolean)),
    // „angefragt" ohne Annahme seit 14 Tagen → „abgelaufen": der Angestellte ist wieder dran (02.10.2026).
    kandidatStatus: new Map(
      kandidaten.map((k) => [
        k.gf_key,
        k.status === 'angefragt' && k.status_at && Date.now() - new Date(k.status_at).getTime() >= GF_WARTEZEIT_TAGE_ENTSCHEIDER * 86_400_000 ? 'abgelaufen' : k.status,
      ]),
    ),
  }
}

/**
 * Leads eines Batches durchgehen: Kandidaten anlegen, Angestellte zurückstellen.
 *
 * @returns {Promise<{ behalten: object[], zurueck: {profil_key: string, name: string, grund: string, firma: string, website: string}[], angelegt: number }>}
 *   `behalten` gehen an den Schreib-Lauf, `zurueck` bekommen eine Zeile mit Status `uebersprungen`.
 */
export async function entscheiderZuerst(leads, { supabaseUrl, headers, brandId, log = console.log }) {
  const stand = await ladeEntscheiderStand({ supabaseUrl, headers, brandId })
  const behalten = []
  const zurueck = []
  const zeilen = []
  for (const lead of leads) {
    // Kevins Satz nennt den Geschäftsführer: er ersetzt, was das Impressum hergibt (03.10.2026).
    const kevinNamen = lead.hinweis_kevin ? namenAusHinweis(lead.hinweis_kevin, lead.name) : []
    const l = kevinNamen.length && lead.recherche ? { ...lead, recherche: { ...lead.recherche, impressum_gf: kevinNamen } } : lead
    const u = entscheiderUrteil(l, l.recherche, stand)
    for (const k of u.neu) {
      stand.kandidatStatus.set(k.gf_key, 'offen') // zweiter Mitarbeiter derselben Firma legt ihn nicht noch einmal an
      zeilen.push({
        ...(k.unbekannt ? { suche_ergebnis: 'unbekannt', suche_at: new Date().toISOString() } : {}),
        brand_id: brandId,
        gf_name: k.gf_name,
        gf_key: k.gf_key,
        firma: l.recherche?.firma ?? '',
        website: l.recherche?.website ?? '',
        quelle_name: l.name,
        grund: k.unbekannt ? `${l.name} (${rolleBeiFirma(l.recherche) || 'angestellt'}) hat angenommen, im Impressum steht kein Geschäftsführer` : kevinNamen.length ? `Von dir genannt, als Geschäftsführer bei ${l.recherche?.firma || l.name}` : grundFuer(l, l.recherche),
        status: 'offen',
      })
    }
    if (u.gf.length) log(`[runner] Entscheider zuerst: ${l.name} → GF ${u.gf.join(' / ')} (${u.warum})`)
    if (u.zurueckstellen) {
      zurueck.push({ profil_key: l.profil_key, name: l.name, grund: u.text, firma: l.recherche?.firma ?? '', website: l.recherche?.website ?? '' })
    } else {
      behalten.push(l)
    }
  }

  if (zeilen.length) {
    // Den Angestellten als Quelle verknüpfen, wo er schon ein Lead ist.
    const keys = [...new Set(leads.map((l) => l.profil_key).filter(Boolean))]
    if (keys.length) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/leads?brand_id=eq.${brandId}&profil_key=in.(${keys.map((k) => `"${String(k).replace(/"/g, '')}"`).join(',')})&select=id,name`,
        { headers },
      ).catch(() => null)
      const ids = res?.ok ? await res.json() : []
      const idJeName = new Map(ids.map((z) => [namensSchluessel(z.name), z.id]))
      for (const z of zeilen) z.quelle_lead_id = idJeName.get(namensSchluessel(z.quelle_name)) ?? null
    }
    const res = await fetch(`${supabaseUrl}/rest/v1/entscheider_kandidaten?on_conflict=brand_id,gf_key`, {
      method: 'POST',
      // Doppelte ignorieren statt überschreiben: Kevins Status darf ein zweiter Fund nie zurücksetzen.
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(zeilen),
    })
    if (!res.ok) throw new Error(`entscheider_kandidaten INSERT HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }
  return { behalten, zurueck, angelegt: zeilen.length }
}
