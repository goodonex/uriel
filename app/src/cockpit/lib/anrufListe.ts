/**
 * Die Anrufliste (29.09.2026) — eine Nummer nach der anderen, in Kevins Reihenfolge.
 *
 * Kevin: *„Ich will in die Liste reingehen, sehen, das sind jetzt die 190
 * heißesten, direkt in den ersten reinklicken, auf die Webseite klicken, auf
 * das LinkedIn-Profil klicken … und direkt in einem Dialer eine Nummer nach der
 * anderen anrufen."* Und zur Struktur: angerufen wird ein **Unternehmen**, nicht
 * eine Person — zwei Kontakte derselben Firma sind ein Anruf, und die
 * Kaltakquise-Liste darf niemanden doppelt bringen, den LinkedIn schon kennt.
 *
 * Gruppen (Hitze zuerst), innerhalb nach Punkten (Kaufkraft + Bedarf aus der
 * Bewertung), bei Gleichstand Handy vor Festnetz:
 *   1 Video bekommen        — Loom ist raus, jetzt nachfassen
 *   2 Zusage oder Antwort   — hat geschrieben oder Ja zum Video gesagt
 *   3 Angeschrieben          — Nachricht raus, keine Antwort (Follow-up läuft parallel)
 *   4 Anfrage offen          — hat die Vernetzung nicht angenommen; LinkedIn
 *                              kann ihn nicht mehr erreichen, das Telefon schon
 *   5 Kaltakquise            — aus Kevins Listen, ohne LinkedIn-Bezug
 *
 * Wer gerade nicht dran ist, fällt heraus — ausschließlich über die Anruf-
 * Ereignisse, nie über `lead_status`: Ein „nicht erreicht" darf den Lead nicht
 * aus den Erstnachrichten oder Follow-ups nehmen.
 *
 * Rein, ohne Netz — geprüft von `scripts/verify-anruf-liste.ts`.
 */
import type { ContactListItem, Lead, LeadEreignis, LinkedinThread } from '../../types/db'

export type AnrufGruppe = 1 | 2 | 3 | 4 | 5
export const GRUPPEN: Record<AnrufGruppe, { titel: string; hinweis: string }> = {
  1: { titel: 'Video bekommen', hinweis: 'Die Analyse ist raus — jetzt nachfassen.' },
  2: { titel: 'Zusage oder Antwort', hinweis: 'Hat geschrieben oder Ja zum Video gesagt.' },
  3: { titel: 'Angeschrieben, keine Antwort', hinweis: '„Ich hatte dir auf LinkedIn geschrieben …"' },
  4: { titel: 'Anfrage nicht angenommen', hinweis: 'Per LinkedIn nicht erreichbar — nur per Telefon.' },
  5: { titel: 'Kaltakquise', hinweis: 'Aus deinen Listen, ohne LinkedIn-Kontakt.' },
}

export type AnrufErgebnis =
  | 'gesprochen'
  | 'termin'
  | 'video_ja'
  | 'rueckruf'
  | 'mailbox'
  | 'nicht_erreicht'
  | 'kein_interesse'
  | 'falsche_nummer'

export const ERGEBNISSE: Array<{ key: AnrufErgebnis; label: string; ton: 'gut' | 'neutral' | 'schlecht' }> = [
  { key: 'termin', label: 'Termin', ton: 'gut' },
  { key: 'video_ja', label: 'Video ja', ton: 'gut' },
  { key: 'gesprochen', label: 'Gesprochen', ton: 'gut' },
  { key: 'rueckruf', label: 'Rückruf', ton: 'neutral' },
  { key: 'mailbox', label: 'Mailbox', ton: 'neutral' },
  { key: 'nicht_erreicht', label: 'Nicht erreicht', ton: 'schlecht' },
  { key: 'kein_interesse', label: 'Kein Interesse', ton: 'schlecht' },
  { key: 'falsche_nummer', label: 'Falsche Nr.', ton: 'schlecht' },
]

/** Wie lange ein Ergebnis den Eintrag aus der Liste nimmt (Tage). null = dauerhaft. */
export const RUHE_TAGE: Record<AnrufErgebnis, number | null> = {
  termin: null,
  video_ja: null,
  kein_interesse: null,
  falsche_nummer: null,
  gesprochen: 7,
  rueckruf: 1,
  mailbox: 2,
  nicht_erreicht: 2,
}
/** Nach so vielen Versuchen ohne Durchkommen ruht ein Eintrag zwei Wochen. */
export const MAX_VERSUCHE = 3

export interface AnrufEintrag {
  key: string
  gruppe: AnrufGruppe
  quelle: 'lead' | 'liste'
  leadId: string | null
  listItemId: string | null
  firma: string
  name: string
  rolle: string
  nummer: string
  nummerArt: 'mobil' | 'fest' | 'unbekannt'
  website: string
  linkedin: string
  punkte: number
  grund: string
  /** Weitere bekannte Kontakte derselben Firma. */
  weitere: string[]
  versuche: number
  letzterAnruf: string | null
}

type LeadMitProfil = Lead & { profil?: Record<string, unknown> | null; klasse?: string | null; klasse_grund?: string | null }

export const domainAus = (w: unknown): string =>
  String(w ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim()

/** Nummer auf Ziffern mit Ländervorwahl bringen; deutsche Nummern ohne Vorwahl gelten als +49. */
export function normNummer(roh: unknown): string {
  // Stehen mehrere Nummern im Feld („0176 … / 040 …"), zählt die erste gültige.
  for (const teil of String(roh ?? '').split(/\s*(?:\/(?=\s*(?:\+|0))|,|;|\boder\b|\bund\b|\|)\s*/i)) {
    let s = teil.replace(/\(0\)/g, '').replace(/[^\d+]/g, '')
    if (!s) continue
    if (s.startsWith('00')) s = `+${s.slice(2)}`
    if (!s.startsWith('+')) s = s.startsWith('0') ? `+49${s.slice(1)}` : ''
    if (s.length >= 10 && s.length <= 16) return s
  }
  return ''
}

/**
 * Anzeigename der Firma: Stufe 1 zieht die Firma teils aus der LinkedIn-
 * Headline („Vertriebler auf Provisionsbasis …") — dann lieber die Domain.
 */
export function firmaAnzeige(firma: unknown, domain: string): string {
  const f = String(firma ?? '').trim()
  if (!f) return domain
  if (f.length > 40 || /\s(für|auf|mit|und|bei|von)\s|[:|]/i.test(f)) return domain || f.slice(0, 40)
  return f
}

export function istMobil(e164: string): boolean {
  return /^\+49(15|16|17)\d/.test(e164) || /^\+436\d/.test(e164) || /^\+417[5-9]\d/.test(e164)
}

export function firmaNorm(f: unknown): string {
  return String(f ?? '')
    .toLowerCase()
    .replace(/\b(gmbh|ag|kg|ohg|e\.?\s?k\.?|ug|haftungsbeschränkt|&\s?co\.?|co\.?|immobilien|real estate|makler)\b/g, ' ')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim()
}

const ANRUF_TYP = 'anruf'
const heuteBeginn = (jetzt: Date) => {
  const d = new Date(jetzt)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Ruht der Eintrag gerade? Aus den Anruf-Ereignissen, neuestes zuerst. */
export function ruhtBis(anrufe: Array<{ at: string; details?: Record<string, unknown> | null }>, nummer: string, jetzt: Date): { ruht: boolean; versuche: number; letzter: string | null } {
  const sortiert = [...anrufe].sort((a, b) => b.at.localeCompare(a.at))
  const letzter = sortiert[0] ?? null
  // Versuche ohne Durchkommen seit dem letzten Gespräch.
  let versuche = 0
  for (const a of sortiert) {
    const e = String(a.details?.ergebnis ?? '')
    if (e === 'nicht_erreicht' || e === 'mailbox') versuche++
    else break
  }
  if (!letzter) return { ruht: false, versuche: 0, letzter: null }
  const e = String(letzter.details?.ergebnis ?? '') as AnrufErgebnis
  const t = new Date(letzter.at).getTime()
  // Heute schon angerufen: nicht noch einmal in dieselbe Liste.
  if (t >= heuteBeginn(jetzt)) return { ruht: true, versuche, letzter: letzter.at }
  if (e === 'falsche_nummer') {
    // Nur, solange es dieselbe Nummer ist.
    return { ruht: normNummer(letzter.details?.nummer) === nummer, versuche, letzter: letzter.at }
  }
  if (e === 'rueckruf' && typeof letzter.details?.rueckruf_am === 'string') {
    return { ruht: new Date(letzter.details.rueckruf_am).getTime() > jetzt.getTime(), versuche, letzter: letzter.at }
  }
  const tage = versuche >= MAX_VERSUCHE ? 14 : RUHE_TAGE[e]
  if (tage === null) return { ruht: true, versuche, letzter: letzter.at }
  if (tage === undefined) return { ruht: false, versuche, letzter: letzter.at }
  return { ruht: jetzt.getTime() - t < tage * 86_400_000, versuche, letzter: letzter.at }
}

function gruppeFuer(thread: LinkedinThread | undefined, lead: LeadMitProfil): AnrufGruppe | null {
  if (thread) {
    if (thread.status === 'won' || thread.status === 'lost' || thread.status === 'archived') return null
    if (thread.loom_status === 'entfaellt') return null
    if (thread.loom_status === 'verschickt') return 1
    if (thread.last_from === 'them' || thread.starred) return 2
    return 3
  }
  const li = String(lead.profil?.linkedin_status ?? '')
  return li === 'offen' ? 4 : 3
}

export interface AnrufEingabe {
  leads: LeadMitProfil[]
  threads: LinkedinThread[]
  ereignisse: LeadEreignis[]
  listItems: ContactListItem[]
  jetzt?: Date
}

export interface AnrufListe {
  eintraege: AnrufEintrag[]
  heuteAngerufen: number
  jeGruppe: Record<AnrufGruppe, number>
  ohneNummer: number
}

export function baueAnrufListe({ leads, threads, ereignisse, listItems, jetzt = new Date() }: AnrufEingabe): AnrufListe {
  const threadJeLead = new Map<string, LinkedinThread>()
  for (const t of threads) if (t.lead_id) threadJeLead.set(t.lead_id, t)
  const anrufeJeLead = new Map<string, LeadEreignis[]>()
  let heuteAngerufen = 0
  const heute = heuteBeginn(jetzt)
  for (const e of ereignisse) {
    if (e.typ !== ANRUF_TYP) continue
    anrufeJeLead.set(e.lead_id, [...(anrufeJeLead.get(e.lead_id) ?? []), e])
    if (new Date(e.at).getTime() >= heute) heuteAngerufen++
  }

  // 1. Leads nach Unternehmen bündeln: Domain, sonst Nummer, sonst Firmenname.
  const firmen = new Map<string, Array<{ lead: LeadMitProfil; gruppe: AnrufGruppe }>>()
  let ohneNummer = 0
  for (const lead of leads) {
    if (lead.lead_status === 'disqualifiziert' || lead.lead_status === 'kunde') continue
    const gruppe = gruppeFuer(threadJeLead.get(lead.id), lead)
    if (!gruppe) continue
    const nummer = normNummer(lead.telefon)
    if (!nummer) {
      ohneNummer++
      continue
    }
    const p = lead.profil ?? {}
    const key = domainAus(p.website) || nummer || firmaNorm(p.firma)
    firmen.set(key, [...(firmen.get(key) ?? []), { lead, gruppe }])
  }

  const eintraege: AnrufEintrag[] = []
  const bekannteNummern = new Set<string>()
  const bekannteDomains = new Set<string>()
  const bekannteFirmen = new Set<string>()

  for (const [key, gruppe] of firmen) {
    // Vertreter: heißeste Gruppe, dann Geschäftsführer, dann meiste Punkte.
    const sortiert = [...gruppe].sort(
      (a, b) =>
        a.gruppe - b.gruppe ||
        Number(b.lead.profil?.gf === 'gf') - Number(a.lead.profil?.gf === 'gf') ||
        Number(b.lead.profil?.punkte ?? 0) - Number(a.lead.profil?.punkte ?? 0),
    )
    const { lead, gruppe: g } = sortiert[0]
    const p = lead.profil ?? {}
    const nummer = normNummer(lead.telefon)
    const domain = domainAus(p.website)
    // Alle Kontakte der Firma zählen als bekannt, auch wenn einer gerade ruht.
    bekannteNummern.add(nummer)
    if (domain) bekannteDomains.add(domain)
    if (p.firma) bekannteFirmen.add(firmaNorm(p.firma))
    // Ruht die Firma? Ein Anruf bei irgendeinem ihrer Kontakte zählt.
    const anrufe = sortiert.flatMap((x) => anrufeJeLead.get(x.lead.id) ?? [])
    const r = ruhtBis(anrufe, nummer, jetzt)
    if (r.ruht) continue
    eintraege.push({
      key: `lead:${key}`,
      gruppe: g,
      quelle: 'lead',
      leadId: lead.id,
      listItemId: null,
      firma: firmaAnzeige(p.firma, domain),
      name: lead.name,
      rolle: p.gf === 'gf' ? 'Geschäftsführer' : String(lead.headline ?? '').slice(0, 80),
      nummer,
      nummerArt: istMobil(nummer) ? 'mobil' : 'fest',
      website: p.website ? String(p.website) : '',
      linkedin: lead.profile_url,
      punkte: Number(p.punkte ?? 0),
      grund: String(lead.klasse_grund ?? ''),
      weitere: sortiert.slice(1).map((x) => x.lead.name),
      versuche: r.versuche,
      letzterAnruf: r.letzter,
    })
  }

  // 2. Kaltakquise-Listen, ohne alles, was LinkedIn schon kennt.
  for (const it of listItems) {
    if (it.status === 'kein_interesse' || it.status === 'in_pipeline') continue
    const nummer = normNummer(it.phone)
    if (!nummer) continue
    const domain = domainAus(it.website)
    const firma = firmaNorm(it.company || it.name)
    if (bekannteNummern.has(nummer) || (domain && bekannteDomains.has(domain)) || (firma && bekannteFirmen.has(firma))) continue
    bekannteNummern.add(nummer)
    if (it.called_at && new Date(it.called_at).getTime() >= heute) {
      heuteAngerufen++
      continue
    }
    if (it.status === 'angerufen' && it.called_at && jetzt.getTime() - new Date(it.called_at).getTime() < 2 * 86_400_000) continue
    eintraege.push({
      key: `liste:${it.id}`,
      gruppe: 5,
      quelle: 'liste',
      leadId: null,
      listItemId: it.id,
      firma: it.company || it.name,
      name: it.ansprechpartner || '',
      rolle: it.standort || '',
      nummer,
      nummerArt: istMobil(nummer) ? 'mobil' : 'fest',
      website: it.website || '',
      linkedin: it.linkedin_url || '',
      punkte: it.prio === 'A' ? 60 : it.prio === 'B' ? 40 : 20,
      grund: it.aufhaenger_angriffsflaeche || it.notes || '',
      weitere: [],
      versuche: 0,
      letzterAnruf: it.called_at,
    })
  }

  eintraege.sort(
    (a, b) =>
      a.gruppe - b.gruppe ||
      b.punkte - a.punkte ||
      Number(b.nummerArt === 'mobil') - Number(a.nummerArt === 'mobil') ||
      a.firma.localeCompare(b.firma),
  )
  const jeGruppe = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<AnrufGruppe, number>
  for (const e of eintraege) jeGruppe[e.gruppe]++
  return { eintraege, heuteAngerufen, jeGruppe, ohneNummer }
}
