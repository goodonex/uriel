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
import { echtOffeneErstnachrichten, profilNachName } from './erstnachrichtenOffen'
import { icpUrteil, istArbeitsVorrat } from './icp'
import { istKunde, kundenSchluessel, type KundenKontakt } from './kundenAbgleich'
import { bucketOf } from './linkedinFollowups'
import { verlaufVon } from './linkedinVerlauf'
import type { Posten, PostenEntwurf } from './prioritaet'
import { followupVorlage, loomZusageVorlage } from './followupVorlagen'
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
  return {
    id: `${praefix}:${t.id}`,
    spur,
    name: t.name || 'Unbekannt',
    firma: t.company || undefined,
    // Bei Threads ist der nützliche Link das LinkedIn-Profil — dort findet
    // die eigentliche Arbeit (antworten, Loom verschicken) statt.
    website: t.profile_url || undefined,
    text,
    timestamp: t.last_message_at,
    starred: t.starred,
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

function wartetAufAntwort(t: LinkedinThread, heute: Date): boolean {
  if (bucketOf(t, heute) !== 'du_bist_dran') return false
  if (t.starred && t.loom_status === 'offen') return false
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
): Posten[] {
  const kunden = kundenSchluessel(kontakte)
  return threads
    .filter((t) => wartetAufAntwort(t, heute))
    .filter((t) => !istKunde(t.name, kunden))
    .filter((t) => istArbeitsVorrat(icpUrteil(t.company, t.name).urteil))
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
    .filter((t) => !(t.starred && t.loom_status === 'offen'))
    .filter(
      (t) =>
        vorDerAkquise(t) ||
        istAkquiseVersuch(t) ||
        !istArbeitsVorrat(icpUrteil(t.company, t.name).urteil),
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

/**
 * Hat Kevin auf die Zusage schon geantwortet?
 *
 * Entscheidet darüber, ob die Zusage-Antwort als Entwurf angeboten wird. Kam
 * die letzte Nachricht von ihm, ist sie raus — ein zweites „Alles klar, kommt
 * morgen zu dir" wäre der peinlichste Fehler, den diese Vorlage machen kann.
 */
function kevinHatGeantwortet(t: LinkedinThread): boolean {
  const vom = verlaufVon(t)
  const letzte = vom.length > 0 ? vom[vom.length - 1] : null
  return letzte ? letzte.sender === 'me' : t.last_from === 'me'
}

/** Rang 4 — Lead hat Ja zum Loom gesagt, Skript/Aufnahme steht noch aus. */
export function loomPosten(threads: LinkedinThread[]): Posten[] {
  return threads
    .filter((t) => t.starred && t.loom_status === 'offen')
    .map((t) => ({
      ...threadZuPosten(t, 'loom', 'loom', letzteNachricht(t)),
      /**
       * Zwischen Zusage und fertigem Loom liegt eine Nacht — die Demo-Seite
       * wird über Nacht gebaut. Diese Lücke braucht einen Text, sonst wartet
       * der Lead ohne zu wissen, worauf, und die E-Mail-Adresse holt sich
       * niemand mehr ab: Der Moment direkt nach dem Ja ist der einzige, in
       * dem sie ohne Widerstand rausrückt.
       *
       * Nur solange Kevin noch nicht geantwortet hat — sonst ginge die
       * Nachricht ein zweites Mal raus.
       */
      entwurf: entwurfVon(t) ?? (kevinHatGeantwortet(t) ? undefined : loomZusageVorlage()),
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
): Posten[] {
  const kunden = kundenSchluessel(kontakte)
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
     * Blick zu viel.
     */
    .filter((t) => istArbeitsVorrat(icpUrteil(t.company, t.name).urteil))
    .filter((t) => t.agent_urteil !== 'akquise' && t.agent_urteil !== 'kontakt')
    .map((t) => ({
      ...threadZuPosten(t, 'followup', 'thread', t.preview || `Follow-up an ${t.name || 'den Lead'}.`),
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
      entwurf: entwurfVon(t) ?? followupVorlage(t, gesichteteThreads.has(t.id)),
      ...klasseVon(t.lead_id, klassen),
    }))
    /**
     * A zuerst, dann B, dann ungeprüft, dann C — stabil, also innerhalb der
     * Klasse in der bisherigen Reihenfolge. Hier an der Quelle und nicht erst
     * in `ordnePosten`: Die Sales-Tagesliste schneidet ihre 20 direkt aus
     * `quellen.followup`, ohne die Rangfolge zu durchlaufen.
     */
    // Innerhalb der Klasse die höchsten Punkte zuerst (Lead-Bewertung, 24.09.2026).
    .sort((a, b) => klassenRang(a.klasse) - klassenRang(b.klasse) || (b.klassePunkte ?? -1) - (a.klassePunkte ?? -1))
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
