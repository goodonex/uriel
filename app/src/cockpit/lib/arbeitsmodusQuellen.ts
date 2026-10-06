/**
 * Übersetzt bestehende Domänen-Listen (LinkedIn-Threads, Erstnachrichten) in
 * Posten für die Prioritätenliste (Wargame docs/wargames/sales-arbeitsmodus.md,
 * Zug 1/3/5). Reine Funktionen — verwendet ausschließlich die bereits
 * bestehende Bucket-Logik aus `linkedinFollowups.ts`, modelliert nichts neu.
 *
 * ID-Konvention: `<quelle>:<id-der-zugrunde-liegenden-zeile>` — Zug 4 liest
 * daraus beim Abhaken zurück, welche Zeile geschrieben werden muss.
 */
import type { Erstnachricht } from '../../hooks/useErstnachrichten'
import type { LinkedinThread } from '../../types/db'
import { istTerminWunsch } from './antwortAbsicht'
import { echtOffeneErstnachrichten, profilNachName } from './erstnachrichtenOffen'
import { brauchtPruefung } from './erstnachrichtenPruefung'
import { threadImVorrat } from './icp'
import { istKunde, kundenSchluessel, type KundenKontakt } from './kundenAbgleich'
import { bucketOf } from './linkedinFollowups'
import { verlaufVon } from './linkedinVerlauf'
import type { Posten, PostenEntwurf } from './prioritaet'
import { followupVorlage, loomVersandVorlage } from './followupVorlagen'
import { klassenRang, type LeadKlassenInfo } from './leadKlasse'

/**
 * Entwurf des Nacht-Agenten am Thread (Migration 0065), sofern einer anliegt.
 *
 * `veraltet` ist die eine Sicherung, die es hier braucht: hat der Lead nach dem
 * Entwurf erneut geschrieben, antwortet der Text auf eine überholte Nachricht.
 * Der Entwurf wird dann angezeigt, aber markiert — verworfen wird er nicht,
 * denn oft trägt er trotzdem.
 */
function entwurfVon(t: LinkedinThread): PostenEntwurf | undefined {
  const text = typeof t.entwurf === 'string' ? t.entwurf.trim() : ''
  if (!text) return undefined
  const erstelltAm = t.entwurf_at ?? null
  const veraltet =
    erstelltAm != null &&
    t.last_message_at != null &&
    new Date(t.last_message_at).getTime() > new Date(erstelltAm).getTime()
  return { text, veraltet, erstelltAm }
}

function threadZuPosten(t: LinkedinThread, spur: Posten['spur'], praefix: string, text: string): Posten {
  // Ein Termin-Wunsch unter „Antworten" sagt das gleich vorne — und trägt
  // keinen Stern, der in der Oberfläche „Loom zugesagt" hieße (06.10.2026).
  const termin = spur === 'antwort' && istTerminWunsch(t)
  return {
    id: `${praefix}:${t.id}`,
    spur,
    name: t.name || 'Unbekannt',
    firma: t.company || undefined,
    // Bei Threads ist der nützliche Link das LinkedIn-Profil — dort findet
    // die eigentliche Arbeit (antworten, Loom verschicken) statt.
    website: t.profile_url || undefined,
    text: termin ? `Will einen Termin: ${text}` : text,
    timestamp: t.last_message_at,
    starred: termin ? false : t.starred,
  }
}

/**
 * Der Beginn der Makler-Akquise (18.08.2026).
 *
 * Kevin arbeitet erst seit Januar 2026 auf diese Zielgruppe. Was davor im
 * Postfach liegt, ist kein liegen gebliebener Lead, sondern Post von Leuten,
 * die IHN akquiriert haben — Closer-Anfragen, Recruiter, Agenturen aus einem
 * anderen Leben. Vier solche Threads aus April/Mai 2025 standen als „älteste
 * 492 Tage" ganz oben in der Antworten-Spur und schoben die echten Leads nach
 * unten.
 *
 * Das Datum gilt NUR für die Antworten-Spur. Für Threads, die Kevin selbst
 * angeschrieben hat, bleibt seine Regel „nichts, was liegen geblieben ist,
 * fällt weg" (linkedinFollowups.ts) unangetastet.
 */
export const AKQUISE_START = '2026-01-01'

/** Eingegangen, bevor Kevin auf Makler umgestellt hat — nicht seine Akquise. */
function vorDerAkquise(t: LinkedinThread): boolean {
  return t.last_message_at != null && t.last_message_at < AKQUISE_START
}

/**
 * Wartet dieser Thread wirklich auf eine Antwort von Kevin?
 *
 * `bucketOf === 'du_bist_dran'` allein reicht nicht — drei Sorten stehen dort
 * zu Unrecht (alle drei am 18.08.2026 an echten Daten belegt, 29 Einträge):
 *
 * - **Off-ICP** (nicht seine Zielgruppe) → `icp.ts`, siehe unten.
 * - **Loom zugesagt** (Stern + `loom_status: 'offen'`): Diese Leute warten
 *   nicht auf Text, sondern auf ein Video — sie stehen in der Loom-Spur.
 *   Bis hierher standen sie in BEIDEN Listen, 13 von 29. Kevins Satz dazu:
 *   „Die den muss ich ja nicht antworten, also müssen die da raus."
 *   Bewusst an `loom_status: 'offen'` geknüpft und nicht am Stern allein:
 *   Schreibt jemand NACH dem verschickten Loom nochmal, wartet er wieder auf
 *   eine Antwort und gehört zurück in diese Spur.
 * - **Vor der Akquise** eingegangen → `AKQUISE_START`.
 */
/**
 * Ein Akquise-Versuch, vom Entwurfs-Agenten am Nachrichtentext erkannt
 * (19.08.2026, Migration 0075).
 *
 * Der Wortlisten-Filter unten liest nur die LinkedIn-Headline, und die verrät
 * die Absicht nicht: „Schritt für Schritt ein erfolgreiches Unternehmen
 * aufbauen" (Verkäufer) und „90 Tage: Leben, Business und Energie im Einklang"
 * (Coach) standen beide in Kevins Antworten-Spur. Sein Einwand: „Brauche ich
 * bei den Antworten, die ich schnell rausschicken möchte, Leute, die mich
 * akquirieren wollen?" Nein — sie stehen ab jetzt in der Klappe darunter.
 */
function istAkquiseVersuch(t: LinkedinThread): boolean {
  return t.agent_urteil === 'akquise'
}

/**
 * Kevins Ja/Nein zum Loom (03.10.2026). Gilt, solange der Lead danach nicht
 * erneut geschrieben hat — dann wartet er wieder auf eine Antwort.
 *
 * Der Klick schreibt nur ein Ereignis; Stern und `last_from` gehören dem Sync
 * und springen zurück. Ohne dieses Urteil stand der Lead nach dem nächsten Lauf
 * wieder unter „Antworten".
 */
export type LoomUrteile = ReadonlyMap<string, { zugesagt: boolean | null; at: number; erledigtAt?: number }>

function urteilGilt(t: LinkedinThread, urteile?: LoomUrteile) {
  const u = t.lead_id ? urteile?.get(t.lead_id) : undefined
  if (!u || u.zugesagt === null) return null
  const nachricht = t.last_message_at ? new Date(t.last_message_at).getTime() : NaN
  // Nachricht nach dem Urteil → überholt. Unlesbares Datum → Urteil gilt.
  return !Number.isNaN(nachricht) && nachricht > u.at ? null : u
}

/**
 * Der Stern als Loom-Ja — außer der Lead will einen Termin (06.10.2026).
 *
 * Manuel Rees bekam ein Gesprächsangebot und antwortete „Machen Sie gerne einen
 * Termin mit meiner Kollegin". Der Thread trug einen Stern, und der galt hier
 * blind als „Loom zugesagt": Rees stand in der Loom-Spur statt unter
 * „Antworten". Ein Termin-Wunsch (`antwortAbsicht.ts`) sticht den Stern.
 */
function sternIstLoomJa(t: LinkedinThread): boolean {
  return Boolean(t.starred) && !istTerminWunsch(t)
}

/**
 * `urteilGilt`, aber ein Termin-Wunsch entwertet das abgeleitete Ja.
 *
 * `scripts/leads-sync.ts` macht aus dem Stern ein `loom_zugesagt` und stempelt
 * es mit dem Zeitpunkt der Nachricht selbst. Will diese Nachricht einen Termin,
 * zählt nur ein Ja, das Kevin DANACH gegeben hat („Loom ja" im Cockpit, „Video
 * ja" in der Anrufliste) — das ist dann seine Entscheidung, nicht die des Sterns.
 */
function loomUrteilGilt(t: LinkedinThread, urteile?: LoomUrteile) {
  const u = urteilGilt(t, urteile)
  if (!u || u.zugesagt !== true || !istTerminWunsch(t)) return u
  const nachricht = t.last_message_at ? new Date(t.last_message_at).getTime() : NaN
  return !Number.isNaN(nachricht) && u.at > nachricht ? u : null
}

/**
 * Kevins „Erledigt" an einer Antwort (05.10.2026): Er hat den Lead anders
 * bedient (Anruf, Termin) und LinkedIn zeigt weiter die Nachricht des Leads als
 * letzte. Gilt, bis der Lead danach erneut schreibt.
 */
function erledigtGilt(t: LinkedinThread, urteile?: LoomUrteile): boolean {
  const e = t.lead_id ? urteile?.get(t.lead_id)?.erledigtAt : undefined
  if (e == null) return false
  const nachricht = t.last_message_at ? new Date(t.last_message_at).getTime() : NaN
  return Number.isNaN(nachricht) || nachricht <= e
}

function wartetAufAntwort(t: LinkedinThread, heute: Date, urteile?: LoomUrteile): boolean {
  if (bucketOf(t, heute) !== 'du_bist_dran') return false
  if (sternIstLoomJa(t) && t.loom_status === 'offen') return false
  if (loomUrteilGilt(t, urteile) || erledigtGilt(t, urteile)) return false
  if (vorDerAkquise(t)) return false
  if (istAkquiseVersuch(t)) return false
  return true
}

/**
 * Rang 3 — Lead hat geantwortet, wartet auf Kevin.
 * `text` bleibt die Nachricht des Leads (der Kontext), der Entwurf hängt daneben.
 *
 * **Ohne Off-ICP** (18.08.2026). Kevin fand in dieser Liste 52 Namen, von denen
 * über die Hälfte ihn akquirieren wollte — Coaches, Recruiter, KI-Verkäufer.
 * Seine Frage: „Wir haben doch extra einen ICP-Filter, den können wir doch auch
 * über die offenen Nachrichten laufen lassen." Konnten wir nicht: Der Filter
 * stand nur im Skill-Text, nicht im Code. Jetzt schon (`icp.ts`), und zwar
 * für die Anzeige und den Entwurfs-Agenten aus derselben Regel-Datei.
 *
 * `unklar` bleibt drin — die Headline ist Freitext, und ein übersehener Makler
 * ist teurer als ein Name zu viel in der Liste.
 */
export function antwortPosten(
  threads: LinkedinThread[],
  heute: Date,
  kontakte: KundenKontakt[] = [],
  urteile?: LoomUrteile,
): Posten[] {
  const kunden = kundenSchluessel(kontakte)
  return threads
    .filter((t) => wartetAufAntwort(t, heute, urteile))
    .filter((t) => !istKunde(t.name, kunden))
    // Agenten-Urteil vor Headline, siehe `threadImVorrat` (01.10.2026, Metin Moser-Balci).
    .filter(threadImVorrat)
    .map((t) => ({
      ...threadZuPosten(t, 'antwort', 'thread', t.preview || `Antwort an ${t.name || 'den Lead'} vorbereiten.`),
      entwurf: entwurfVon(t),
    }))
}

/**
 * Die Gegenmenge: wer geantwortet hat, aber nicht in die Antworten-Spur gehört
 * — weil er nicht Kevins Zielgruppe ist oder aus der Zeit vor der Akquise
 * stammt.
 *
 * Bewusst abrufbar statt weggeworfen — die Zeile im Sales-Flow nennt die Zahl
 * („27 ausgeblendet") und macht sie auf Klick sichtbar. Ein Filter, den man
 * nicht prüfen kann, ist ein Filter, dem man nicht traut.
 *
 * Zugesagte Looms fehlen hier bewusst: die sind nicht ausgeblendet, sondern
 * eine Zeile weiter unten im Tages-Flow zu sehen.
 */
export function antwortPostenAusgeblendet(threads: LinkedinThread[], heute: Date): Posten[] {
  return threads
    .filter((t) => bucketOf(t, heute) === 'du_bist_dran')
    .filter((t) => !(sternIstLoomJa(t) && t.loom_status === 'offen'))
    .filter(
      (t) =>
        vorDerAkquise(t) ||
        istAkquiseVersuch(t) ||
        !threadImVorrat(t),
    )
    .map((t) => ({
      ...threadZuPosten(t, 'antwort', 'thread', t.preview || `Antwort an ${t.name || 'den Lead'} vorbereiten.`),
      entwurf: entwurfVon(t),
    }))
}

/**
 * Die letzte Nachricht des Leads — die Zusage, wegen der er in dieser Spur steht.
 *
 * Bis zum 19.08.2026 stand an jedem Loom-Posten derselbe Satz („Loom-Analyse für
 * X aufnehmen und verschicken."). Das war Anweisung, keine Information: Kevin
 * weiß, was ein Loom-Posten von ihm will. Was er NICHT weiß, ist, ob der Lead
 * wirklich zugesagt hat — und genau das steht hier jetzt wörtlich.
 *
 * Kam die letzte Nachricht von Kevin selbst, wird das benannt statt kaschiert:
 * dann ist die Zusage älter als der letzte Schriftwechsel und gehört geprüft.
 */
function letzteNachricht(t: LinkedinThread): string {
  const vom = verlaufVon(t)
  const letzte = vom.length > 0 ? vom[vom.length - 1] : null
  const text = (letzte?.text ?? t.preview ?? '').trim()
  if (!text) return `Kein Nachrichtentext gespiegelt — Zusage im Postfach prüfen.`
  const vonKevin = letzte ? letzte.sender === 'me' : t.last_from === 'me'
  return vonKevin ? `Zuletzt hast DU geschrieben: „${text}“` : text
}

/** Rang 4 — Lead hat Ja zum Loom gesagt, Skript/Aufnahme steht noch aus. */
export function loomPosten(threads: LinkedinThread[], urteile?: LoomUrteile): Posten[] {
  return threads
    .filter((t) => t.loom_status === 'offen' && (sternIstLoomJa(t) || loomUrteilGilt(t, urteile)?.zugesagt === true))
    .map((t) => ({
      ...threadZuPosten(t, 'loom', 'loom', letzteNachricht(t)),
      /**
       * Auf ein Ja folgt das Loom selbst, keine Ankündigung (29.09.2026).
       *
       * Bis heute stand hier die Zusage „Alles klar, kommt morgen zu dir",
       * und der Nacht-Agent schrieb „Kommt diese Woche bei dir an" —
       * fünfzehnmal fast wortgleich, bis zu elf Wochen nach dem Ja. Kevin:
       * *„im Normalfall braucht kein Loom länger als 24 Stunden."* Der Text in
       * dieser Spur ist deshalb die Versand-Nachricht; `[Loom-Link]` bleibt
       * sichtbar stehen, bis die Aufnahme hochgeladen ist.
       */
      entwurf: entwurfVon(t) ?? loomVersandVorlage(t),
    }))
}

/** Rang 6 — fällige Follow-ups (bucketOf === 'faellig'). */
export function followupPosten(
  threads: LinkedinThread[],
  heute: Date,
  kontakte: KundenKontakt[] = [],
  /**
   * Thread-IDs, deren Loom nachweislich angesehen wurde (aus
   * `lead_ereignisse.typ = 'loom_angesehen'`, Migration 0079).
   *
   * Steckt nicht am Thread, weil der Player an den Lead meldet, nicht an den
   * Chat — also muss der Aufrufer die Brücke schlagen. Leer heißt „nichts
   * bekannt" und rechnet wie bisher: Ein fehlender Beleg darf nie so wirken,
   * als hätte jemand NICHT geschaut.
   */
  gesichteteThreads: ReadonlySet<string> = new Set(),
  /**
   * Klasse je `lead_id` (22.09.2026, Migration 0092, `useLeadKlassen`). Leer
   * heißt „nichts bekannt" — dann kein Badge und die alte Reihenfolge.
   */
  klassen: ReadonlyMap<string, LeadKlassenInfo> = new Map(),
  /**
   * Thread-IDs, deren Lead schon einmal geantwortet hat (`lead_ereignisse.typ =
   * 'antwort_erhalten'`, 29.09.2026, `useLeadsMitAntwort`). Leer heißt „nichts
   * bekannt" — dann entscheidet allein der Verlauf am Thread.
   */
  beantworteteThreads: ReadonlySet<string> = new Set(),
  /** Siehe `FOLLOWUP_NUR_SENDEFERTIG`. Ohne Angabe wie bisher: jeder fällige Posten, Vorlage als Rückfall. */
  optionen: FollowupOptionen = {},
): Posten[] {
  const kunden = kundenSchluessel(kontakte)
  const neuVor = optionen.neuerTextVor ? new Date(optionen.neuerTextVor).getTime() : null
  /** Braucht der Thread einen neu geschriebenen Text statt der festen Vorlage? */
  const brauchtNeuenText = (t: LinkedinThread) => {
    if (t.loom_status === 'verschickt') return false
    if (imGespraech(t, beantworteteThreads)) return true
    if (optionen.nurNachAnalyseAngebot && !botAnalyseAn(t)) return true
    return neuVor != null && t.last_message_at != null && new Date(t.last_message_at).getTime() < neuVor
  }
  return threads
    .filter((t) => bucketOf(t, heute, undefined, gesichteteThreads.has(t.id)) === 'faellig')
    // Ein laufender Kunde bekommt kein Akquise-Follow-up (18.08.2026).
    .filter((t) => !istKunde(t.name, kunden))
    /**
     * Nachfassen nur bei möglichen Kunden (18.09.2026).
     *
     * Die Spur hatte als einzige keinen ICP-Filter. Kevins Screenshot: oben
     * standen ein Vertriebstrainer, ein Abnehm-Coach, ein Steuerberater und ein
     * KI-Anbieter — neun von dreizehn gar nicht seine Zielgruppe. Raus fliegt,
     * wen die Headline als Off markiert oder wen der Sortierer als
     * Akquise-Versuch bzw. reinen Kontakt eingestuft hat. `unklar` ohne
     * Sortierer-Urteil bleibt drin — ein übersehener Makler kostet mehr als ein
     * Blick zu viel. Seit 01.10.2026 holt ein `lead`-Urteil auch eine Off-Headline
     * zurück (`threadImVorrat`).
     */
    .filter(threadImVorrat)
    .map((t) => ({
      ...threadZuPosten(t, 'followup', 'thread', deineLetzteNachricht(t)),
      /**
       * Ein Agent-Entwurf schlägt die Vorlage — aber die Vorlage springt ein,
       * wenn keiner da ist (25.08.2026).
       *
       * Der Grund, warum das hier steht und nicht in einem nächtlichen Lauf:
       * An diesem Morgen standen 177 fällige Follow-ups ohne einen einzigen
       * Entwurf, und Kevins Arbeitsweise ist Cockpit öffnen, Text kopieren,
       * in LinkedIn einfügen. Kein Text, keine Handlung — das hat den
       * Nachfass-Trichter monatelang trockengelegt.
       *
       * Ein Agent hätte davon zwanzig am Tag bedient. Die Vorlage bedient
       * alle, sofort, ohne Lauf. Und sie verliert dabei nichts: Wer nie
       * geantwortet hat, gibt einem Agenten keinen Anhaltspunkt, auf den er
       * individuell eingehen könnte.
       */
      /**
       * Die Einschränkung dazu (29.09.2026): Die kalte Vorlage gilt nur, wo
       * nie jemand geantwortet hat. Im laufenden Gespräch bot sie Valerius
       * sechs Monate nach „die Seite wird überarbeitet" eine Analyse der
       * alten Seite an. Dort schreibt die Nachtrunde einen Text, der am
       * Gespräch anknüpft (`istNachfassFall` im Runner); bis er da ist, lieber
       * kein Text als der falsche. Die Loom-Reihe bleibt: Die ist genau für
       * Leute gebaut, die Ja gesagt haben.
       */
      entwurf: entwurfVon(t) ?? (brauchtNeuenText(t) ? undefined : followupVorlage(t, gesichteteThreads.has(t.id))),
      ...klasseVon(t.lead_id, klassen),
    }))
    .filter((p) => !optionen.nurMitText || p.entwurf != null)
    /**
     * A zuerst, dann B, dann ungeprüft, dann C — stabil, also innerhalb der
     * Klasse in der bisherigen Reihenfolge. Hier an der Quelle und nicht erst
     * in `ordnePosten`: Die Sales-Tagesliste schneidet ihre 20 direkt aus
     * `quellen.followup`, ohne die Rangfolge zu durchlaufen.
     */
    // Innerhalb der Klasse die höchsten Punkte zuerst (Lead-Bewertung, 24.09.2026).
    .sort((a, b) => klassenRang(a.klasse) - klassenRang(b.klasse) || (b.klassePunkte ?? -1) - (a.klassePunkte ?? -1))
}

export interface FollowupOptionen {
  /** Nur Posten mit sendefertigem Text zeigen; der Rest wartet auf die Nachtrunde. */
  nurMitText?: boolean
  /** Kalte Threads, deren letzte Nachricht vor diesem Datum liegt, bekommen keine Vorlage. */
  neuerTextVor?: string
  /**
   * Die Vorlage nur, wenn Kevins Nachricht die Analyse angeboten hat. Sie holt
   * „es" hoch und bietet die Analyse erneut an — nach „Ist die Seite gerade
   * offline?" oder „Wo finde ich euch?" wäre das eine Analyse einer Seite, die
   * nicht lädt oder nicht existiert (Jan Barendsma, Melina Haller, 29.09.2026).
   */
  nurNachAnalyseAngebot?: boolean
}

/** Kevins letzte Nachricht bot die Analyse an. Unbekannter Text zählt als Ja — dann gilt wie bisher die Vorlage. */
export function botAnalyseAn(t: LinkedinThread): boolean {
  const eigene = verlaufVon(t).filter((m) => m.sender === 'me')
  const text = eigene.length ? eigene[eigene.length - 1].text : t.last_from === 'me' ? (t.preview ?? '') : ''
  if (!text.trim()) return true
  // Aufbau S/T (02.10.2026): Wer eine Skizze statt der Analyse angeboten bekam, kriegt nicht die
  // Vorlage „Ich nehme dir eine Analyse zu eurer Website auf" (die Seite ist ja stark) — die Nachtrunde schreibt den Text.
  if (/skizze/i.test(text) && !/analyse/i.test(text)) return false
  return /analyse|rüberschick|zusenden/i.test(text)
}

/**
 * Die Follow-up-Spur zeigt nur, was Kevin so abschicken kann (29.09.2026).
 *
 * Die feste Vorlage „falls das untergegangen ist, hol ich es kurz hoch" holt
 * die Erstnachricht wieder nach oben. Bis zum 16.09.2026 entstanden diese mit
 * einer Recherche, die nachweislich falsche Befunde lieferte (Haiku + WebFetch,
 * siehe `leadRecherche.mjs`); bei Amadeus stand „keine Seite gefunden", obwohl
 * es eine gab. Kevin: *„dann werden wir auch im Follow-up die Leute nicht
 * bekommen."* 140 von 243 fälligen Follow-ups hingen an so einer Nachricht.
 *
 * Diese Threads bekommen keine Vorlage mehr, sondern einen neu geprüften Text
 * aus der Nachtrunde (`istNeuPruefFall` im Runner) — ebenso laufende Gespräche
 * (`imGespraech`). Bis der Text da ist, stehen sie nicht in der Liste: Ein
 * Posten ohne Text füllt nur Plätze der Tagesportion, die Kevin nicht
 * abarbeiten kann.
 */
export const FOLLOWUP_NUR_SENDEFERTIG: FollowupOptionen = { nurMitText: true, neuerTextVor: '2026-09-16', nurNachAnalyseAngebot: true }

/**
 * Was über dem Entwurf steht: Kevins eigene letzte Nachricht, als solche
 * beschriftet (29.09.2026). Unbeschriftet las Kevin seine Erstnachricht vom
 * Juli — mit Geviertstrichen, „Darf ich …?" und Grußformel — als neuen Text:
 * *„wieso wurde die Nachricht so geschrieben?"*
 */
function deineLetzteNachricht(t: LinkedinThread): string {
  const text = (t.preview ?? '').trim()
  if (!text) return `Follow-up an ${t.name || 'den Lead'}.`
  const d = t.last_message_at ? new Date(t.last_message_at) : null
  const datum = d && !Number.isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
    : null
  return `${datum ? `Deine Nachricht vom ${datum}` : 'Deine letzte Nachricht'} (schon verschickt):\n\n${text}`
}

/** Hat der Lead in diesem Gespräch je geschrieben? Spiegel von `hatGeantwortet` im Runner. */
export function imGespraech(t: LinkedinThread, beantworteteThreads: ReadonlySet<string>): boolean {
  if (beantworteteThreads.has(t.id)) return true
  return verlaufVon(t).some((m) => m.sender === 'them')
}

function klasseVon(leadId: string | null | undefined, klassen: ReadonlyMap<string, LeadKlassenInfo>): Pick<Posten, 'klasse' | 'klasseGrund' | 'klassePunkte'> {
  const k = leadId ? klassen.get(leadId) : undefined
  return k ? { klasse: k.klasse, klasseGrund: k.grund, klassePunkte: k.punkte } : {}
}

/**
 * Rang 5 — versandfertige Erstnachrichten (Migration 0060).
 *
 * Der Haken im Cockpit ist NICHT die einzige Wahrheit: Wer die Nachricht vom
 * Handy verschickt hat, hat einen Thread im Postfach — der zählt genauso
 * (17.08.2026, siehe `erstnachrichtenOffen`). Ohne `threads` verhält sich die
 * Funktion wie vorher.
 */
export function erstnachrichtPosten(
  leads: Erstnachricht[],
  threads: LinkedinThread[] = [],
  netzwerk: { name: string; profile_url: string }[] = [],
): Posten[] {
  const profile = profilNachName(netzwerk)
  return echtOffeneErstnachrichten(leads, threads)
    // Ungeprüfte Fälle (PRÜFEN-Hinweis, keine Website) stehen erst nach Kevins Haken
    // hier — ein Text in dieser Spur geht blind raus (01.10.2026, Stufe „Prüfen").
    .filter((l) => !brauchtPruefung(l))
    // Reihenfolge aus der Quelldatei = Kevins Abarbeitungsreihenfolge (sort_index).
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((l): Posten => ({
      id: `erstnachricht:${l.id}`,
      spur: 'erstnachricht',
      name: l.name,
      firma: l.firma || undefined,
      website: l.website || undefined,
      profil: profile(l.name),
      text: l.nachricht,
      timestamp: null,
    }))
}

/** Strippt das Quell-Präfix (`thread:`, `loom:`, `erstnachricht:`) von einer Posten-ID. */
export function zeilenId(postenId: string): string {
  const idx = postenId.indexOf(':')
  return idx === -1 ? postenId : postenId.slice(idx + 1)
}
