/**
 * Verifikation für Etappe 3, Schritt 2 (docs/IDEEN-2026-07-30-nutzbarkeit.md):
 * Auswahl und Eingabe des Antwort-Entwürfe-Agenten.
 *
 * Kern des Skripts ist die Drift-Wache: `istDuBistDran` (Runner, .mjs) muss über
 * eine Fall-Matrix hinweg exakt dasselbe sagen wie `bucketOf(...) === 'du_bist_dran'`
 * (Cockpit, .ts). Der Runner braucht die Regel nachts ohne Cockpit — dass es
 * zwei Fassungen gibt, ist nur tragbar, solange dieses Skript sie zusammenhält.
 *
 * Start: npx tsx scripts/verify-antwort-entwuerfe.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { ANTWORT_MAX, NACHFASSEN_MAX, baueAntwortInput, hatFrischenEntwurf, istDuBistDran, istNachfassFall, istNeuPruefFall, nurPlatzhalter } from '../runner/linkedin/antwortThreads.mjs'
import { bucketOf } from '../app/src/cockpit/lib/linkedinFollowups'
import type { LinkedinThread, LinkedinThreadStatus, LinkedinLastFrom } from '../app/src/types/db'

const NOW = new Date('2026-08-03T09:00:00Z')
const tageHer = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
const inTagen = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

let seq = 0
function thread(over: Partial<LinkedinThread> = {}): LinkedinThread {
  seq += 1
  return {
    id: `t${seq}`,
    brand_id: 'b1',
    thread_key: `key-${seq}`,
    contact_id: null,
    name: `Lead ${seq}`,
    company: 'Makler GmbH',
    profile_url: 'https://www.linkedin.com/in/lead',
    preview: 'Klingt spannend, schick mal rüber',
    last_message_at: tageHer(2),
    last_from: 'them',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: tageHer(30),
    last_synced_at: NOW.toISOString(),
    loom_status: 'offen',
    loom_erledigt_at: null,
    ...over,
  }
}

// ---- 1. Drift-Wache: Runner-Regel == bucketOf über die volle Matrix ----
{
  const stati: LinkedinThreadStatus[] = ['active', 'waiting_reply', 'won', 'lost', 'archived']
  const absender: LinkedinLastFrom[] = ['me', 'them', 'unknown']
  const schlummer = [null, inTagen(1), tageHer(1)]
  const stufen = [0, 1, 2, 3, 4]
  const zeiten = [null, tageHer(0), tageHer(2), tageHer(40)]

  let faelle = 0
  let abweichungen = 0
  for (const status of stati) {
    for (const last_from of absender) {
      for (const snoozed_until of schlummer) {
        for (const followup_stage of stufen) {
          for (const last_message_at of zeiten) {
            const t = thread({ status, last_from, snoozed_until, followup_stage, last_message_at })
            const cockpit = bucketOf(t, NOW) === 'du_bist_dran'
            const runner = istDuBistDran(t, NOW)
            faelle++
            if (cockpit !== runner) {
              abweichungen++
              if (abweichungen <= 3) {
                console.error(
                  `  Drift: status=${status} last_from=${last_from} snooze=${snoozed_until} stage=${followup_stage} ts=${last_message_at} → Cockpit ${cockpit}, Runner ${runner}`,
                )
              }
            }
          }
        }
      }
    }
  }
  check(`1 Drift-Wache über ${faelle} Fälle`, abweichungen, 0)
}

// ---- 2. Die Regel selbst, an den Fällen, die im Alltag zählen ----
{
  check('2 Lead hat geschrieben', istDuBistDran(thread(), NOW), true)
  check('2b Kevin war zuletzt dran', istDuBistDran(thread({ last_from: 'me' }), NOW), false)
  check('2c unklarer Absender', istDuBistDran(thread({ last_from: 'unknown' }), NOW), false)
  check('2d archiviert', istDuBistDran(thread({ status: 'archived' }), NOW), false)
  check('2e gewonnen', istDuBistDran(thread({ status: 'won' }), NOW), false)
  check('2f schlummert noch', istDuBistDran(thread({ snoozed_until: inTagen(2) }), NOW), false)
  check('2g Schlummer abgelaufen', istDuBistDran(thread({ snoozed_until: tageHer(1) }), NOW), true)
  // Der teuerste Fehler im Funnel: Antwort nach drei Follow-ups zählt trotzdem.
  check('2h Antwort nach Stufe 3', istDuBistDran(thread({ followup_stage: 3 }), NOW), true)
  check('2i waiting_reply ist kein Endzustand', istDuBistDran(thread({ status: 'waiting_reply' }), NOW), true)
}

// ---- 3. Eingabe für den Agenten ----
{
  const { input, weitereWarten } = baueAntwortInput(
    [
      thread({ name: 'Neu', last_message_at: tageHer(1) }),
      thread({ name: 'Alt', last_message_at: tageHer(9) }),
      thread({ name: 'Raus', last_from: 'me' }),
    ],
    NOW,
  )
  check('3 nur wartende Threads', input.threads.length, 2)
  check('3b ältester zuerst', input.threads[0].name, 'Alt')
  check('3c Wartetage berechnet', input.threads[0].tage_seit_antwort, 9)
  check('3d nichts über dem Limit', weitereWarten, 0)
}

// 3e. Rangfolge = `dringlichkeit` aus prioritaet.ts: Stern sticht das Alter.
// Sonst entwirft der Agent für andere Threads, als die Arbeitsliste oben zeigt.
{
  const { input } = baueAntwortInput(
    [
      thread({ name: 'Ganz alt', last_message_at: tageHer(40) }),
      thread({ name: 'Stern', last_message_at: tageHer(1), starred: true }),
      thread({ name: 'Mittel', last_message_at: tageHer(10) }),
    ],
    NOW,
  )
  check(
    '3e Stern vor Alter',
    input.threads.map((t: { name: string }) => t.name),
    ['Stern', 'Ganz alt', 'Mittel'],
  )
}

// 4. thread_key ist der Anker für den Entwurf am Posten — er muss immer mit.
{
  const { input } = baueAntwortInput([thread({ thread_key: 'urn:li:conv:(A,7)' })], NOW)
  check('4 thread_key im Input', input.threads[0].thread_key, 'urn:li:conv:(A,7)')
  check('4b contact_id bleibt null', input.threads[0].contact_id, null)
}

// 5. Verlauf wird durchgereicht; fehlt die Spalte 0064, steht dort ein leeres Array.
{
  const mit = baueAntwortInput(
    [thread({ verlauf: [{ sender: 'them', text: 'Moin', ts: null }] })],
    NOW,
  )
  check('5 Verlauf durchgereicht', mit.input.threads[0].verlauf.length, 1)
  const ohne = baueAntwortInput([thread({ verlauf: undefined })], NOW)
  check('5b fehlende Spalte → leeres Array', ohne.input.threads[0].verlauf, [])
}

// 6. Deckel: ein Lauf bleibt überschaubar, der Rest wird gemeldet statt verschwiegen.
{
  const viele = Array.from({ length: ANTWORT_MAX + 5 }, (_, i) =>
    thread({ last_message_at: tageHer(i + 1) }),
  )
  const { input, weitereWarten } = baueAntwortInput(viele, NOW)
  check('6 Deckel greift', input.threads.length, ANTWORT_MAX)
  check('6b Rest wird gemeldet', weitereWarten, 5)
}

// 7. Regelstand (28.09.2026): Ein Entwurf, der vor der aktuellen Stimm-Fassung
// entstand, ist veraltet — auch wenn der Lead danach nichts geschrieben hat.
{
  const regel = new Date('2026-09-24T12:00:00Z').getTime()
  const t = { entwurf: 'x', entwurf_at: '2026-08-25T10:00:00Z', last_message_at: '2026-08-24T10:00:00Z' }
  check('7 Entwurf vor Regelstand → neu schreiben', hatFrischenEntwurf(t, regel), false)
  check('7b Entwurf nach Regelstand → bleibt', hatFrischenEntwurf({ ...t, entwurf_at: '2026-09-25T10:00:00Z' }, regel), true)
}

// 8. Nachfassen im laufenden Gespräch (29.09.2026, Fall Valerius): Kevin hat
// zuletzt geschrieben, der Lead hatte vorher geantwortet → der Agent schreibt,
// nicht die kalte Vorlage.
{
  const antworten = new Map([['L-val', { text: 'Die Seite wird im Hintergrund gerade überarbeitet.', ts: tageHer(190) }]])
  const warm = thread({ lead_id: 'L-val', last_from: 'me', last_message_at: tageHer(183), preview: 'Super Timing dann!' } as Partial<LinkedinThread>)
  const kalt = thread({ lead_id: 'L-kalt', last_from: 'me', last_message_at: tageHer(10) } as Partial<LinkedinThread>)
  const imVerlauf = thread({
    last_from: 'me',
    last_message_at: tageHer(5),
    verlauf: [{ sender: 'them', text: 'Passt soweit', ts: tageHer(6) }, { sender: 'me', text: 'Ist das bei dir anders?', ts: tageHer(5) }],
  } as Partial<LinkedinThread>)
  check('8a Antwort in der Lead-Kartei → Nachfassfall', istNachfassFall(warm, NOW, antworten), true)
  check('8b nie geantwortet → Vorlage bleibt zuständig', istNachfassFall(kalt, NOW, antworten), false)
  check('8c Antwort im Verlauf reicht auch', istNachfassFall(imVerlauf, NOW), true)
  check('8d zu frisch (unter 3 Tagen) → noch nicht', istNachfassFall({ ...warm, last_message_at: tageHer(1) }, NOW, antworten), false)
  check('8e Loom verschickt → Loom-Reihe', istNachfassFall({ ...warm, loom_status: 'verschickt' }, NOW, antworten), false)
  check('8f Ja gesagt, Loom offen → das Loom ist die Antwort', istNachfassFall({ ...warm, starred: true }, NOW, antworten), false)
  check('8g ab Stufe 3 übernimmt die laute Kette', istNachfassFall({ ...warm, followup_stage: 3 }, NOW, antworten), false)
  check('8h Lead hat zuletzt geschrieben → Antwort, kein Nachfassen', istNachfassFall({ ...warm, last_from: 'them' }, NOW, antworten), false)

  const wartet = thread({ last_message_at: tageHer(1) })
  const { input } = baueAntwortInput([wartet], NOW, undefined, { threads: [kalt, warm, imVerlauf], antwortenJeLead: antworten })
  // Der kalte Thread liegt vor dem Recherche-Stichtag → kommt als neu_pruefen mit (Test 9).
  check('8i Antworten zuerst, dann Nachfassen', input.threads.map((t: { art: string }) => t.art), ['antwort', 'nachfassen', 'neu_pruefen', 'nachfassen'])
  const val = input.threads.find((t: { thread_key: string }) => t.thread_key === warm.thread_key) as { letzte_antwort_lead: { text: string } | null; tage_seit_kevin: number }
  check('8j letzte Antwort aus der Lead-Kartei geht mit', val?.letzte_antwort_lead?.text, 'Die Seite wird im Hintergrund gerade überarbeitet.')
  check('8k Tage seit Kevins Nachricht', val?.tage_seit_kevin, 183)
  const viele = Array.from({ length: NACHFASSEN_MAX + 2 }, (_, i) => thread({ lead_id: 'L-val', last_from: 'me', last_message_at: tageHer(10 + i) } as Partial<LinkedinThread>))
  const gedeckelt = baueAntwortInput([], NOW, undefined, { threads: viele, antwortenJeLead: antworten })
  check('8l eigener Deckel fürs Nachfassen', gedeckelt.input.threads.length, NACHFASSEN_MAX)
  check('8m Rest wird gemeldet', gedeckelt.weitereNachfassen, 2)

  // Reihenfolge wie im Cockpit: Klasse vor Alter — sonst bekommen Neujahrsgrüße
  // vom Januar Texte und der B-Lead oben in Kevins Liste nicht.
  const alt = thread({ lead_id: 'L-alt', last_from: 'me', last_message_at: tageHer(260) } as Partial<LinkedinThread>)
  const b = thread({ lead_id: 'L-b', last_from: 'me', last_message_at: tageHer(183) } as Partial<LinkedinThread>)
  const a = thread({ lead_id: 'L-a', last_from: 'me', last_message_at: tageHer(20) } as Partial<LinkedinThread>)
  const alleMitAntwort = new Map(['L-alt', 'L-b', 'L-a'].map((id) => [id, { text: 'x', ts: tageHer(300) }]))
  const klassen = new Map([['L-b', { klasse: 'B', punkte: 40 }], ['L-a', { klasse: 'A', punkte: 70 }]])
  const sortiert = baueAntwortInput([], NOW, undefined, { threads: [alt, b, a], antwortenJeLead: alleMitAntwort, klassen })
  // 9. Kalte Follow-ups auf alte Erstnachrichten (29.09.2026): neu prüfen statt Vorlage.
  const altKalt = thread({ lead_id: 'L-x', last_from: 'me', last_message_at: '2026-07-14T10:00:00Z' } as Partial<LinkedinThread>)
  const frischKalt = thread({ lead_id: 'L-y', last_from: 'me', last_message_at: '2026-09-18T10:00:00Z', preview: 'Ich hab dir dazu eine kurze Analyse vorbereitet. Hast du was dagegen, wenn ich sie dir einmal rüberschicke?' } as Partial<LinkedinThread>)
  const spaeter = new Date('2026-09-29T12:00:00Z')
  check('9a alte Erstnachricht, nie geantwortet → neu prüfen', istNeuPruefFall(altKalt, spaeter), true)
  check('9b Erstnachricht nach dem Stichtag → Vorlage bleibt', istNeuPruefFall(frischKalt, spaeter), false)
  check('9c hat geantwortet → Nachfassen, nicht neu prüfen', istNeuPruefFall(altKalt, spaeter, new Map([['L-x', { text: 'x', ts: null }]])), false)
  const gemischt = baueAntwortInput([], spaeter, undefined, { threads: [altKalt, frischKalt], antwortenJeLead: new Map() })
  const offline = thread({ last_from: 'me', last_message_at: '2026-09-17T10:00:00Z', preview: 'Ist die Seite gerade offline, oder komme nur ich nicht drauf?', verlauf: [] } as Partial<LinkedinThread>)
  check('9e frisch, aber ohne Analyse-Angebot → neu prüfen', istNeuPruefFall(offline, spaeter), true)
  check('9d nur der alte kommt mit, als neu_pruefen', gemischt.input.threads.map((t: { art: string }) => t.art), ['neu_pruefen'])

  // 10. Unabgeschriebene Sprachnachricht: kein Agent-Lauf, Kevin hört selbst.
  check('10a Platzhalter allein', nurPlatzhalter({ preview: '[Sprachnachricht]' }), true)
  check('10b Datei mit Namen', nurPlatzhalter({ preview: '[Datei: Expose.pdf]' }), true)
  check('10c abgeschrieben', nurPlatzhalter({ preview: '[Sprachnachricht] Ja, läuft super.' }), false)
  check('10d normaler Text', nurPlatzhalter({ preview: 'Klingt spannend' }), false)

  check('8n A vor B vor ungeprüft', sortiert.input.threads.map((t: { thread_key: string }) => t.thread_key), [a.thread_key, b.thread_key, alt.thread_key])
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
