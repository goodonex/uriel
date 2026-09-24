/**
 * runner/linkedin/leadProfil.mjs — das Lead-Profil und die Klasse A/B/C
 * (22.09.2026).
 *
 * Kevin will je Lead auf einen Blick wissen: Ist es wirklich der GF? Wie ist
 * die Seite? Laufen Meta- oder Google-Anzeigen? Welche Rechtsform, seit wann
 * am Markt, wie groß das Team? Daraus eine Klasse, die die Reihenfolge im
 * Follow-up steuert — seine Vorgabe vom 17.09.:
 *
 * - **A** — zahlt schon für Anzeigen, solide Firma (GmbH, einige Jahre am
 *   Markt, Team), aber schwache Seite → der Wunschkunde: Das Geld fließt
 *   schon, es landet nur auf einer Seite, die es verbrennt.
 * - **B** — solide Firma ohne Anzeigen, oder Anzeigen + ordentliche Seite.
 * - **C** — Einzelkämpfer, neu am Markt oder unklar.
 *
 * Alles hier ist Code, kein Modell: Die Felder kommen aus der ohnehin
 * laufenden Recherche (Impressum, sichtbarer Text, Befund, Werbebibliotheken).
 * Was sich nicht belegen lässt, bleibt leer — ein leeres Feld zieht die Klasse
 * nach unten, nie ein geratenes nach oben.
 *
 * Bilanzen: North Data und das Handelsregister blocken automatisierte
 * Abfragen. Das wird NICHT umgangen; `bilanz_hinweis` bleibt leer.
 */

/** Rechtsformen, die für „feste Firma" zählen. UG bewusst nicht: meist jung und klein. */
const FESTE_RECHTSFORM = new Set(['GmbH', 'GmbH & Co. KG', 'AG', 'KG', 'OHG', 'SE'])
/** Rechtsformen eines Einzelnen. */
const EINZEL_RECHTSFORM = new Set(['e.K.', 'Einzelunternehmen'])

const REGELN_RECHTSFORM = [
  [/gmbh\s*&\s*co\.?\s*kg/i, 'GmbH & Co. KG'],
  [/\bug\s*\(haftungsbeschr(ä|ae)nkt\)|unternehmergesellschaft/i, 'UG'],
  [/\bgmbh\b|gesellschaft mit beschr(ä|ae)nkter haftung/i, 'GmbH'],
  // Groß geschrieben, sonst trifft „ag" in jedem zweiten Satz.
  [/\bAG\b|aktiengesellschaft/, 'AG'],
  [/\bSE\b/, 'SE'],
  [/\be\.\s?K\.?(?=\s|$|,|\))|\be\.\s?Kfm\.|\be\.\s?Kfr\.|eingetragene[rn]?\s+kauf(mann|frau)/i, 'e.K.'],
  [/\bOHG\b/, 'OHG'],
  [/\bKG\b/, 'KG'],
  [/\bGbR\b|gesellschaft b(ü|ue)rgerlichen rechts/i, 'GbR'],
  [/\bPartG(mbB)?\b|partnerschaftsgesellschaft/i, 'PartG'],
  [/einzelunternehm|inhaber(in)?\s*:/i, 'Einzelunternehmen'],
]

/**
 * Rechtsform: erst aus dem Firmennamen, dann aus dem KOPF des Impressums.
 * Nicht aus dem ganzen Impressum — weiter unten stehen Hoster und Webagenturen
 * („Strato AG", „Webdesign XY GmbH"), die sonst die Rechtsform stellen.
 */
export function rechtsformAus(firma, impressumText = '') {
  for (const quelle of [String(firma ?? ''), String(impressumText ?? '').slice(0, 900)]) {
    for (const [muster, name] of REGELN_RECHTSFORM) if (muster.test(quelle)) return name
  }
  return ''
}

/** „HRB 12345" aus dem Impressum — ein Registereintrag ist selbst schon ein Signal. */
export function handelsregisterAus(impressumText = '') {
  const m = String(impressumText ?? '').match(/\b(HR\s?[AB])\s?(?:Nr\.?\s*)?(\d{2,7}(?:\s?[A-Z]{1,2})?)\b/)
  return m ? `${m[1].replace(/\s/g, '')} ${m[2]}` : ''
}

const JAHR = '(19[4-9]\\d|20[0-2]\\d)'

/**
 * Gründungsjahr aus sichtbarem Text, mit Beleg (wörtlich, max. 80 Zeichen).
 * Rangfolge der Quellen, stärkste zuerst:
 * 1. „gegründet 2005", „Gründung 2005", „founded 2005"
 * 2. „seit 1998" (oft mehrfach — das früheste zählt; „seit 2019 IVD-Mitglied" ist jünger als die Firma)
 * 3. „über 25 Jahre Erfahrung" → Jahr minus 25 (Erfahrung der Person, deshalb schwächer)
 * 4. „© 2009–2026" → Startjahr des Copyrights (Alter der Seite, am schwächsten)
 *
 * @returns {{ jahr: number|null, quelle: string, beleg: string }}
 */
export function gruendungAusText(texte, jetzt = new Date()) {
  const t = (Array.isArray(texte) ? texte : [texte]).map((x) => String(x ?? '')).join('\n')
  const diesesJahr = jetzt.getFullYear()
  const ok = (j) => Number.isInteger(j) && j >= 1900 && j <= diesesJahr
  const beleg = (m) => m[0].replace(/\s+/g, ' ').trim().slice(0, 80)

  const suche = (re, quelle, jahrAus) => {
    let bester = null
    for (const m of t.matchAll(re)) {
      const j = jahrAus(m)
      if (ok(j) && (!bester || j < bester.jahr)) bester = { jahr: j, quelle, beleg: beleg(m) }
    }
    return bester
  }
  return (
    suche(new RegExp(`(gegr(ü|ue)ndet|gr(ü|ue)ndung(sjahr)?|founded|established|est\\.)[^0-9\\n]{0,25}${JAHR}`, 'gi'), 'gegruendet', (m) => Number(m[m.length - 1])) ??
    suche(new RegExp(`\\bseit\\s+(dem\\s+jahre?\\s+|anfang\\s+|mitte\\s+|ende\\s+)?${JAHR}\\b`, 'gi'), 'seit', (m) => Number(m[m.length - 1])) ??
    suche(/(?<![a-zäöüß])(über|ueber|mehr als|seit|rund|fast)\s+(\d{1,2})\s+jahre?n?\b/gi, 'jahre-erfahrung', (m) => {
      const n = Number(m[2])
      return n >= 2 && n <= 80 ? diesesJahr - n : NaN
    }) ??
    suche(new RegExp(`(©|\\(c\\)|copyright)\\s*${JAHR}\\s*[-–—]\\s*20\\d\\d`, 'gi'), 'copyright', (m) => Number(m[m.length - 1])) ?? {
      jahr: null,
      quelle: '',
      beleg: '',
    }
  )
}

const zahlOderNull = (x) => {
  const n = Number(x)
  return x != null && x !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/**
 * Das Profil eines Leads aus dem Recherche-Destillat und den Zusatzquellen.
 *
 * @param {object} d — Destillat aus `leadRecherche.mjs`
 * @param {{ impressumText?: string, texte?: string[], modellGruendung?: { jahr?: number|null, beleg?: string }, sichtbarerText?: string, teamPersonen?: number|null }} quellen
 */
export function baueProfil(d, quellen = {}, jetzt = new Date()) {
  const r = d ?? {}
  const impressum = String(quellen.impressumText ?? '')
  let g = gruendungAusText([...(quellen.texte ?? []), impressum], jetzt)
  /**
   * Das Modell darf das Gründungsjahr nur ergänzen, wenn der Code nichts fand
   * — und nur mit wörtlichem Beleg aus dem sichtbaren Text (dieselbe Wache
   * wie beim `mangel`).
   */
  const mj = zahlOderNull(quellen.modellGruendung?.jahr)
  const mb = String(quellen.modellGruendung?.beleg ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const sichtbar = String(quellen.sichtbarerText ?? '').replace(/\s+/g, ' ').toLowerCase()
  if (!g.jahr && mj && mj >= 1900 && mj <= jetzt.getFullYear() && mb.length >= 4 && sichtbar.includes(mb) && mb.includes(String(mj))) {
    g = { jahr: mj, quelle: 'befund', beleg: mb.slice(0, 80) }
  }
  const team = zahlOderNull(quellen.teamPersonen)
  return {
    stand: jetzt.toISOString().slice(0, 10),
    website: String(r.website ?? ''),
    firma: String(r.firma ?? ''),
    gf: String(r.rolle_impressum ?? 'unklar') || 'unklar',
    impressum_gf: Array.isArray(r.impressum_gf) ? r.impressum_gf.slice(0, 6) : [],
    website_stufe: String(r.website_stufe ?? ''),
    wow_potenzial: String(r.wow_potenzial ?? ''),
    erreichbar: String(r.erreichbar ?? ''),
    erreichbar: String(r.erreichbar ?? ''),
    meta_ads_aktiv: String(r.meta_ads_aktiv ?? 'unbekannt') || 'unbekannt',
    google_ads_aktiv: String(r.google_ads_aktiv ?? 'unbekannt') || 'unbekannt',
    google_ads_seit: String(r.google_ads_seit ?? ''),
    google_ads_zuletzt: String(r.google_ads_zuletzt ?? ''),
    google_ads_anzahl: zahlOderNull(r.google_ads_anzahl),
    rechtsform: rechtsformAus(r.firma, impressum),
    handelsregister: handelsregisterAus(impressum),
    gruendungsjahr: g.jahr,
    gruendung_quelle: g.quelle,
    gruendung_beleg: g.beleg,
    jahre_am_markt: g.jahr ? jetzt.getFullYear() - g.jahr : null,
    team_personen: team && team > 0 ? team : null,
    groesse: String(r.groesse ?? ''),
    bilanz_hinweis: '',
  }
}

const monatJahr = (tag) => (/^\d{4}-\d{2}/.test(tag ?? '') ? `${tag.slice(5, 7)}/${tag.slice(0, 4)}` : '')

/**
 * Die Klasse aus dem Profil. Rein, ohne Netz — die Drift-Wache prüft sie an
 * Beispielen.
 *
 * „Solide Firma" = mindestens zwei von drei Zeichen (feste Rechtsform, drei
 * Jahre am Markt, Team ab drei Personen bzw. mittlere Größe) und nicht
 * nachweislich neu (unter zwei Jahren).
 *
 * @returns {{ klasse: 'A'|'B'|'C', grund: string }}
 */
export function klasseFuer(p) {
  const profil = p ?? {}
  const meta = profil.meta_ads_aktiv === 'ja'
  const google = profil.google_ads_aktiv === 'ja'
  const anzeigen = meta || google
  const rechtsform = String(profil.rechtsform ?? '')
  const jahre = Number.isFinite(profil.jahre_am_markt) ? profil.jahre_am_markt : null
  const team = Number.isFinite(profil.team_personen) ? profil.team_personen : null
  const groesse = String(profil.groesse ?? '')

  const fest = FESTE_RECHTSFORM.has(rechtsform)
  const lange = jahre != null && jahre >= 3
  const mitTeam = (team != null && team >= 3) || groesse === 'mittel' || groesse === 'konzern'
  const neu = jahre != null && jahre < 2
  const einzel = EINZEL_RECHTSFORM.has(rechtsform) || (team != null && team <= 1)
  const solide = [fest, lange, mitTeam].filter(Boolean).length >= 2 && !neu

  const fakten = []
  if (google) fakten.push(`Google-Ads${profil.google_ads_seit ? ` seit ${monatJahr(profil.google_ads_seit)}` : ''}`)
  if (meta) fakten.push('Meta-Ads aktiv')
  if (rechtsform) fakten.push(rechtsform)
  if (profil.gruendungsjahr) fakten.push(`seit ${profil.gruendungsjahr}`)
  if (team) fakten.push(`Team ${team}`)
  if (profil.website_stufe) fakten.push(`Seite ${profil.website_stufe}`)
  if (profil.gf === 'angestellt') fakten.push('Kontakt nicht GF')
  const liste = fakten.join(' · ')

  let klasse
  let kern
  if (anzeigen && solide && profil.website_stufe === 'schwach') {
    klasse = 'A'
    kern = 'Zahlt für Anzeigen, solide Firma, schwache Seite'
  } else if (solide || anzeigen) {
    klasse = 'B'
    kern = solide && !anzeigen ? 'Solide Firma ohne Anzeigen' : anzeigen && profil.website_stufe !== 'schwach' ? 'Anzeigen + ordentliche Seite' : 'Anzeigen, Firma noch unklar'
  } else {
    klasse = 'C'
    kern = neu ? 'Neu am Markt' : einzel ? 'Einzelkämpfer' : 'Unklar'
  }
  // Wer nicht entscheidet, ist nie der Wunschkunde-Kontakt — höchstens B.
  if (klasse === 'A' && profil.gf === 'angestellt') {
    klasse = 'B'
    kern = 'Wunschfirma, aber Kontakt ist nicht GF'
  }
  return { klasse, grund: liste ? `${kern} — ${liste}` : kern }
}

/**
 * ---- Punkte und Topf (24.09.2026, Lead-Bewertung) ----
 *
 * Gemeinsam für Stufe 1 (`grundprofil.mjs`, jeder Kontakt) und Stufe 2 (die
 * Recherche vor der Erstnachricht): Beide schreiben in dasselbe Profil, und
 * `bewerte` rechnet mit allem, was bis dahin belegt ist.
 */

const tageSeit = (tag, jetzt) => (/^\d{4}-\d{2}-\d{2}/.test(tag ?? '') ? (jetzt - new Date(tag)) / 86_400_000 : null)

/**
 * Punkte (0–100), Topf und Klasse aus dem Profil — Stufe 1 und Stufe 2
 * zusammen. Rein, damit sie sich prüfen und von Kevin ändern lässt.
 *
 * - **Zahlt schon für Kunden** (bis 35): Google-Anzeigen 20 (+5 seit über
 *   einem halben Jahr, +5 ab zehn Anzeigen), Meta-Anzeigen 15.
 * - **Unser Hebel** (bis 20): Wow-Potenzial der Seite aus Stufe 2 — ja 20,
 *   knapp 5, nein 0; noch nicht angesehen 10.
 * - **Feste Firma** (bis 20): Rechtsform 10, Handelsregister 5, Team ab drei
 *   oder drei Jahre am Markt 5.
 * - **Markt** (bis 15): Metropole 15, Großstadt 10, sonst 5.
 * - **Entscheider** (bis 10): im Impressum als Geschäftsführer 10, unklar 5.
 *
 * Töpfe: `vermutlich-inaktiv` (keine erreichbare Seite, keine Anzeigen, keine
 * feste Firma — Kevin: *„vielleicht gibt es die auch gar nicht mehr"*),
 * `starke-seite` (Stufe 2 sagt: wir bauen keine sichtbar bessere),
 * `jetzt` ab 55 Punkten, sonst `spaeter`.
 */
export function bewerte(p, jetzt = new Date()) {
  const profil = p ?? {}
  const google = profil.google_ads_aktiv === 'ja'
  const meta = profil.meta_ads_aktiv === 'ja'
  let anzeigen = 0
  if (google) {
    anzeigen += 20
    const seit = tageSeit(profil.google_ads_seit, jetzt)
    if (seit != null && seit > 180) anzeigen += 5
    if (Number(profil.google_ads_anzahl) >= 10) anzeigen += 5
  }
  if (meta) anzeigen += 15
  anzeigen = Math.min(35, anzeigen)

  const wow = String(profil.wow_potenzial ?? '')
  const hebel = wow === 'ja' ? 20 : wow === 'knapp' ? 5 : wow === 'nein' || profil.website_stufe === 'stark' ? 0 : 10

  const fest = FESTE_RECHTSFORM.has(String(profil.rechtsform ?? ''))
  const team = Number(profil.team_personen) >= 3 || Number(profil.jahre_am_markt) >= 3
  const firma = (fest ? 10 : 0) + (profil.handelsregister ? 5 : 0) + (team ? 5 : 0)

  const markt = { metropole: 15, grossstadt: 10 }[profil.markt] ?? 5
  const entscheider = profil.gf === 'gf' ? 10 : profil.gf === 'angestellt' ? 0 : 5

  const punkte = anzeigen + hebel + firma + markt + entscheider
  const keineSeite = !profil.website || profil.erreichbar === 'offline'
  /**
   * „Vermutlich inaktiv" nur mit Beleg, nicht aus einer erfolglosen Suche
   * (24.09.2026, Probelauf: HAKO Immobilien fand die Suche nicht, die Firma
   * gibt es). Beleg ist: die Seite existiert, lädt aber nicht — oder die
   * Anfrage liegt seit über 60 Tagen unbeantwortet und es ist nichts zu finden.
   * Kevin: *„nie angenommen, absolute Müllseite, vielleicht gibt es die auch
   * gar nicht mehr"*.
   */
  const alteAnfrage = profil.linkedin_status === 'offen' && (tageSeit(profil.eingeladen_at, jetzt) ?? 0) > 60
  const toteSeite = Boolean(profil.website) && profil.erreichbar === 'offline'

  let topf
  if (!google && !meta && !fest && (toteSeite || (keineSeite && alteAnfrage))) topf = 'vermutlich-inaktiv'
  else if (wow === 'nein' || wow === 'knapp' || profil.website_stufe === 'stark') topf = 'starke-seite'
  else if (punkte >= 55) topf = 'jetzt'
  else topf = 'spaeter'

  const teile = []
  if (google) teile.push(`Google-Anzeigen${profil.google_ads_seit ? ` seit ${profil.google_ads_seit.slice(0, 7)}` : ''}`)
  if (meta) teile.push('Meta-Anzeigen')
  if (profil.rechtsform) teile.push(profil.rechtsform)
  if (profil.ort) teile.push(profil.ort)
  if (profil.gf === 'gf') teile.push('selbst GF')
  if (profil.gf === 'angestellt') teile.push('nicht GF')
  if (wow) teile.push(`Wow ${wow}`)
  if (toteSeite) teile.push('Seite lädt nicht')
  else if (!profil.website) teile.push('keine Seite gefunden')

  const TOPF_TEXT = { jetzt: 'Jetzt angehen', spaeter: 'Später', 'starke-seite': 'Starke Seite, eigener Ansatz', 'vermutlich-inaktiv': 'Vermutlich inaktiv' }
  const { klasse: k } = klasseFuer(profil)
  const klasse = topf === 'vermutlich-inaktiv' ? 'C' : k
  return {
    punkte,
    topf,
    klasse,
    grund: `${TOPF_TEXT[topf]} · ${punkte} Punkte${teile.length ? ` — ${teile.join(' · ')}` : ''}`,
    teile: { anzeigen, hebel, firma, markt, entscheider },
  }
}

/** Rang für die Sortierung: A, B, dann ohne Klasse (noch nicht geprüft), dann C. */
export function klassenRang(klasse) {
  return klasse === 'A' ? 0 : klasse === 'B' ? 1 : klasse === 'C' ? 3 : 2
}

/**
 * Profile an die Leads schreiben (Migration 0092). Schlüssel ist
 * `profil_key` — derselbe, mit dem der Netzwerk-Sync die Leads anlegt. Wer
 * noch keine Zeile in `leads` hat, wird still übergangen: Das Profil kommt
 * mit der nächsten Recherche wieder.
 *
 * Nie werfen: Ein fehlgeschlagenes Speichern darf die Erstnachrichten nicht
 * aufhalten.
 */
export async function speichereProfile({ supabaseUrl, headers, brandId, leads }) {
  let gespeichert = 0
  for (const l of leads) {
    const key = String(l?.profil_key ?? '').trim()
    const neu = l?.recherche?.profil
    if (!key || !neu) continue
    try {
      const ziel = `${supabaseUrl}/rest/v1/leads?brand_id=eq.${brandId}&profil_key=eq.${encodeURIComponent(key)}`
      /**
       * Zusammenführen statt ersetzen (24.09.2026): Stufe 1 hat vielleicht
       * schon Ort, Markt und Anzeigen-Verlauf abgelegt. Die Recherche
       * überschreibt, was sie selbst belegt hat — leere Felder nicht.
       */
      const altRes = await fetch(`${ziel}&select=profil`, { headers })
      const alt = (altRes.ok ? (await altRes.json())[0]?.profil : null) ?? {}
      const belegt = Object.fromEntries(Object.entries(neu).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)))
      const profil = { ...alt, ...belegt, stufe2_at: new Date().toISOString() }
      const b = bewerte(profil)
      const res = await fetch(ziel, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ profil: { ...profil, punkte: b.punkte, topf: b.topf }, klasse: b.klasse, klasse_grund: b.grund, profil_at: new Date().toISOString() }),
      })
      if (res.ok) gespeichert += (await res.json().catch(() => [])).length
      else console.error(`[runner] Lead-Profil ${l.name}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`)
    } catch (e) {
      console.error(`[runner] Lead-Profil ${l.name}:`, e?.message ?? e)
    }
  }
  return gespeichert
}
