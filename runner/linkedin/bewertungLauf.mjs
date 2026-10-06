/**
 * runner/linkedin/bewertungLauf.mjs — Stufe 1 für einen Stapel Kontakte
 * (24.09.2026). Die fachliche Arbeit steht in `grundprofil.mjs`; hier nur:
 * wer ist dran, wie viele gleichzeitig, wohin wird geschrieben.
 *
 * **Wer zuerst.** Angenommene vor offenen Anfragen (sie bekommen als Nächstes
 * eine Erstnachricht), innerhalb davon die Jüngsten. Wer schon ein Profil hat
 * — aus Stufe 1 oder aus der Recherche vor der Erstnachricht —, ist fertig.
 *
 * **Wohin.** `leads.profil` (jsonb, Migration 0092), `klasse`, `klasse_grund`.
 * Die Klasse ordnet im Cockpit schon heute die Follow-ups; der Grund steht
 * mit Topf und Punkten daneben („Jetzt angehen · 72 Punkte — Google-Anzeigen
 * seit 2025-03 · GmbH · München · selbst GF").
 */
import { reichereAn, mischeProfil } from './anreicherung.mjs'
import { besteNummer } from './kontaktdaten.mjs'
import { starteBrowser } from './seiteRendern.mjs'
import { STUFE1_FASSUNG, bewerte, grundprofil } from './grundprofil.mjs'

const GLEICHZEITIG = Number(process.env.BEWERTUNG_PARALLEL ?? 3)
/** Wie beim Recherche-Lauf: ein hängender Kontakt darf nie den Stapel blockieren. */
const KONTAKT_TIMEOUT_MS = Number(process.env.BEWERTUNG_KONTAKT_TIMEOUT_MS ?? 3 * 60 * 1000)

async function alle(supabaseUrl, headers, pfad) {
  const out = []
  for (let off = 0; off < 50_000; off += 1000) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${pfad}&limit=1000&offset=${off}`, { headers })
    if (!res.ok) throw new Error(`GET ${pfad.split('?')[0]} HTTP ${res.status}`)
    const zeilen = await res.json()
    out.push(...zeilen)
    if (zeilen.length < 1000) break
  }
  return out
}

/**
 * Eine ältere Stufe-1-Fassung, die keine Seite fand und nie von Stufe 2
 * ergänzt wurde, wird noch einmal bewertet. Stufe 2 erkennt man an
 * `stufe2_at` (ab 24.09.) oder `stand` (Profile der Recherche vom 22./23.09.).
 */
export function brauchtNeueFassung(l) {
  return !l.stufe2 && !l.stand && !l.website && (Number(l.fassung) || 1) < STUFE1_FASSUNG
}

/** Wer ist dran? Reine Auswahl, getrennt vom Abruf, damit sie sich prüfen lässt. */
export function naechsteKontakte(netzwerk, mitProfil, limit) {
  const fertig = new Set(mitProfil)
  const offen = netzwerk.filter((n) => n.lead_id && !fertig.has(n.lead_id) && (n.status === 'angenommen' || n.status === 'offen'))
  const zeit = (n) => String(n.angenommen_at ?? n.eingeladen_at ?? '')
  offen.sort((a, b) => (a.status === b.status ? zeit(b).localeCompare(zeit(a)) : a.status === 'angenommen' ? -1 : 1))
  return offen.slice(0, limit)
}

/**
 * Leads, die auf LinkedIn geantwortet haben und noch kein fertiges Profil
 * tragen. Neueste Antwort zuerst.
 */
export async function antworterOhneProfil(supabaseUrl, headers, brandId, fertig) {
  const threads = await alle(supabaseUrl, headers,
    `linkedin_threads?brand_id=eq.${brandId}&lead_id=not.is.null&select=lead_id,name,company,last_message_at,verlauf&order=id`)
  return threads
    .filter((t) => !fertig.has(t.lead_id) && Array.isArray(t.verlauf) && t.verlauf.some((m) => m?.sender === 'them'))
    .sort((a, b) => String(b.last_message_at ?? '').localeCompare(String(a.last_message_at ?? '')))
    .map((t) => ({ lead_id: t.lead_id, name: t.name, headline: t.company ?? '' }))
}

/**
 * Einen Stapel bewerten.
 * @returns {Promise<{ bewertet: number, rest: number, kosten: number, toepfe: Record<string, number> }>}
 */
export async function bewerteStapel({ supabaseUrl, headers, brandId, limit = 40, cliPath, cwd, melde = () => {} }) {
  const [netzwerk, mitProfil] = await Promise.all([
    alle(supabaseUrl, headers, `linkedin_netzwerk?brand_id=eq.${brandId}&select=name,headline,status,lead_id,angenommen_at,eingeladen_at&status=in.(offen,angenommen)&order=id`),
    alle(supabaseUrl, headers, `leads?brand_id=eq.${brandId}&profil=not.is.null&select=id,fassung:profil->stufe1_fassung,website:profil->>website,stufe2:profil->>stufe2_at,stand:profil->>stand&order=id`),
  ])
  const fertig = mitProfil.filter((l) => !brauchtNeueFassung(l)).map((l) => l.id)
  // Vorrang (06.10.2026): Wer geantwortet hat, ist der heißeste Lead und wird
  // zuerst bewertet, auch wenn er nicht (mehr) in linkedin_netzwerk steht. Vorher
  // hatten 89 von 152 Antwortern keine Klasse, weil die Auswahl nur nach
  // Annahme-Datum sortierte. Felix Range (fragte nach dem Preis) war einer davon.
  const antworter = await antworterOhneProfil(supabaseUrl, headers, brandId, new Set(fertig))
  const imVorrang = new Set(antworter.map((a) => a.lead_id))
  const normal = naechsteKontakte(netzwerk.filter((n) => !imVorrang.has(n.lead_id)), fertig, 1e9)
  const alleDran = [...antworter, ...normal]
  const dran = alleDran.slice(0, limit)
  const rest = alleDran.length - dran.length
  if (!dran.length) return { bewertet: 0, rest: 0, kosten: 0, toepfe: {} }

  const browser = await starteBrowser().catch(() => null)
  let naechster = 0
  let bewertet = 0
  let kosten = 0
  const toepfe = {}
  async function arbeiter() {
    while (naechster < dran.length) {
      const k = dran[naechster++]
      let uhr
      try {
        let { profil, kosten: k$ } = await Promise.race([
          grundprofil(k, { browser, cliPath, cwd }),
          new Promise((_, nein) => (uhr = setTimeout(() => nein(new Error('Zeitlimit')), KONTAKT_TIMEOUT_MS))),
        ]).finally(() => clearTimeout(uhr))
        kosten += k$
        /**
         * Anreicherung gleich mit (29.09.2026): Nummer, Mail, Alter, Team und
         * Website-Signal — sonst ersetzte eine Neubewertung das Profil und die
         * Anrufliste verlöre die Nummer wieder. Scheitert sie, bleibt Stufe 1.
         */
        let felder = {}
        if (profil.website) {
          try {
            felder = (await reichereAn(profil.website)).felder
            profil = mischeProfil(profil, felder)
          } catch {}
        }
        const b = bewerte(profil)
        // Nie über ein Profil der Stufe 2 schreiben — die Recherche weiß mehr.
        const res = await fetch(`${supabaseUrl}/rest/v1/leads?id=eq.${k.lead_id}&or=(profil.is.null,and(profil->>stufe2_at.is.null,profil->>stand.is.null))`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            profil: { ...profil, punkte: b.punkte, topf: b.topf },
            klasse: b.klasse,
            klasse_grund: b.grund,
            profil_at: new Date().toISOString(),
            ...(besteNummer(felder) ? { telefon: besteNummer(felder) } : {}),
            ...(felder.email_impressum ? { email: felder.email_impressum } : {}),
          }),
        })
        if (!res.ok) throw new Error(`PATCH HTTP ${res.status}`)
        toepfe[b.topf] = (toepfe[b.topf] ?? 0) + 1
        bewertet++
      } catch (e) {
        console.error(`[runner] Bewertung ${k.name}: ${e?.message ?? e}`)
      }
      melde(`${bewertet} von ${dran.length} bewertet`, bewertet / dran.length)
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, dran.length) }, arbeiter))
  } finally {
    await browser?.close().catch(() => {})
  }
  return { bewertet, rest, kosten, toepfe }
}
