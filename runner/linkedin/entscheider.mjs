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
export function entscheiderUrteil(lead, recherche, { bekannteLeads = new Set(), kandidatStatus = new Map() } = {}) {
  const r = recherche ?? {}
  const nichts = (warum) => ({ zurueckstellen: false, text: '', neu: [], gf: [], warum })
  if (r.rolle_impressum !== 'angestellt') return nichts('nicht als angestellt geprüft')
  if (!ZIELGRUPPE.has(String(r.geschaeftsmodell ?? '').toLowerCase())) return nichts('nicht Zielgruppe')
  const gf = (r.impressum_gf ?? []).filter((n) => namensSchluessel(n) && !personGleich(n, lead.name)).slice(0, 2)
  if (!gf.length) return nichts('keine GF-Namen')

  // Wen Kevin verworfen hat, der zählt nicht mehr als Entscheider.
  const offen = gf.filter((n) => kandidatStatus.get(namensSchluessel(n)) !== 'verworfen')
  const neu = offen
    .filter((n) => !kandidatStatus.has(namensSchluessel(n)) && !bekannteLeads.has(namensSchluessel(n)))
    .map((n) => ({ gf_name: n, gf_key: namensSchluessel(n) }))
  if (!offen.length) return { zurueckstellen: false, text: '', neu: [], gf, warum: 'GF verworfen — Angestellter wird normal angeschrieben' }

  const nebenfirma = (r.stationen ?? []).some((s) => s.selbststaendig)
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
    alleSeiten(`${supabaseUrl}/rest/v1/entscheider_kandidaten?brand_id=eq.${brandId}&select=gf_key,status&order=id`, headers),
  ])
  return {
    bekannteLeads: new Set([...leads, ...netzwerk].map((z) => namensSchluessel(z.name)).filter(Boolean)),
    kandidatStatus: new Map(kandidaten.map((k) => [k.gf_key, k.status])),
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
  for (const l of leads) {
    const u = entscheiderUrteil(l, l.recherche, stand)
    for (const k of u.neu) {
      stand.kandidatStatus.set(k.gf_key, 'offen') // zweiter Mitarbeiter derselben Firma legt ihn nicht noch einmal an
      zeilen.push({
        brand_id: brandId,
        gf_name: k.gf_name,
        gf_key: k.gf_key,
        firma: l.recherche?.firma ?? '',
        website: l.recherche?.website ?? '',
        quelle_name: l.name,
        grund: grundFuer(l, l.recherche),
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
