/**
 * runner/linkedin/erstnachrichtenEntwuerfe.mjs — was der Agent geschrieben hat,
 * in die Arbeitsliste legen (31.08.2026).
 *
 * Gegenstück zu `entwuerfe.mjs` (Antworten), nur ein anderes Ziel: Dort hängt
 * der Entwurf an einem Thread, hier entsteht eine Zeile in
 * `linkedin_erstnachrichten` — derselben Tabelle, die bisher nur der
 * `linkedin-leads`-Skill von Hand füllte.
 *
 * **Der Anlass steht in `scripts/erstnachrichten-input.ts`:** Kevins Kachel
 * meldete „0 von 0 ✓", während 508 Angenommene ohne Nachricht dastanden. Die
 * Kachel war ehrlich — der Topf war wirklich leer. Nur füllte ihn nichts.
 *
 * **Zwei Sorten Rückgabe, beide notwendig.** `nachrichten` sind Texte,
 * `uebersprungen` sind Menschen, die der Agent aussortiert hat (kein Makler,
 * Wettbewerber, Recruiter). Ohne die zweite Sorte stünde derselbe Fitness-Coach
 * jeden Morgen wieder oben, und jeder Lauf schriebe ihm einen neuen Text.
 */

/**
 * Den letzten ```json-Block aus der Agenten-Antwort lesen.
 *
 * Der letzte, nicht der erste: Agenten zeigen gern erst ein Beispiel und dann
 * das Ergebnis. Dieselbe Regel wie in `entwuerfe.mjs` — wer sie hier anders
 * baut, bekommt bei genau der Sorte Antwort ein anderes Ergebnis.
 */
/**
 * Der eine CTA — muss Zeichen für Zeichen mit `ANALYSE_CTA` in
 * `app/src/cockpit/lib/followupVorlagen.ts` übereinstimmen (die TS-Konstante
 * lässt sich hier nicht importieren; `scripts/verify-erstnachrichten-cta.ts`
 * hält beide zusammen).
 */
import { QUELLE_PRAEFIX, istVeraltet } from '../regeln/fassung.mjs'

export const ANALYSE_CTA = 'Hast du was dagegen, wenn ich sie dir einmal rüberschicke?'

/**
 * Die erlaubten Schlusssätze, einer je Nachrichtentyp (10.09.2026).
 *
 * Nicht jede Erstnachricht kann eine Analyse anbieten: Wer keine Website hat,
 * bekommt kein Video zu einer Seite, die es nicht gibt. Diese Fälle brauchen
 * einen eigenen nächsten Schritt — aber ebenfalls einen festen, sonst gilt für
 * sie wieder, was für den Analyse-CTA galt: Variiert er, misst die Antwortquote
 * ihn mit.
 *
 * **Die Mandate-Frage ist raus** (23.09.2026, Regelwerk
 * `runner/regeln/erstnachrichten/schreiben.md`): Kevin hatte sie am 17.09.
 * abgeschafft (*„bekommen die bestimmt von jedem"*), der Code hängte sie als
 * Ersatz trotzdem weiter an. An ihre Stelle rückt die Hauptfokus-Frage, die
 * Kevin am 22.09. für Leute mit Nebenfirma gelobt hat.
 */
export const CTA_KATALOG = Object.freeze({
  analyse: ANALYSE_CTA,
  /** Kein Auftritt auffindbar — Kevin will die Adresse, um doch zu schauen. */
  keineSeite: 'Wo finde ich euch?',
  /** Seite existiert, ist aber offline, leer oder im Umbau. */
  seiteTot: 'Ist die Seite gerade offline, oder komme nur ich nicht drauf?',
  /** Ohne Seite ist ein Video sinnlos — der nächste Schritt ist ein Gespräch. */
  telefon: 'Hast du was dagegen, wenn wir zehn Minuten telefonieren?',
  /** Nicht Entscheider, aber eigene Firma nebenher — Rapport statt Analyse (22.09.2026). */
  hauptfokus: 'Wo liegt bei dir gerade der Hauptfokus?',
  /** Frisch gegründet, keine Seite gefunden — erst Rapport (22.09.2026). */
  inPlanung: 'Ist die noch in Planung, oder hab ich sie übersehen?',
})

/**
 * Die frühere Angestellten-Frage (17.09.–22.09.2026) — **abgeschafft**.
 *
 * Kevin am 22.09.: *„Wenn wir da einen Fehler machen, dass der vielleicht doch
 * die Geschäftsführung ist, kommt das richtig blöd."* Sie ging an Leute, deren
 * Rolle nie geprüft war. Seitdem kommt der GF aus dem Impressum auf die
 * Anfrageliste (`entscheider.mjs`), und reine Angestellte werden
 * zurückgestellt. Der Satz bleibt nur hier, damit die Wache ihn aus
 * Entwürfen herausschneiden kann, falls ein Agent ihn noch schreibt.
 */
export const ALTE_GF_FRAGE = 'Kümmerst du dich bei euch um Website und Marketing, oder liegt das bei der Geschäftsführung?'

/**
 * Feste Sperre: Angestellte bekommen keine Analyse (18.09.2026).
 *
 * Die Regel stand seit dem 17.09. im Skill — und trotzdem ging Moritz Wagner
 * (angestellt bei Igel & Kaufmann, die Recherche hatte es richtig erkannt) ein
 * Analyse-Angebot. Ein Modell, das eine Regel „meistens" befolgt, reicht bei
 * diesem Punkt nicht. Deshalb schneidet der Code jeden Absatz heraus, der die
 * Analyse anbietet.
 *
 * **Seit 22.09.2026 ohne die Frage nach der Geschäftsführung** (siehe
 * `ALTE_GF_FRAGE`). Wer als Angestellter überhaupt noch geschrieben wird, hat
 * eine eigene Firma nebenher oder verantwortet im Konzern das Marketing — dem
 * stellt man keine Zuständigkeitsfrage. Endet der Rest nicht auf eine Frage,
 * kommt die Hauptfokus-Frage aus dem Katalog dran (seit 23.09. statt der
 * abgeschafften Mandats-Frage).
 */
export function ohneAnalyseFuerAngestellte(text) {
  const absaetze = String(text ?? '').split(/\n\s*\n/)
  const rest = absaetze.filter(
    (a) => !/analyse/i.test(a) && a.trim() !== ANALYSE_CTA && a.trim() !== ALTE_GF_FRAGE && !Object.values(CTA_KATALOG).includes(a.trim()),
  )
  const letzter = String(rest[rest.length - 1] ?? '').trimEnd()
  return (letzter.endsWith('?') ? rest : [...rest, CTA_KATALOG.hauptfokus]).join('\n\n')
}

/**
 * Die abgeschaffte GF-Frage aus JEDEM Entwurf nehmen (22.09.2026) — auch bei
 * Inhabern: Dort ist sie genau die Peinlichkeit, die Kevin gefunden hat.
 * Was davor steht, bleibt; fehlt danach die Schlussfrage, kommt die
 * Hauptfokus-Frage dran.
 *
 * @returns {{ text: string, korrigiert: boolean }}
 */
export function ohneAlteGfFrage(text) {
  const roh = String(text ?? '')
  if (!roh.includes(ALTE_GF_FRAGE)) return { text: roh, korrigiert: false }
  const rest = roh.replace(ALTE_GF_FRAGE, '').replace(/\n{3,}/g, '\n\n').trimEnd()
  return { text: rest.endsWith('?') ? rest : `${rest}\n\n${CTA_KATALOG.hauptfokus}`.trimStart(), korrigiert: true }
}

/** Endet der Text auf einen der erlaubten CTAs? */
export function hatFestenCta(text) {
  const roh = String(text ?? '').trimEnd()
  return Object.values(CTA_KATALOG).some((c) => roh.endsWith(c))
}

/**
 * Schlussfragen, die dasselbe wollen wie `ANALYSE_CTA` — die Analyse anbieten.
 * Genau diese werden ersetzt, alles andere bleibt stehen.
 *
 * Der Anlass (10.09.2026): Eine Zählung fand in 67 offenen Erstnachrichten rund
 * 50 verschiedene Schlussfragen — „Darf ich sie dir schicken?", „Schick ich sie
 * dir rüber?", „Interesse?". Kevins Einwand war doppelt: Um Erlaubnis bittet
 * der Bittsteller, und solange der CTA mitvariiert, misst keine Antwortquote
 * mehr die Beobachtung davor.
 */
const ANGEBOTS_FRAGE =
  /(darf|soll|kann|schick|sende?|magst|willst|möchtest)[^.?!]{0,80}\?\s*$|^(interesse|wäre das|passt das|lohnt sich das)[^.?!]{0,40}\?\s*$/i

/**
 * Fragen, die etwas ANDERES wollen als die Analyse: eine tote Website klären,
 * qualifizieren, einen Anruf anbieten. Die haben ihren eigenen festen CTA und
 * dürfen hier nicht überschrieben werden — sonst bekäme jemand, dessen Seite
 * offline ist, eine Analyse zu einer Seite angeboten, die es nicht gibt.
 */
const ANDERER_TYP =
  /offline|umbau|erreichbar|zugang|finde ich|komme? (nur )?ich|mandate|netzwerk|telefonat|telefonieren|zehn minuten|diese woche|call|geschäftsführung|kümmerst/i

/** Grußformel samt Namenszeile am Textende. */
const GRUSSFORMEL =
  /\n+\s*((beste|viele|liebe|herzliche|freundliche)\s+gr(ü|ue)(ß|ss)e|lg|vg|bg|gr(ü|ue)(ß|ss)e)\s*,?\s*(\n+\s*\S{2,30}\s*)?$/i

/**
 * Den Schlusssatz auf den einen CTA ziehen.
 *
 * Bewusst korrigierend statt verwerfend: Ein Entwurf, der bis auf die letzte
 * Zeile gut ist, ist zu wertvoll zum Wegwerfen — und ein verworfener Lead käme
 * Kevin nie wieder vor. Wer nichts anzubieten hat, was `ANALYSE_CTA` benennt,
 * bleibt unangetastet.
 *
 * @returns {{ text: string, korrigiert: boolean }}
 */
export function erzwingeAnalyseCta(text) {
  const roh = String(text ?? '').trimEnd()
  if (!roh) return { text: roh, korrigiert: false }

  // Eine Signatur ist auch dann zu viel, wenn der CTA davor schon stimmt.
  if (GRUSSFORMEL.test(roh) && hatFestenCta(roh.replace(GRUSSFORMEL, ''))) {
    return { text: roh.replace(GRUSSFORMEL, '').trimEnd(), korrigiert: true }
  }

  /**
   * Die Grußformel fliegt raus (Kevins Anweisung, 10.09.2026). Auf LinkedIn
   * steht der Absender am Profil — „Beste Grüße / Kevin" liest sich dort nach
   * E-Mail-Serienbrief und schiebt den CTA aus der letzten Zeile, wo er hin
   * gehört. Drei Entwürfe im Bestand sahen so aus.
   */
  const kern = roh.replace(GRUSSFORMEL, '').trimEnd()
  const anhang = ''

  if (kern.endsWith(ANALYSE_CTA)) return { text: roh, korrigiert: false }

  // Ohne benanntes Angebot hätte „sie" im CTA keinen Bezug.
  if (!/analyse|video|loom/i.test(kern)) return { text: roh, korrigiert: false }

  const treffer = kern.match(/[^.?!\n]+[.?!]\s*$/)
  const letzter = treffer ? treffer[0].trim() : ''
  if (!letzter || ANDERER_TYP.test(letzter)) return { text: roh, korrigiert: false }
  if (!ANGEBOTS_FRAGE.test(letzter)) return { text: roh, korrigiert: false }

  const ersetzt = kern.slice(0, kern.length - treffer[0].length).trimEnd() + ' ' + ANALYSE_CTA
  return { text: ersetzt + anhang, korrigiert: true }
}

export function parseErstnachrichtenRoh(content) {
  if (!content) return { nachrichten: [], uebersprungen: [] }
  const blocks = [...String(content).matchAll(/```json\s*([\s\S]*?)```/g)]
  if (!blocks.length) return { nachrichten: [], uebersprungen: [] }
  let parsed
  try {
    parsed = JSON.parse(blocks[blocks.length - 1][1])
  } catch {
    return { nachrichten: [], uebersprungen: [] }
  }

  const nachrichten = []
  for (const n of Array.isArray(parsed?.nachrichten) ? parsed.nachrichten : []) {
    if (!n || typeof n !== 'object') continue
    const text = typeof n.nachricht === 'string' ? n.nachricht.trim() : ''
    const key = typeof n.profil_key === 'string' ? n.profil_key.trim() : ''
    // Ohne Schlüssel ist der Text nicht zuordenbar, ohne Text gibt es nichts
    // zu verschicken — beides ist ein stiller Verlust, kein Fehler.
    if (!text || !key) continue
    // Der CTA wird nicht dem Agenten überlassen: Er variiert ihn sonst je Lead,
    // und dann ist die Antwortquote nicht mehr auswertbar.
    const { text: mitCta, korrigiert } = erzwingeAnalyseCta(text)
    if (korrigiert) {
      console.log(`[runner] Erstnachricht ${n.name ?? key}: CTA auf den festen Wortlaut gezogen`)
    }
    /**
     * Bei den Nicht-Analyse-Typen korrigiert die Wache nicht selbst: Ob jemand
     * gar keine Seite hat oder eine kaputte, steht im Fließtext und nicht im
     * Schlusssatz — eine Automatik würde hier raten. Also melden statt raten,
     * damit ein abweichender Schlusssatz sichtbar wird, statt still rauszugehen.
     */
    if (!hatFestenCta(mitCta)) {
      console.warn(`[runner] Erstnachricht ${n.name ?? key}: Schlusssatz steht in keinem CTA-Katalog — bitte prüfen`)
    }
    nachrichten.push({
      profil_key: key,
      name: typeof n.name === 'string' ? n.name.trim() : '',
      firma: typeof n.firma === 'string' ? n.firma.trim() : '',
      website: typeof n.website === 'string' ? n.website.trim() : '',
      nachricht: mitCta,
      /**
       * Wo der Agent unsicher ist, sagt er es (Kevin, 17.09.2026): *„wenn das
       * 5 von 50 sind, ist das kein Problem, dass ich selber nochmal drauf
       * gucke."* Lieber ein offener Hinweis als eine geratene Aussage.
       */
      pruefen: typeof n.pruefen === 'string' ? n.pruefen.trim().slice(0, 200) : '',
    })
  }

  const uebersprungen = []
  for (const u of Array.isArray(parsed?.uebersprungen) ? parsed.uebersprungen : []) {
    if (!u || typeof u !== 'object') continue
    const key = typeof u.profil_key === 'string' ? u.profil_key.trim() : ''
    if (!key) continue
    uebersprungen.push({
      profil_key: key,
      name: typeof u.name === 'string' ? u.name.trim() : '',
      firma: typeof u.firma === 'string' ? u.firma.trim() : '',
      website: typeof u.website === 'string' ? u.website.trim() : '',
      // Der Grund ist Pflicht im Skill und steht hier, damit ein Fehlgriff
      // nachvollziehbar bleibt: „passt nicht" ist keine Begründung.
      grund: typeof u.grund === 'string' ? u.grund.trim().slice(0, 200) : '',
    })
  }

  return { nachrichten, uebersprungen }
}

/**
 * Schreiben — und zwar so, dass ein zweiter Lauf nichts kaputt macht.
 *
 * **Der Schlüssel ist `(brand_id, gruppe, name)`** (Migration 0071 hat ihn von
 * der wandernden Gruppen-Überschrift befreit; `gruppe` ist heute eine
 * mitlaufende Beschriftung). Deshalb schreibt dieser Lauf in eine feste Gruppe
 * und prüft VORHER, ob die Person schon eine Zeile hat: Kevins `status` und
 * `sent_at` dürfen unter keinen Umständen überschrieben werden — genau das war
 * der Fehler vom 14.08., als Roland Wettstein als frischer Lead wieder auftauchte.
 *
 * **Eine Ausnahme seit 23.09.2026: veraltete offene Texte.** Trägt eine offene
 * Zeile eine ältere Regel-Fassung (`runner/regeln/fassung.mjs`), hat die Runde
 * sie absichtlich neu geschrieben — dann wird genau diese Zeile ersetzt.
 * Gesendete und von Hand angelegte Zeilen bleiben weiter unberührt.
 */
export async function schreibeErstnachrichten({
  supabaseUrl,
  headers,
  brandId,
  nachrichten,
  uebersprungen,
  gruppe = 'Von Uriel vorbereitet',
  quelle = QUELLE_PRAEFIX,
}) {
  const at = new Date().toISOString()
  let geschrieben = 0
  let uebersprungenGeschrieben = 0
  let schonDa = 0
  let ersetzt = 0

  /** Wer schon eine Zeile hat — egal in welchem Status —, wird nicht angefasst (außer veraltet, s. o.). */
  const vorhanden = new Map()
  for (let off = 0; off < 20_000; off += 1000) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_erstnachrichten?brand_id=eq.${brandId}&select=id,name,status,quelle_datei&limit=1000&offset=${off}`,
      { headers },
    )
    if (!res.ok) break
    const zeilen = await res.json()
    for (const z of zeilen) vorhanden.set(String(z.name ?? '').trim().toLowerCase(), z)
    if (zeilen.length < 1000) break
  }

  const neu = []
  const ersetzen = []
  let sortIndex = Date.now() % 100_000

  /** Veraltete offene Zeile → ersetzen; sonst neu, wenn es keine gibt. @returns {boolean} ob geschrieben wird */
  const einreihen = (name, zeile) => {
    const alt = vorhanden.get(name.toLowerCase())
    if (alt && istVeraltet(alt, quelle)) {
      const { brand_id: _b, gruppe: _g, name: _n, sort_index: _s, ...felder } = zeile
      ersetzen.push({ id: alt.id, felder })
      vorhanden.set(name.toLowerCase(), { ...alt, quelle_datei: quelle, status: zeile.status })
      ersetzt++
      return true
    }
    if (alt) return false
    vorhanden.set(name.toLowerCase(), { status: zeile.status, quelle_datei: quelle })
    neu.push(zeile)
    return true
  }

  for (const n of nachrichten) {
    const zeile = {
      brand_id: brandId,
      gruppe,
      name: n.name,
      // Die Tabelle hat (noch) kein eigenes Prüf-Feld — die Firma steht im Cockpit
      // direkt neben dem Namen und wird nicht mitkopiert, dort fällt der Hinweis auf.
      firma: n.pruefen ? `${n.firma} · PRÜFEN: ${n.pruefen}` : n.firma,
      website: n.website,
      nachricht: n.nachricht,
      sort_index: sortIndex++,
      status: 'offen',
      quelle_datei: quelle,
      last_synced_at: at,
    }
    if (einreihen(n.name, zeile)) geschrieben++
    else schonDa++
  }

  for (const u of uebersprungen) {
    if (!u.name) {
      schonDa++
      continue
    }
    const zeile = {
      brand_id: brandId,
      gruppe,
      name: u.name,
      firma: u.firma ?? '',
      website: u.website ?? '',
      // Der Grund steht im Textfeld, damit er in der Oberfläche sichtbar wird,
      // wenn Kevin die Aussortierten gegenliest. Ein Grund mit eigener Marke
      // („[zurückgestellt] erst GF … anfragen", 22.09.2026) behält sie — sonst
      // stünde „[übersprungen] [zurückgestellt]" da.
      nachricht: /^\[/.test(String(u.grund ?? '')) ? u.grund : `[übersprungen] ${u.grund}`,
      sort_index: sortIndex++,
      status: 'uebersprungen',
      quelle_datei: quelle,
      last_synced_at: at,
    }
    if (einreihen(u.name, zeile)) uebersprungenGeschrieben++
    else schonDa++
  }

  for (const { id, felder } of ersetzen) {
    // `status=eq.offen` als zweite Sicherung: Hat Kevin den Text inzwischen gesendet, bleibt er.
    const res = await fetch(`${supabaseUrl}/rest/v1/linkedin_erstnachrichten?id=eq.${id}&status=eq.offen`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(felder),
    })
    if (!res.ok) throw new Error(`Erstnachrichten-PATCH HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  }

  if (neu.length) {
    // Kein `merge-duplicates`: Es sind ausschliesslich Zeilen, die es noch
    // nicht gibt (oben geprüft). Ein Upsert würde bei einem Namensdreher
    // Kevins Fortschritt überschreiben.
    const res = await fetch(`${supabaseUrl}/rest/v1/linkedin_erstnachrichten`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(neu),
    })
    if (!res.ok) {
      throw new Error(`Erstnachrichten-INSERT HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
    }
  }

  return { geschrieben, uebersprungen: uebersprungenGeschrieben, schonDa, ersetzt }
}

/**
 * Wer bekommt überhaupt einen Text? Entscheidet der Code, nicht das Modell
 * (21.09.2026).
 *
 * Der Schreib-Agent hatte die Regel „jeder, der mit Immobilien Geld verdient,
 * bekommt eine Nachricht" — heraus kamen Texte an eine Volksbank, ein
 * Weiterbildungs-Institut, Capital- und Holding-Firmen, einen KI-Software-
 * Gründer (Tim Brück) und Hausverwaltungen mit dem Makler-Pitch. Kevin zur
 * Hausverwaltung (Maximilian Schaper, Verto): *„da müssten wir uns bevor wir
 * das machen, auch mal klar überlegen, welchen Pain haben überhaupt
 * Hausverwaltungen — wenn die sich vor Mandaten nicht retten können, macht das
 * überhaupt gar keinen Sinn."*
 *
 * - `makler`, `projektentwickler` → schreiben (Entwickler mit Käufer-Angle, siehe Skill)
 * - `hausverwaltung` → zurückstellen, bis der Pain geklärt ist
 * - `investor`, `sonstiges` → überspringen
 * - keine Website gefunden, obwohl die Erfahrung nicht gelesen werden konnte →
 *   kein „keine Website gefunden"-Text, sondern Kevin prüft selbst
 *
 * @returns {{ aktion: 'schreiben'|'zurueckstellen'|'ueberspringen', grund: string }}
 */
export function segmentUrteil(recherche) {
  const r = recherche ?? {}
  const modell = String(r.geschaeftsmodell ?? '').toLowerCase()
  const was = String(r.taetigkeit ?? '').slice(0, 120)
  if (modell === 'hausverwaltung') {
    return { aktion: 'zurueckstellen', grund: `[zurückgestellt] Hausverwaltung — erst Pain klären. ${was}`.trim() }
  }
  if (modell === 'investor' || modell === 'sonstiges') {
    return { aktion: 'ueberspringen', grund: `${modell === 'investor' ? 'Investor/Bestandshalter' : 'kein Makler'}: ${was || r.firma || 'Tätigkeit unklar'}` }
  }
  if (!String(r.website ?? '').trim() && r.erreichbar !== 'offline' && !r.nur_portal && !(r.erfahrung_gelesen && r.firma)) {
    return { aktion: 'zurueckstellen', grund: `[prüfen] Website nicht gefunden, LinkedIn-Erfahrung nicht lesbar — bitte selbst googeln${r.firma ? `: ${r.firma}` : ''}` }
  }
  return { aktion: 'schreiben', grund: '' }
}
