/**
 * scripts/verify-antwort-absicht.ts — Termin-Wunsch oder Loom-Ja? (06.10.2026)
 *
 * Das Audit vom 06.10. fand Manuel Rees (Reco GmbH, Dresden) in der Loom-Spur.
 * Kevin hatte ihm ein Telefonat angeboten, Rees antwortete „Machen Sie gerne
 * einen Termin mit meiner Kollegin". Aus dem Stern wurde per Sync
 * `loom_zugesagt`, und das zählte als Ja zur Analyse. Dieselbe Verwechslung:
 * Hartmut Schneider und Sven Sommerfeld. Die Gegenprobe sind Kevins echte
 * Loom-Zusagen — auch die „Nein"-Antworten auf „Hast du was dagegen, wenn …"
 * (Uwe Hallas, Richard Otto) müssen Looms bleiben.
 *
 * Alle Texte sind wörtlich aus `linkedin_threads.verlauf` (Stand 06.10.2026).
 * Geprüft werden beide Fassungen der Regel (Cockpit `.ts`, Runner `.mjs`) und
 * jede Stelle, die daraus eine Liste macht.
 *
 *   npx tsx scripts/verify-antwort-absicht.ts
 */
import { istTerminWunsch, istTerminWunschText, kevinsAngebot } from '../app/src/cockpit/lib/antwortAbsicht'
import { antwortPosten, loomPosten, type LoomUrteile } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import { wartetAufLoom as funnelWartetAufLoom } from '../app/src/cockpit/lib/funnelStufen'
import { leadStation } from '../app/src/cockpit/lib/leadStation'
import type { LinkedinThread } from '../app/src/types/db'
// @ts-expect-error — .mjs ohne Typen
import { istTerminWunschText as runnerText, istTerminWunsch as runnerThread } from '../runner/linkedin/antwortAbsicht.mjs'
// @ts-expect-error — .mjs ohne Typen
import { wartetAufLoom as runnerWartetAufLoom } from '../runner/linkedin/antwortThreads.mjs'

let fehler = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) fehler++
}

/* ── Die echten Wechsel: Kevins Nachricht, darauf die Antwort ─────────── */

const ANALYSE_CTA =
  'Ich hab dir dazu eine kurze Analyse vorbereitet. Sie zeigt konkret, wo Potenzial liegen bleibt und was sich daraus für mehr planbare Eigentümer-Anfragen machen lässt.\n\nHast du was dagegen, wenn ich sie dir einmal rüberschicke?'
const SKIZZE_CTA =
  'Ich hab dir dazu eine kurze Skizze vorbereitet, wie das mit Anzeigen für euch aussehen würde. Hast du was dagegen, wenn ich sie dir einmal rüberschicke?'

const TERMIN: [string, string, string][] = [
  [
    'Manuel Rees (Reco GmbH): Termin mit der Kollegin auf Kevins Telefonat-Angebot',
    'Guten Tag Herr Rees, weil wir Immobilienunternehmen helfen, dass Eigentümer von sich aus anfragen, statt dass Mandate nur über Empfehlung und den eigenen Namen kommen. Wenn Sie offen für neue sind, ist das genau der Hebel.\n\nHaben Sie was dagegen, wenn wir zehn Minuten telefonieren?',
    'Machen Sie gerne einen Termin mit meiner Kollegin \nSh@reco-immobilien.de',
  ],
  [
    'Hartmut Schneider: „ruf mich an", Assistentin stellt durch (Kevins Nachricht war eine Sprachnachricht)',
    '[Sprachnachricht]',
    'Hallo Kevin,\n\nGern, ruf mich unter 02224 93780 an, ich sag meiner Assistentin Bescheid, dann stellt sie durch oder ich rufe zurück.\n\nViele Grüße',
  ],
  [
    'Sven Sommerfeld: schickt seine Nummer auf „Wann passt es dir?"',
    'Sehr gerne. Wann passt es dir diese Woche? Schick mir gern deine Nummer, dann ruf ich dich an.',
    'Jetzt 😊 einfach probieren 0176-55363479',
  ],
  ['Marco Stadelmann: „wann hast du Zeit?" auf ein Gesprächsangebot', 'Haben Sie was dagegen, wenn wir zehn Minuten telefonieren?', 'Ja wann hast du Zeit? LG'],
  ['„Nein" auf „Hast du was dagegen, wenn wir telefonieren?" ist ein Ja zum Termin', 'Hast du was dagegen, wenn wir zehn Minuten telefonieren?', 'Nein, gerne'],
  ['Nach dem Analyse-Angebot: „Ruf mich lieber an" ohne Schick-Wunsch', ANALYSE_CTA, 'Ruf mich lieber kurz an, 0171 2345678'],
]

const LOOM: [string, string, string][] = [
  ['Uwe Hallas: „Nein habe ich nicht" auf „Hast du was dagegen …"', ANALYSE_CTA, 'Nein habe ich nicht .'],
  ['Richard Otto: „Nein, schick mal" nach dem Skizzen-Angebot', SKIZZE_CTA, 'Nein , schick mal '],
  ['Deborah Schorn: „Bitte an schorn@…"', ANALYSE_CTA, 'Bitte an schorn@immozebra.ch'],
  ['Enoch Woelfer: „gerne mal zuschicken" mit Mailadresse', ANALYSE_CTA, 'Hey Kevin, kannst du mir gerne mal zuschicken. office@woelfer-realestate.de'],
  ['Thomas Mroch: „Am besten an welcome@…"', ANALYSE_CTA, 'Am besten an welcome@ mroch-newman.de'],
  ['Karam Paggalo: nur die Mailadresse', SKIZZE_CTA, 'kp@assetnow.de'],
  ['Matheus De Souza: „Ja bitte"', ANALYSE_CTA, 'Ja bitte '],
  ['Steven Koller: 👍', ANALYSE_CTA, '👍'],
  [
    'Kayo Kohzadpour: 👍 auf „Video, danach telefonieren" — das Video kommt zuerst',
    'Ich schicke dir dazu ein 2-Minuten-Video (Loom). Dann siehst du sofort, was ich meine, und wir können nächste Woche mal kurz dazu telefonieren. Passt das für dich?',
    '👍',
  ],
  ['Karen Dierks: „ich freue mich auf die Analyse"', ANALYSE_CTA, 'Hallo Kevin,  bitte gerne, ich freue mich auf die Analyse.  Vielennn Dank und Gruß! Karen'],
]

/* Weder Termin noch Loom: sie bleiben, was sie sind. */
const WEDER: [string, string, string][] = [
  [
    'Jens Anger: Absage auf das Telefonat, „Telefon" steht nur im Text',
    'Moin Jens, 14 Tage ist wenigstens ehrlich. Genau da gehen bei vielen Maklern die meisten Anfragen verloren.\n\nHast du was dagegen, wenn wir zehn Minuten telefonieren?',
    'Denke, das macht wenig Sinn. Zunächst sollte man Ironie verstehen. Wenn ein Eigentümer anruft, ist entweder direkt jemand am Telefon (keine Ki) oder innerhalb der nächsten 24 Stunden gibt es einen Rückruf.',
  ],
  [
    'Danny Kremkau: Kevins „bevor sie anrufen" ist kein Gesprächsangebot',
    'Moin Danny,  ich hab nach eurer Website gesucht und keine gefunden. Eigentümer, die verkaufen wollen, prüfen online, mit wem sie es zu tun haben, bevor sie anrufen.  Wo finde ich euch?',
    'Hallo Kevin,  Du hast gut gesucht und zurecht nichts gefunden. Ich bin zur Zeit nicht aktiv auf der Suche um Objekte zu verkaufen. Mit lieben Grüßen, Danny',
  ],
  ['Stefan Spottke: „nicht erreichbar" meint die Website, nicht ihn', 'Wäre das kein Thema für euch, bevor ihr neue Kunden akquiriert?', 'Nein, bisher hatte keine unserer Kunden ein Problem mit der Webseite. Wie kommt es, dass deine Webseite gar nicht erreichbar ist.'],
]

for (const [name, kevin, lead] of TERMIN) {
  check(`Termin — ${name}`, istTerminWunschText(kevin, lead) === true)
  check(`  Runner gleich`, runnerText(kevin, lead) === true)
}
for (const [name, kevin, lead] of [...LOOM, ...WEDER]) {
  check(`kein Termin — ${name}`, istTerminWunschText(kevin, lead) === false)
  check(`  Runner gleich`, runnerText(kevin, lead) === false)
}
check('Kevins Angebot an Rees: Gespräch', kevinsAngebot({ last_from: 'them', verlauf: [{ sender: 'me', text: TERMIN[0][1], ts: null }, { sender: 'them', text: TERMIN[0][2], ts: null }] }) === 'gespraech')
check('Kevins Angebot an Hallas: Analyse', kevinsAngebot({ last_from: 'them', verlauf: [{ sender: 'me', text: ANALYSE_CTA, ts: null }, { sender: 'them', text: LOOM[0][2], ts: null }] }) === 'analyse')

/* ── Die Listen im Cockpit ────────────────────────────────────────────── */

const NACHRICHT = '2026-10-02T10:22:31.767Z'
const JETZT = new Date('2026-10-06T12:00:00Z')

function thread(kevin: string, lead: string, overrides: Partial<LinkedinThread> = {}): LinkedinThread {
  return {
    id: 'rees',
    brand_id: 'brand-1',
    thread_key: 'urn:li:messagingThread:rees',
    contact_id: null,
    lead_id: 'lead-rees',
    name: 'Manuel Rees',
    company: 'Business Development Reco GmbH World Trade Center Dresden',
    profile_url: 'https://www.linkedin.com/in/manuel-rees-7a78b1107/',
    preview: lead,
    last_message_at: NACHRICHT,
    last_from: 'them',
    unread: false,
    starred: false,
    followup_stage: 1,
    snoozed_until: null,
    status: 'active',
    first_seen_at: '2026-09-28T18:03:58.959Z',
    last_synced_at: '2026-10-06T10:00:00Z',
    loom_status: 'offen',
    loom_erledigt_at: null,
    agent_urteil: 'lead',
    verlauf: [
      { sender: 'me', text: kevin, ts: '2026-10-01T18:34:01.714Z' },
      { sender: 'them', text: lead, ts: NACHRICHT },
    ],
    ...overrides,
  } as LinkedinThread
}

/** Was der Sync aus dem Stern macht: `loom_zugesagt`, gestempelt mit der Nachricht selbst. */
const abgeleitet: LoomUrteile = new Map([['lead-rees', { zugesagt: true, at: new Date(NACHRICHT).getTime() }]])
/** Kevins eigener Klick „Loom ja", eine Stunde nach der Nachricht. */
const kevinsKlick: LoomUrteile = new Map([['lead-rees', { zugesagt: true, at: new Date(NACHRICHT).getTime() + 3_600_000 }]])

const rees = thread(TERMIN[0][1], TERMIN[0][2])
const reesMitStern = thread(TERMIN[0][1], TERMIN[0][2], { starred: true })
const hallas = thread(ANALYSE_CTA, LOOM[0][2], { id: 'hallas', name: 'Uwe Hallas', lead_id: 'lead-rees', starred: true })

check('Rees (Thread): Termin-Wunsch erkannt — Cockpit und Runner', istTerminWunsch(rees) && runnerThread(rees) === true)
{
  const a = antwortPosten([rees], JETZT, [], abgeleitet)
  check('Rees mit dem abgeleiteten loom_zugesagt: steht unter „Antworten"', a.length === 1, a.map((p) => p.id))
  check('  …mit dem Termin-Wunsch vorne im Text', a[0]?.text.startsWith('Will einen Termin: ') === true, a[0]?.text)
  check('  …nicht in der Loom-Spur', loomPosten([rees], abgeleitet).length === 0)
}
{
  const a = antwortPosten([reesMitStern], JETZT, [], abgeleitet)
  check('Rees mit Stern: trotzdem unter „Antworten"', a.length === 1)
  check('  …ohne Stern am Posten (hieße in der Oberfläche „Loom zugesagt")', a[0]?.starred === false)
  check('  …nicht in der Loom-Spur', loomPosten([reesMitStern], abgeleitet).length === 0)
}
check('Kevin klickt danach selbst „Loom ja": dann gilt seine Entscheidung', loomPosten([rees], kevinsKlick).length === 1 && antwortPosten([rees], JETZT, [], kevinsKlick).length === 0)
check('Uwe Hallas mit Stern: bleibt ein Loom', loomPosten([hallas]).length === 1 && antwortPosten([hallas], JETZT).length === 0)
check('Uwe Hallas mit abgeleitetem Ja: bleibt ein Loom', loomPosten([{ ...hallas, starred: false }], abgeleitet).length === 1)

/* ── Lead-Station (Liste „Loom zugesagt") ─────────────────────────────── */

const syncJa = [{ typ: 'loom_zugesagt' as const, at: NACHRICHT }]
const station = (t: LinkedinThread, ereignisse = syncJa) =>
  leadStation({ lead_status: 'aktiv', wiedervorlage_am: null, ereignisse, thread: t }, JETZT).station
check('Lead-Station Rees (abgeleitetes Ja): „Antwort da"', station(rees) === 'antwort_da', station(rees))
check('Lead-Station Rees mit Stern: „Antwort da"', station(reesMitStern) === 'antwort_da', station(reesMitStern))
check(
  'Lead-Station Rees, Kevin klickt danach „Loom ja": Loom offen',
  station(rees, [...syncJa, { typ: 'loom_zugesagt', at: '2026-10-02T11:22:31.767Z' }]) === 'loom_offen',
)
check('Lead-Station Hallas: Loom offen', station(hallas) === 'loom_offen', station(hallas))

/* ── Funnel und Nachtrunde ────────────────────────────────────────────── */

check('Funnel „Loom zugesagt": Rees mit Stern fehlt, Hallas steht drin', funnelWartetAufLoom([reesMitStern, hallas], JETZT).map((p) => p.name).join() === 'Uwe Hallas')
check('Nachtrunde: Rees mit Stern wartet NICHT auf ein Loom (bekommt einen Antwort-Entwurf)', runnerWartetAufLoom(reesMitStern) === false)
check('Nachtrunde: Hallas mit Stern wartet auf das Loom', runnerWartetAufLoom(hallas) === true)

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nAlles grün.')
process.exit(fehler ? 1 : 0)
