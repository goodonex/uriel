import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { icpUrteil, istArbeitsVorrat } from './icp.mjs'

/**
 * runner/linkedin/antwortThreads.mjs — Eingabe für den Antwort-Entwürfe-Agenten.
 *
 * Läuft im Runner (nachts, ohne Cockpit), deshalb muss die Frage „welche Threads
 * warten auf Kevins Antwort?" hier ein zweites Mal beantwortet werden — die
 * maßgebliche Fassung ist `bucketOf(...) === 'du_bist_dran'` in
 * app/src/cockpit/lib/linkedinFollowups.ts.
 *
 * Damit daraus keine zweite, driftende Wahrheit wird, ist die Regel als EINE
 * reine Funktion (`istDuBistDran`) isoliert und wird von
 * `npx tsx scripts/verify-antwort-entwuerfe.ts` Fall für Fall gegen `bucketOf`
 * gegengeprüft. Weicht eine Seite ab, schlägt das Skript fehl.
 */

/**
 * Höchstens so viele Threads gehen in einen Lauf — ein Agent, ein überschaubarer
 * Auftrag.
 *
 * **Von 20 auf 10 gesenkt am 14.08.2026.** Der Lauf ist seit dem 04.08. jeden
 * Morgen ins 10-Minuten-Limit gerannt („ZEITLIMIT ERREICHT") und hat damit gar
 * nichts geliefert. Zehn fertige Entwürfe sind mehr als zwanzig abgebrochene.
 *
 * **Am 19.08.2026 auf 18 angehoben.** Kevins Befund: In seiner Antworten-Spur
 * standen echte Makler ohne Entwurf (Evernest-Lizenzpartner, Kloppestates),
 * weil der Deckel vor ihnen zuging — „ich versteh gar nicht, warum da kein
 * Entwurf da ist, so bringt mir das Ganze nix." Der Lauf vom 19.08. brauchte
 * für zehn Entwürfe 2:21 Minuten; 18 passen mit Reserve ins 10-Minuten-Limit.
 * Zugleich schrumpft der Vorrat dauerhaft, weil `agent_urteil = 'akquise'`
 * unten dauerhaft aussortiert.
 */
export const ANTWORT_MAX = 18

/**
 * Hat der Thread schon einen brauchbaren Entwurf?
 *
 * Das war der eigentliche Grund für den Stau: Die Auswahl kannte nur „wartet auf
 * Kevin", nicht „ist schon entworfen". Also nahm sich der Agent jeden Morgen
 * dieselben 20 ältesten Threads erneut vor, schrieb Entwürfe, die längst am
 * Posten hingen, und kam nie zu den 21 dahinter.
 *
 * Veraltet heißt: der Lead hat NACH dem Entwurf noch einmal geschrieben — dann
 * antwortet der alte Text auf eine überholte Nachricht und muss neu.
 */
export function hatFrischenEntwurf(thread, regelStand = stimmeStand()) {
  const text = typeof thread.entwurf === 'string' ? thread.entwurf.trim() : ''
  if (!text) return false
  if (!thread.entwurf_at) return true
  const entworfen = new Date(thread.entwurf_at).getTime()
  if (entworfen < regelStand) return false
  if (!thread.last_message_at) return true
  return entworfen >= new Date(thread.last_message_at).getTime()
}

/**
 * Seit wann gilt Kevins Stimme in ihrer jetzigen Fassung? (28.09.2026)
 *
 * Bis heute zählte ein Entwurf als frisch, solange der Lead danach nichts mehr
 * geschrieben hatte — egal, nach welchen Regeln er entstanden war. Am 28.09.
 * standen deshalb 16 von 18 Entwürfen in der Antworten-Spur, die im August nach
 * der alten Fassung geschrieben waren (Geviertstriche, „kostet dich nichts",
 * „Soll ich?"). Jetzt veraltet ein Entwurf auch, wenn die Stimm-Datei nach ihm
 * geändert wurde, und die nächste Runde schreibt ihn neu.
 *
 * Gemessen wird die Commit-Zeit der Datei, nicht ihre Änderungszeit auf der
 * Platte: Der Mini holt eine Regel erst Minuten bis Stunden nach dem Commit.
 * Mit der Plattenzeit hätte er Entwürfe, die Kevin dazwischen auf dem Laptop
 * nach der NEUEN Regel geprüft hat, für veraltet gehalten und überschrieben.
 * Ohne git (oder uncommittet) gilt die Plattenzeit.
 */
const STIMME = fileURLToPath(new URL('../regeln/stimme/herrmann-outreach.md', import.meta.url))
let stimmeCache = { at: 0, wert: 0 }
export function stimmeStand() {
  if (Date.now() - stimmeCache.at < 60_000) return stimmeCache.wert
  let wert = 0
  try {
    const sek = execFileSync('git', ['log', '-1', '--format=%ct', '--', STIMME], {
      cwd: dirname(STIMME), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain', '--', STIMME], {
      cwd: dirname(STIMME), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    wert = sek && !dirty ? Number(sek) * 1000 : statSync(STIMME).mtimeMs
  } catch {
    try { wert = statSync(STIMME).mtimeMs } catch { wert = 0 }
  }
  stimmeCache = { at: Date.now(), wert }
  return wert
}

/**
 * Ist die Person überhaupt Kevins Zielgruppe? (18.08.2026)
 *
 * Der Agent schrieb bis heute für JEDEN, der zurückgeschrieben hat — auch für
 * Coaches, Recruiter und KI-Verkäufer, die Kevin akquirieren wollten. Von 30
 * erzeugten Entwürfen gingen 9 an solche Profile, darunter „Hi Angelique,
 * wonach bist du auf der Suche in der Gründerkommune?". Kevins Urteil:
 * „absolute Token-Verschwendung".
 *
 * `unklar` zählt bewusst als Zielgruppe: Die Headline ist Freitext, und ein
 * fälschlich übergangener Makler ist teurer als ein Entwurf zu viel. Der
 * Thread selbst bleibt in jedem Fall sichtbar — gefiltert wird nur, wofür der
 * Agent Zeit und Token ausgibt.
 */
function istZielgruppe(thread) {
  return istArbeitsVorrat(icpUrteil(thread.company, thread.name).urteil)
}

/**
 * Hat der Agent den Thread schon als Akquise-Versuch erkannt? (19.08.2026)
 *
 * Der Wortlisten-Filter oben sieht nur die Headline, und die verrät die
 * Absicht oft nicht: „Schritt für Schritt ein erfolgreiches Unternehmen
 * aufbauen" liest sich harmlos — im Chat steht ein Verkaufsversuch. Wer da
 * schreibt, weiss nur, wer die NACHRICHT gelesen hat. Genau das tut der Agent,
 * und sein Urteil (Migration 0075) gilt ab dann dauerhaft: Kevin soll denselben
 * Verkäufer nicht jeden Morgen erneut vorgelegt bekommen.
 *
 * Bewusst ohne Verfallsdatum. Schreibt ein Akquisiteur erneut, ist er immer
 * noch Akquisiteur — eine zweite Nachricht macht aus ihm keinen Lead.
 */
function istAkquiseVersuch(thread) {
  return thread.agent_urteil === 'akquise'
}

/** Endzustände: hier ist nichts mehr zu tun (Spiegel von `isTerminal`). */
function istEndzustand(status) {
  return status === 'archived' || status === 'won' || status === 'lost'
}

/**
 * Der Lead hat geschrieben und wartet auf Kevin. Spiegel des `du_bist_dran`-Zweigs
 * aus `bucketOf`: Endzustand und Schlummer stechen, danach entscheidet allein
 * `last_from === 'them'` — eine Antwort schlägt jede Follow-up-Stufe.
 */
export function istDuBistDran(thread, now) {
  if (istEndzustand(thread.status)) return false
  if (thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now.getTime()) return false
  return thread.last_from === 'them'
}

/**
 * Endstationen in der Lead-Kartei (29.09.2026). Wer dort Kunde, aussortiert
 * oder ruhend ist, bekommt keinen Akquise-Text mehr, egal was sein Thread sagt.
 *
 * Anlass: Reichentrog stand seit August als `kunde` in `leads`, sein Thread aber
 * weiter auf `active` — die Nachtrunde fragte ihn deshalb jede Nacht aufs Neue
 * nach einer Referenz. Kevin: *„Reichentrog kommt immer wieder vor, das nervt."*
 */
export const LEAD_ENDSTATUS = new Set(['kunde', 'disqualifiziert', 'ruht'])

/**
 * Nachfassen in einem laufenden Gespräch (29.09.2026).
 *
 * Die festen Follow-up-Vorlagen (`followupVorlagen.ts`) sind für Leute gebaut,
 * die nie geantwortet haben: Dort gibt es nichts, worauf ein Text eingehen
 * könnte. Sie landeten aber auch bei Leads MIT Gesprächsverlauf. Valerius hatte
 * geschrieben, seine Seite werde überarbeitet; sechs Monate später bot ihm die
 * Vorlage „eine Analyse zu eurer Website" an — zur alten Seite. Kevin: *„da
 * sollte wieder kommen, wann sie online geht, dann schaue ich sie mir an."*
 *
 * Diese Threads schreibt deshalb der Antwort-Agent, mit der letzten Antwort des
 * Leads als Anker. Ausgenommen:
 * - Loom verschickt → dafür gibt es die Loom-Reihe mit eigenen Texten.
 * - Ja gesagt, Loom offen (Stern) → die nächste Nachricht ist das Loom selbst,
 *   keine Ankündigung.
 *
 * Eigener Deckel, eigene Läufe: Die Nachtrunde schickt erst die Antworten,
 * dann das Nachfassen in Paketen zu `ANTWORT_MAX` an den Agenten
 * (`antwortLaeufe` im Runner), jedes Paket mit dem vollen Zeit- und
 * Geldrahmen. 18 Antworten brauchten am 28.09. 5½ Minuten von zehn.
 */
export const NACHFASSEN_MAX = 20

/**
 * Wie viele Nachfass-Texte eine Nacht schreibt, folgt Kevins Tagesziel für
 * Follow-ups (`ui_settings.tagesFlowZiele.followups`, am 29.09.2026 auf 40
 * gesetzt). Ohne Einstellung gilt `NACHFASSEN_MAX` = `FOLLOWUP_PORTION_TAG`.
 * Eine eigene, kleinere Zahl hier hieße: Die Liste fordert 40, und ab Platz
 * sieben steht kein Text daneben.
 */
export function nachfassDeckel(tagesFlowZiele) {
  const n = Number(tagesFlowZiele?.followups)
  return Number.isInteger(n) && n > 0 ? n : NACHFASSEN_MAX
}
/** Spiegel von `klassenRang` (app/src/cockpit/lib/leadKlasse.ts). */
export function klassenRang(klasse) {
  return klasse === 'A' ? 0 : klasse === 'B' ? 1 : klasse === 'C' ? 3 : 2
}

/** Frühestens nach der ersten Follow-up-Schwelle (`FOLLOWUP_THRESHOLDS_DAYS[0]`). */
export const NACHFASSEN_AB_TAGEN = 3

/**
 * @param {object} thread
 * @param {Date} now
 * @param {Map<string, {text: string, ts: string}>} antwortenJeLead  lead_id → letzte Antwort des Leads
 */
export function istNachfassFall(thread, now, antwortenJeLead = new Map()) {
  if (istEndzustand(thread.status)) return false
  if (thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now.getTime()) return false
  if (thread.last_from !== 'me') return false
  if (!Number.isInteger(thread.followup_stage) || thread.followup_stage < 0 || thread.followup_stage >= 3) return false
  if (thread.loom_status === 'verschickt') return false
  if (thread.starred && thread.loom_status === 'offen') return false
  const tage = tageSeit(thread.last_message_at, now)
  if (tage == null || tage < NACHFASSEN_AB_TAGEN) return false
  return hatGeantwortet(thread, antwortenJeLead)
}

/**
 * Stichtag der neuen Lead-Recherche (29.09.2026, Spiegel von
 * `FOLLOWUP_NUR_SENDEFERTIG.neuerTextVor` im Cockpit). Erstnachrichten davor
 * entstanden mit Haiku + WebFetch und trugen nachweislich falsche Befunde
 * (`leadRecherche.mjs`). Die feste Vorlage würde sie nur wieder hochholen.
 */
export const RECHERCHE_NEU_AB = '2026-09-16'

/**
 * Kalter Thread (nie geantwortet) auf einer Erstnachricht vor dem Stichtag:
 * Der Agent prüft die Seite neu und schreibt einen frischen Text, statt dass
 * die Vorlage die alte, womöglich falsche Nachricht hochholt. Kevin: *„dann
 * werden wir auch im Follow-up die Leute nicht bekommen."*
 */
export function istNeuPruefFall(thread, now, antwortenJeLead = new Map(), stichtag = RECHERCHE_NEU_AB) {
  if (istEndzustand(thread.status)) return false
  if (thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now.getTime()) return false
  if (thread.last_from !== 'me') return false
  if (!Number.isInteger(thread.followup_stage) || thread.followup_stage < 0 || thread.followup_stage >= 3) return false
  if (thread.loom_status === 'verschickt') return false
  if (thread.starred && thread.loom_status === 'offen') return false
  if (hatGeantwortet(thread, antwortenJeLead)) return false
  // Ohne Analyse-Angebot passt die Vorlage nicht (Seite offline, keine Seite,
  // Fokus-Frage): Spiegel von `botAnalyseAn` im Cockpit.
  if (!botAnalyseAn(thread)) return true
  const t = thread.last_message_at ? new Date(thread.last_message_at).getTime() : NaN
  return Number.isFinite(t) && t < new Date(stichtag).getTime()
}

/** Kevins letzte Nachricht bot die Analyse an. Unbekannter Text zählt als Ja. */
export function botAnalyseAn(thread) {
  const eigene = Array.isArray(thread.verlauf) ? thread.verlauf.filter((m) => m?.sender === 'me' && m.text) : []
  const text = eigene.length ? eigene[eigene.length - 1].text : thread.last_from === 'me' ? String(thread.preview ?? '') : ''
  if (!text.trim()) return true
  return /analyse|rüberschick|zusenden/i.test(text)
}

/** Hat der Lead in diesem Gespräch je geschrieben? Verlauf ODER Lead-Ereignis. */
export function hatGeantwortet(thread, antwortenJeLead = new Map()) {
  if (thread.lead_id && antwortenJeLead.has(thread.lead_id)) return true
  return Array.isArray(thread.verlauf) && thread.verlauf.some((m) => m?.sender === 'them')
}

/** Die letzte Nachricht des Leads: aus dem Verlauf, sonst aus dem Lead-Ereignis. */
function letzteAntwortDesLeads(thread, antwortenJeLead) {
  const ausVerlauf = Array.isArray(thread.verlauf)
    ? [...thread.verlauf].reverse().find((m) => m?.sender === 'them' && m.text)
    : null
  if (ausVerlauf) return { text: ausVerlauf.text, ts: ausVerlauf.ts ?? null }
  return (thread.lead_id && antwortenJeLead.get(thread.lead_id)) || null
}

/** Tage seit der letzten Nachricht — über Millisekunden, nie über Kalendertage. */
function tageSeit(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000))
}

/**
 * Baut den Agenten-Input. `verlauf` wird als Array durchgereicht, nicht zu Text
 * gerendert — der Skill liest das Format direkt, und so gibt es keine zweite
 * Formatierungslogik neben der Cockpit-Seite.
 */
export function baueAntwortInput(threads, now = new Date(), max = ANTWORT_MAX, nachfassen = null) {
  // Gleiche Rangfolge wie `dringlichkeit` in prioritaet.ts: Stern zuerst, dann
  // der am längsten Wartende. Nur so decken die entworfenen Threads exakt die
  // obersten Posten der Arbeitsliste ab — sonst hinge der Entwurf am falschen Namen.
  const dran = threads
    // Wer schon einen frischen Entwurf hat, ist erledigte Arbeit — er blockiert
    // sonst jeden Lauf und der Rückstau dahinter kommt nie dran.
    .filter((t) => istDuBistDran(t, now) && !hatFrischenEntwurf(t))
    .sort((a, b) => {
      const stern = Number(Boolean(b.starred)) - Number(Boolean(a.starred))
      if (stern !== 0) return stern
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : Number.POSITIVE_INFINITY
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : Number.POSITIVE_INFINITY
      return ta - tb
    })

  const basis = (t) => ({
    thread_key: t.thread_key,
    contact_id: t.contact_id ?? null,
    name: t.name,
    company: t.company,
    profile_url: t.profile_url,
    preview: t.preview,
    verlauf: Array.isArray(t.verlauf) ? t.verlauf : [],
    tage_seit_antwort: tageSeit(t.last_message_at, now),
    followup_stage: t.followup_stage,
    starred: Boolean(t.starred),
    loom_status: t.loom_status ?? 'offen',
  })

  // Nachfassen kommt NACH den Antworten und hat einen eigenen Deckel: Wer
  // geschrieben hat, wartet dringender als der, dem Kevin zuletzt schrieb.
  const antwortenJeLead = nachfassen?.antwortenJeLead ?? new Map()
  // Reihenfolge wie die Follow-up-Spur im Cockpit (`followupPosten`): Klasse A,
  // B, ungeprüft, C, darin die meisten Punkte zuerst. Nur so hängen die Texte an
  // den Posten, die Kevin oben sieht, und nicht an Neujahrsgrüßen vom Januar.
  const klassen = nachfassen?.klassen ?? new Map()
  const rang = (t) => {
    const k = t.lead_id ? klassen.get(t.lead_id) : undefined
    return { r: klassenRang(k?.klasse), p: typeof k?.punkte === 'number' ? k.punkte : -1 }
  }
  const artVon = (t) =>
    istNachfassFall(t, now, antwortenJeLead) ? 'nachfassen' : istNeuPruefFall(t, now, antwortenJeLead) ? 'neu_pruefen' : null
  const fassen = (nachfassen?.threads ?? [])
    .filter((t) => artVon(t) && !hatFrischenEntwurf(t))
    .sort((a, b) => {
      const ra = rang(a)
      const rb = rang(b)
      return ra.r - rb.r || rb.p - ra.p || new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    })
  const fassenMax = nachfassen?.max ?? NACHFASSEN_MAX

  return {
    weitereWarten: Math.max(0, dran.length - max),
    weitereNachfassen: Math.max(0, fassen.length - fassenMax),
    input: {
      threads: [
        ...dran.slice(0, max).map((t) => ({ art: 'antwort', ...basis(t) })),
        ...fassen.slice(0, fassenMax).map((t) => ({
          art: artVon(t),
          ...basis(t),
          tage_seit_antwort: null,
          tage_seit_kevin: tageSeit(t.last_message_at, now),
          letzte_antwort_lead: letzteAntwortDesLeads(t, antwortenJeLead),
        })),
      ],
    },
  }
}

/**
 * Holt die wartenden Threads über PostgREST. Grob vorgefiltert auf der DB-Seite,
 * die endgültige Entscheidung trifft `istDuBistDran` — es gibt genau eine Regel.
 * `select=*` mit Absicht: die Spalte `verlauf` (0064) darf noch fehlen, ohne dass
 * die Abfrage mit HTTP 400 auffliegt.
 */
export async function holeAntwortThreads({ supabaseUrl, headers, brandSlug = 'herrmann', now = new Date() }) {
  const br = await fetch(
    `${supabaseUrl}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
    { headers },
  )
  if (!br.ok) throw new Error(`Brand-Abfrage HTTP ${br.status}`)
  const [brand] = await br.json()
  if (!brand?.id) throw new Error(`Kein Brand mit slug="${brandSlug}"`)

  const rows = await holeAlle(
    supabaseUrl,
    headers,
    `linkedin_threads?brand_id=eq.${brand.id}&last_from=eq.them` +
      `&status=in.(active,waiting_reply)&select=*&order=last_message_at.asc`,
  )
  const [endLeads, antwortEreignisse, kevinZuletzt, klassenZeilen, ziele] = await Promise.all([
    holeAlle(supabaseUrl, headers, `leads?brand_id=eq.${brand.id}&lead_status=in.(${[...LEAD_ENDSTATUS].join(',')})&select=id&order=id`),
    holeAlle(
      supabaseUrl,
      headers,
      `lead_ereignisse?brand_id=eq.${brand.id}&typ=eq.antwort_erhalten&select=lead_id,at,details&order=at.asc`,
    ).catch(() => []),
    holeAlle(
      supabaseUrl,
      headers,
      `linkedin_threads?brand_id=eq.${brand.id}&last_from=eq.me&followup_stage=lt.3` +
        `&status=in.(active,waiting_reply)&select=*&order=last_message_at.asc`,
    ),
    holeAlle(
      supabaseUrl,
      headers,
      `leads?brand_id=eq.${brand.id}&klasse=not.is.null&select=id,klasse,punkte:profil->punkte&order=id`,
    ).catch(() => []),
    holeAlle(supabaseUrl, headers, `ui_settings?setting_key=eq.tagesFlowZiele&select=setting_value&order=updated_at.desc`).catch(
      () => [],
    ),
  ])
  const klassen = new Map(klassenZeilen.map((z) => [z.id, { klasse: z.klasse, punkte: z.punkte }]))
  const amEnde = new Set(endLeads.map((l) => l.id))
  const keinEndLead = (t) => !(t.lead_id && amEnde.has(t.lead_id))

  // Aufsteigend sortiert: die jüngste Antwort überschreibt die älteren.
  const antwortenJeLead = new Map()
  for (const e of antwortEreignisse) {
    if (!e.lead_id) continue
    antwortenJeLead.set(e.lead_id, { text: String(e.details?.auszug ?? ''), ts: e.at ?? null })
  }

  const wartend = rows.filter((t) => istDuBistDran(t, now))
  const threads = wartend.filter(
    (t) => istZielgruppe(t) && !istAkquiseVersuch(t) && keinEndLead(t) && !wartetAufLoom(t),
  )
  // Nachfassen nur, wo die Follow-up-Spur im Cockpit ihn auch zeigt: Zielgruppe,
  // kein Akquise-Versuch und kein reiner Kontakt (Spiegel von `followupPosten`).
  const nachfassen = kevinZuletzt.filter(
    (t) => istZielgruppe(t) && !istAkquiseVersuch(t) && t.agent_urteil !== 'kontakt' && keinEndLead(t),
  )
  // Die Zahl gehört ins Lauf-Ergebnis, nicht ins Nichts: Wenn der Filter eines
  // Tages zu scharf greift, sieht man es an dieser Zeile und nicht daran, dass
  // ein Kunde nie eine Antwort bekam.
  return {
    brandId: brand.id,
    threads,
    uebersprungenOffIcp: wartend.length - threads.length,
    nachfassen: { threads: nachfassen, antwortenJeLead, klassen, max: nachfassDeckel(ziele[0]?.setting_value) },
  }
}

/**
 * Ja zur Analyse, Loom noch offen (29.09.2026): Die Antwort darauf ist das Loom
 * selbst, keine Ankündigung. Kevin: *„im Normalfall braucht kein Loom länger als
 * 24 Stunden."* Vorher schrieb der Agent hier „Kommt diese Woche bei dir an" —
 * fünfzehnmal fast wortgleich, bis zu elf Wochen nach dem Ja. Spiegel des
 * Filters in `antwortPosten`; diese Leute stehen in der Loom-Spur.
 */
export function wartetAufLoom(thread) {
  return Boolean(thread.starred) && thread.loom_status === 'offen'
}

/** PostgREST liefert höchstens 1000 Zeilen je Abfrage — seitenweise holen. */
async function holeAlle(supabaseUrl, headers, pfad, seite = 1000) {
  const alle = []
  for (let offset = 0; ; offset += seite) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${pfad}&limit=${seite}&offset=${offset}`, { headers })
    if (!res.ok) throw new Error(`${pfad.split('?')[0]} HTTP ${res.status}`)
    const teil = await res.json()
    alle.push(...teil)
    if (teil.length < seite) return alle
  }
}
