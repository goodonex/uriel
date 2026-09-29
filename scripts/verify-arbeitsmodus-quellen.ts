/**
 * Verifikation für Wargame Zug 3/5 Zulieferer (docs/wargames/sales-arbeitsmodus.md).
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-arbeitsmodus-quellen.ts
 */
import {
  antwortPosten,
  antwortPostenAusgeblendet,
  erstnachrichtPosten,
  followupPosten,
  loomPosten,
  zeilenId,
} from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import type { Erstnachricht } from '../app/src/hooks/useErstnachrichten'
import type { LinkedinThread } from '../app/src/types/db'

const NOW = new Date('2026-07-29T12:00:00Z')
const dayAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

function makeThread(overrides: Partial<LinkedinThread>): LinkedinThread {
  return {
    id: 'thread-1',
    brand_id: 'brand-1',
    thread_key: 'urn:li:messagingThread:test',
    contact_id: null,
    name: 'Test Kontakt',
    company: '',
    profile_url: '',
    preview: '',
    last_message_at: dayAgo(1),
    last_from: 'me',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: dayAgo(30),
    last_synced_at: dayAgo(0),
    loom_status: 'offen',
    loom_erledigt_at: null,
    ...overrides,
  }
}

function makeLead(overrides: Partial<Erstnachricht>): Erstnachricht {
  return {
    id: 'lead-1',
    gruppe: 'Gruppe A',
    name: 'Lead Name',
    firma: '',
    website: '',
    nachricht: 'Hallo …',
    sort_index: 0,
    status: 'offen',
    sent_at: null,
    ...overrides,
  }
}

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

// 1. antwortPosten: nur 'du_bist_dran' (Lead hat geantwortet).
{
  const threads = [
    makeThread({ id: 't1', last_from: 'them', last_message_at: dayAgo(1) }),
    makeThread({ id: 't2', last_from: 'me', last_message_at: dayAgo(1) }), // wartet, kein antwort-posten
  ]
  const posten = antwortPosten(threads, NOW)
  check('1a genau ein antwort-posten', posten.length, 1)
  check('1b id mit thread-praefix', posten[0]?.id, 'thread:t1')
  check('1c spur antwort', posten[0]?.spur, 'antwort')
}

// 1b. Wer ein Loom zugesagt hat, steht in der Loom-Spur — nicht in Antworten
// (18.08.2026: 13 von 29 standen in beiden Listen).
{
  const threads = [
    makeThread({ id: 't1', last_from: 'them', starred: true, loom_status: 'offen' }),
    // Loom ist raus, der Lead schreibt erneut → wartet wieder auf eine Antwort.
    makeThread({ id: 't2', last_from: 'them', starred: true, loom_status: 'verschickt' }),
  ]
  const posten = antwortPosten(threads, NOW)
  check('1b1 offene Loom-Zusage nicht in Antworten', posten.length, 1)
  check('1b2 nach verschicktem Loom wieder drin', posten[0]?.id, 'thread:t2')
  check('1b3 zugesagtes Loom gilt nicht als ausgeblendet', antwortPostenAusgeblendet(threads, NOW).length, 0)
}

// 1c. Post von vor der Makler-Akquise (AKQUISE_START) ist kein Lead.
{
  const threads = [
    makeThread({ id: 'alt', last_from: 'them', last_message_at: '2025-05-06T09:00:00Z' }),
    makeThread({ id: 'neu', last_from: 'them', last_message_at: dayAgo(2) }),
  ]
  const posten = antwortPosten(threads, NOW)
  check('1c1 nur der Thread seit der Akquise', posten.map((p) => p.id), ['thread:neu'])
  check('1c2 der alte bleibt abrufbar', antwortPostenAusgeblendet(threads, NOW).map((p) => p.id), ['thread:alt'])
}


// 1d. Kunden gehören in keine Akquise-Spur (Fall Reichentrog, 18.08.2026).
{
  const threads = [
    makeThread({ id: 'kunde', name: 'Norbert Reichentrog', last_from: 'them', last_message_at: dayAgo(2) }),
    makeThread({ id: 'lead', name: 'Michaela Beer', last_from: 'them', last_message_at: dayAgo(2) }),
    makeThread({ id: 'kunde-fu', name: 'Norbert Reichentrog', last_from: 'me', last_message_at: dayAgo(9) }),
  ]
  const kontakte = [
    { name: 'Norbert Reichentrog', pipeline_stage: 'deal', won_at: null, contact_type: 'person' },
    { name: 'Michaela Beer', pipeline_stage: 'first_contact', won_at: null, contact_type: 'person' },
  ]
  check('1d1 Kunde nicht in Antworten', antwortPosten(threads, NOW, kontakte).map((p) => p.id), ['thread:lead'])
  check('1d2 Kunde bekommt kein Follow-up', followupPosten(threads, NOW, kontakte).length, 0)
  check('1d3 ohne Kontaktliste unveraendert', antwortPosten(threads, NOW).length, 2)
}

// 2. loomPosten: nur starred + loom_status 'offen'.
{
  const threads = [
    makeThread({ id: 't1', starred: true, loom_status: 'offen' }),
    makeThread({ id: 't2', starred: true, loom_status: 'verschickt' }), // schon erledigt
    makeThread({ id: 't3', starred: false, loom_status: 'offen' }), // kein Stern, kein Loom-Posten
  ]
  const posten = loomPosten(threads)
  check('2a genau ein loom-posten', posten.length, 1)
  check('2b id mit loom-praefix', posten[0]?.id, 'loom:t1')
  check('2c starred true', posten[0]?.starred, true)
}

// 3. followupPosten: nur faellige Threads (bucketOf === 'faellig').
{
  const threads = [
    makeThread({ id: 't1', followup_stage: 0, last_message_at: dayAgo(4) }), // faellig (Schwelle 3)
    makeThread({ id: 't2', followup_stage: 0, last_message_at: dayAgo(1) }), // wartet noch
  ]
  const posten = followupPosten(threads, NOW)
  check('3a genau ein followup-posten', posten.length, 1)
  check('3b id mit thread-praefix', posten[0]?.id, 'thread:t1')
}

// 3c. Laufendes Gespräch (29.09.2026, Fall Valerius): keine kalte Vorlage,
// wenn der Lead schon einmal geantwortet hat — die Loom-Reihe bleibt.
{
  const threads = [
    makeThread({ id: 'kalt', name: 'Felix Range', followup_stage: 0, last_message_at: dayAgo(4) }),
    makeThread({ id: 'warm', name: 'Valerius Prill', followup_stage: 0, last_message_at: dayAgo(4) }),
    makeThread({ id: 'loom', name: 'Jan Loom', followup_stage: 0, last_message_at: dayAgo(4), loom_status: 'verschickt' }),
    makeThread({
      id: 'verlauf', name: 'Janis Stomeo', followup_stage: 0, last_message_at: dayAgo(4),
      verlauf: [{ sender: 'them', text: 'passt soweit', ts: dayAgo(5) }] as LinkedinThread['verlauf'],
    }),
  ]
  const posten = followupPosten(threads, NOW, [], new Set(), new Map(), new Set(['warm', 'loom']))
  const text = (id: string) => posten.find((p) => p.id === `thread:${id}`)?.entwurf?.text ?? null
  check('3c1 nie geantwortet → Vorlage', text('kalt')?.includes('untergegangen'), true)
  check('3c2 Antwort in der Lead-Kartei → keine Vorlage', text('warm'), null)
  check('3c3 Antwort im Verlauf → keine Vorlage', text('verlauf'), null)
  check('3c4 Loom verschickt → Loom-Reihe bleibt', text('loom')?.includes('Analyse liegt noch im Chat'), true)
  check('3c5 der Posten selbst bleibt in der Liste', posten.length, 4)
}

// 3d. Nur Sendefertiges (29.09.2026): Kalte Follow-ups auf Erstnachrichten vor
// dem Stichtag bekommen keine Vorlage, und Posten ohne Text bleiben draußen.
{
  const threads = [
    makeThread({ id: 'frisch', name: 'Janine Hardi', followup_stage: 0, last_message_at: dayAgo(4) }),
    makeThread({ id: 'alt', name: 'Marija Schmitt', followup_stage: 0, last_message_at: dayAgo(60) }),
    makeThread({ id: 'alt-agent', name: 'Amadeus Jesinghaus', followup_stage: 0, last_message_at: dayAgo(60), entwurf: 'Moin Amadeus, jetzt hab ich deine Seite doch gefunden.', entwurf_at: NOW.toISOString() }),
    makeThread({ id: 'warm', name: 'Valerius Prill', followup_stage: 0, last_message_at: dayAgo(4) }),
  ]
  const stichtag = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const ids = (o: object) => followupPosten(threads, NOW, [], new Set(), new Map(), new Set(['warm']), o).map((p) => p.id).sort()
  check('3d1 ohne Optionen wie bisher', ids({}), ['thread:alt', 'thread:alt-agent', 'thread:frisch', 'thread:warm'])
  check('3d2 nur sendefertig', ids({ nurMitText: true, neuerTextVor: stichtag }), ['thread:alt-agent', 'thread:frisch'])
  const offline = [
    makeThread({ id: 'offline', name: 'Jan Barendsma', followup_stage: 0, last_message_at: dayAgo(4), last_from: 'me', preview: 'Ist die Seite gerade offline, oder komme nur ich nicht drauf?' }),
    makeThread({ id: 'angebot', name: 'Janine Hardi', followup_stage: 0, last_message_at: dayAgo(4), last_from: 'me', preview: 'Ich hab dir dazu eine kurze Analyse vorbereitet. Hast du was dagegen?' }),
  ]
  check(
    '3d3 Vorlage nur nach Analyse-Angebot',
    followupPosten(offline, NOW, [], new Set(), new Map(), new Set(), { nurMitText: true, nurNachAnalyseAngebot: true }).map((p) => p.id),
    ['thread:angebot'],
  )
}

// 4. erstnachrichtPosten: nur offen, Reihenfolge nach sort_index.
{
  const leads = [
    makeLead({ id: 'l2', name: 'Zwei', sort_index: 2 }),
    makeLead({ id: 'l1', name: 'Eins', sort_index: 1 }),
    makeLead({ id: 'l3', name: 'Drei', sort_index: 3, status: 'gesendet' }), // raus
  ]
  const posten = erstnachrichtPosten(leads)
  check('4a nur offene', posten.length, 2)
  check('4b reihenfolge nach sort_index', posten.map((p) => p.name), ['Eins', 'Zwei'])
}

// 5. zeilenId strippt genau das erste Praefix.
check('5a thread-praefix', zeilenId('thread:abc-123'), 'abc-123')
check('5b loom-praefix', zeilenId('loom:xyz'), 'xyz')
check('5c ohne praefix', zeilenId('ohnepraefix'), 'ohnepraefix')

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
