import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { istTerminWunsch } from './antwortAbsicht.mjs'
import { threadImVorrat } from './icp.mjs'
import { nurTeilweise } from './verlaufTiefe.mjs'

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
 * Hat der Agent den Thread schon gelesen und bewusst KEINEN Text geschrieben,
 * und ist seitdem nichts passiert? (01.10.2026)
 *
 * `hatFrischenEntwurf` kennt nur „Entwurf da". Lehnt der Agent ab (Ja zur
 * Analyse, Gespräch beendet, angestellt), steht kein Entwurf am Thread, und der
 * nächste Lauf legt ihm denselben Thread wieder vor. Bei zwei Läufen am Tag war
 * das teuer, beim 20-Minuten-Takt für Antworten wäre es Dauerverschwendung.
 *
 * `ohneEntwurf`: thread_key → Zeitpunkt (ms) der Ablehnung, geführt vom Runner.
 * Neu vorgelegt wird erst, wenn danach jemand geschrieben hat oder Kevins Stimme
 * sich geändert hat.
 */
export function schonOhneEntwurfGeprueft(thread, ohneEntwurf, regelStand = stimmeStand()) {
  const geprueft = ohneEntwurf?.get?.(thread.thread_key)
  if (!Number.isFinite(geprueft)) return false
  if (geprueft < regelStand) return false
  const letzte = thread.last_message_at ? new Date(thread.last_message_at).getTime() : NaN
  return Number.isFinite(letzte) ? geprueft >= letzte : true
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
 * Ist die Person überhaupt Kevins Zielgruppe? (18.08.2026, neu gefasst 01.10.2026)
 *
 * Der Agent schrieb bis zum 18.08. für JEDEN, der zurückgeschrieben hat — auch
 * für Coaches, Recruiter und KI-Verkäufer, die Kevin akquirieren wollten. Kevins
 * Urteil: „absolute Token-Verschwendung".
 *
 * Seit 01.10. eine einzige Regel für Anzeige und Agent (`threadImVorrat`): Das
 * Agenten-Urteil sticht die Headline. `akquise` UND `kontakt` bekommen keinen
 * Entwurf mehr. Bis heute fiel nur `akquise` raus, und Metin Moser-Balci
 * (Headline `unklar`, privates Bauvorhaben) lief so seit August durch jeden
 * Lauf. `unklar` ohne Urteil bleibt drin: Der Agent liest die Nachricht, urteilt
 * und schreibt bei `kontakt` keinen Text (Skill-Regel), und `entwuerfeAnThreads`
 * verwirft zur Sicherheit jeden Entwurf, der doch kommt.
 */
function istZielgruppe(thread) {
  return threadImVorrat(thread)
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
 * Nachfassen und Neu-Prüfen gehen in Paketen zu sechs an den Agenten (07.10.2026).
 *
 * Jeder dieser Texte braucht eine echte Prüfung der Website. Mit 18 Threads im
 * Drei-Dollar-Rahmen rationierte der Agent: Der Lauf vom 07.10. 08:09 schrieb
 * „Wegen des Budgets nur knapp recherchiert" und lieferte für Kuhnert,
 * Bartelheimer, Slabik und drei weitere Fragen ohne Befund. Bei Kuhnert
 * ersetzte das einen geprüften Text vom Vortag; wittlinger-co.de war nie weg.
 * Kevin: *„die sind alle nicht gut"*. Sechs je Lauf lassen gut 50 Cent je Thread.
 */
export const NACHFASS_PAKET = 6

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
  if (wartetAufLoom(thread)) return false
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
 * Neu prüfen frühestens eine Woche nach Kevins letzter Nachricht (30.09.2026).
 *
 * Anlass: Die Läufe vom 30.09. (03:05 und 08:04) legten 18 Threads als
 * `neu_pruefen` vor, in denen Kevin gestern oder heute selbst geschrieben
 * hatte (`tage_seit_kevin` 0 oder 1). Die Bedingung „kein Analyse-Angebot"
 * trifft auf jede offene Frage zu — auch auf die, die der neu_pruefen-Lauf vom
 * Vortag selbst geschrieben hatte. Der Agent lehnte jeden Entwurf zu Recht ab,
 * kostete aber zweimal täglich Geld und füllte das Protokoll mit Warnungen.
 *
 * Eine Sperre „letzte eigene Nachricht stammt aus einem neu_pruefen-Lauf"
 * gibt das Datenmodell nicht her: Am Thread steht nur `entwurf_run_id`, und
 * derselbe Lauf schreibt Antworten, Nachfassen und neu_pruefen gemischt — die
 * Art wird nirgends gespeichert, und was Kevin tatsächlich abschickt, kommt
 * über den LinkedIn-Abgleich ohne Bezug zum Entwurf zurück. Die Wochenfrist
 * reicht: Ein frisch neu geschriebener Text bekommt so sieben Tage Zeit, bevor
 * ihn jemand anfasst.
 */
export const NEU_PRUEFEN_AB_TAGEN = 7

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
  if (wartetAufLoom(thread)) return false
  if (hatGeantwortet(thread, antwortenJeLead)) return false
  const tage = tageSeit(thread.last_message_at, now)
  if (tage == null || tage < NEU_PRUEFEN_AB_TAGEN) return false
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
  // Aufbau S/T (02.10.2026): Wer eine Skizze statt der Analyse angeboten bekam, kriegt nicht die
  // Vorlage „Ich nehme dir eine Analyse zu eurer Website auf" (die Seite ist ja stark) — die Nachtrunde schreibt den Text.
  if (/skizze/i.test(text) && !/analyse/i.test(text)) return false
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
    // Unvollständiger Verlauf: erst der Tiefenlauf, dann der Entwurf (30.09.2026,
    // André Wackwitz — sonst antwortet der Text nur auf die letzte von zwei Nachrichten).
    // Höchstens drei Stunden: Scheitert der Tiefenlauf an einem Thread, bekommt er trotzdem einen Entwurf.
    .filter((t) => !(nurTeilweise(t) && now.getTime() - (Date.parse(t.last_message_at ?? '') || 0) < 3 * 60 * 60 * 1000))
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
export async function holeAntwortThreads({ supabaseUrl, headers, brandSlug = 'herrmann', now = new Date(), ohneEntwurf = null }) {
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
    (t) => istZielgruppe(t) && keinEndLead(t) && !wartetAufLoom(t) && !nurPlatzhalter(t) && !(ohneEntwurf && schonOhneEntwurfGeprueft(t, ohneEntwurf)),
  )
  // Nachfassen nur, wo die Follow-up-Spur im Cockpit ihn auch zeigt (Spiegel von `followupPosten`).
  const nachfassen = kevinZuletzt.filter(
    (t) => istZielgruppe(t) && keinEndLead(t) && !(ohneEntwurf && schonOhneEntwurfGeprueft(t, ohneEntwurf)),
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
  // Ein Termin-Wunsch mit Stern wartet nicht auf ein Loom, sondern auf eine
  // Antwort (06.10.2026, Manuel Rees). Spiegel von `sternIstLoomJa` im Cockpit.
  return Boolean(thread.starred) && thread.loom_status === 'offen' && !istTerminWunsch(thread)
}

/**
 * Die letzte Nachricht ist eine Sprachnachricht, ein Bild oder eine Datei, die
 * (noch) niemand abgeschrieben hat (29.09.2026). Darauf kann der Agent nichts
 * antworten — Kevin muss selbst reinhören. Eine abgeschriebene Sprachnachricht
 * („[Sprachnachricht] Ja, läuft …") geht dagegen ganz normal durch.
 */
export function nurPlatzhalter(thread) {
  return /^\[[^\]]+\]$/.test(String(thread.preview ?? '').trim())
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
