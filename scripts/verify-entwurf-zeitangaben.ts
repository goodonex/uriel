/**
 * Verifikation: Zeitangaben in Entwürfen stimmen im Moment des Sendens
 * (06.10.2026, Marco Stadelmann / Sven Sommerfeld).
 *
 * - Platzhalter [[Mittwoch, 7.10.2026, nachmittags]] → „morgen Nachmittag", ab JETZT gerechnet
 * - alte Entwürfe mit „morgen" → gegen den Entstehungstag aufgelöst, neu ausgedrückt
 * - vergangene Zeitangabe → Warnung statt still angeboten
 * - „von heute Nacht" nur, wenn es stimmt
 * - Drift-Wache: Was der Runner als Platzhalter schreibt, liest das Cockpit
 *
 * Start: npx tsx scripts/verify-entwurf-zeitangaben.ts
 */
// @ts-expect-error — .mjs ohne Typen; genau die Datei, die der Runner lädt.
import { anrufFensterAus, ANRUF_FENSTER_STANDARD, ergaenzeAnrufVorschlaege, zeitKontext } from '../runner/linkedin/zeitangaben.mjs'
import {
  berlinZeit,
  entwurfStand,
  entwurfZeitAnzeige,
  parseSlot,
  slotToken,
  slotVerschieben,
  tagAusDatum,
  versandText,
  ZEIT_WARNUNG,
  type Slot,
} from '../app/src/cockpit/lib/entwurfZeitangaben'
import { antwortPosten } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import type { LinkedinThread } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}\n  erwartet ${JSON.stringify(expected)}\n  bekommen ${JSON.stringify(actual)}`)
  }
}

/** Berliner Ortszeit im Oktober 2026 (Sommerzeit, UTC+2). */
const berlin = (tag: number, hh: number, mm = 0) =>
  new Date(Date.UTC(2026, 9, tag, hh - 2, mm)).toISOString()
const at = (tag: number, hh: number, mm = 0) => new Date(berlin(tag, hh, mm))

// 5.10. Montag, 6.10. Dienstag, 7.10. Mittwoch, 8.10. Donnerstag, 9.10. Freitag, 12.10. Montag
check('0 Kalender: 6.10.2026 ist Dienstag', new Date(Date.UTC(2026, 9, 6)).getUTCDay(), 2)

// ---- 1. Marco Stadelmann: Montag 20:10 geschrieben, Dienstag 12:40 gelesen ----
{
  const roh =
    'Morgen um 10 Uhr oder Mittwoch um 14 Uhr, was passt dir besser? Schick mir deine Nummer, dann ruf ich dich an.'
  const r = entwurfZeitAnzeige(roh, berlin(5, 20, 10), at(6, 12, 40))
  check(
    '1 Stadelmann: morgen→heute, Mittwoch→morgen',
    r.text,
    'Heute um 10 Uhr oder morgen um 14 Uhr, was passt dir besser? Schick mir deine Nummer, dann ruf ich dich an.',
  )
  check('1b Stadelmann: 10 Uhr ist vorbei → Warnung', r.zeitVeraltet, true)
  check('1c Label: nicht „von heute Nacht"', entwurfStand(berlin(5, 20, 10), at(6, 12, 40)), 'von gestern Abend')
  check('1d Warnungstext', ZEIT_WARNUNG, 'Zeitangabe veraltet — Termin anpassen')
}

// ---- 2. Sven Sommerfeld: Montag 14:40 geschrieben ----
{
  const roh = 'Hallo Sven, passt dir morgen um 10 Uhr?'
  const mittag = entwurfZeitAnzeige(roh, berlin(5, 14, 40), at(6, 12, 40))
  check('2 Sven mittags: „heute um 10 Uhr"', mittag.text, 'Hallo Sven, passt dir heute um 10 Uhr?')
  check('2b Sven mittags: vorbei', mittag.zeitVeraltet, true)
  const frueh = entwurfZeitAnzeige(roh, berlin(5, 14, 40), at(6, 8, 0))
  check('2c Sven um 8 Uhr: noch gültig', [frueh.text, frueh.zeitVeraltet], ['Hallo Sven, passt dir heute um 10 Uhr?', false])
  const amAbend = entwurfZeitAnzeige(roh, berlin(5, 14, 40), at(5, 18, 0))
  check('2d Sven am selben Abend: bleibt „morgen"', [amAbend.text, amAbend.zeitVeraltet], [roh, false])
}

// ---- 3. Neue Form: Wochentag + Datum ----
{
  const roh = 'Passt dir Mittwoch, 7.10., um 10 Uhr?'
  check('3 Di: „morgen um 10 Uhr"', entwurfZeitAnzeige(roh, berlin(6, 3), at(6, 12, 40)).text, 'Passt dir morgen um 10 Uhr?')
  check('3b Mi 9 Uhr: „heute um 10 Uhr"', entwurfZeitAnzeige(roh, berlin(6, 3), at(7, 9)).text, 'Passt dir heute um 10 Uhr?')
  const spaet = entwurfZeitAnzeige(roh, berlin(6, 3), at(7, 11))
  check('3c Mi 11 Uhr: vorbei', spaet.zeitVeraltet, true)
  const danach = entwurfZeitAnzeige(roh, berlin(6, 3), at(8, 9))
  check('3d Do: Datum bleibt stehen, Warnung', [danach.text, danach.zeitVeraltet], [roh, true])
  check(
    '3e mit „am": „am Mittwoch, 7.10." am Sonntag → „am Mittwoch"',
    entwurfZeitAnzeige('Wie wäre es am Mittwoch, 7.10., um 10 Uhr?', berlin(4, 3), at(4, 9)).text,
    'Wie wäre es am Mittwoch um 10 Uhr?',
  )
  check(
    '3f weit weg: Datum bleibt',
    entwurfZeitAnzeige('Passt dir Mittwoch, 21.10., um 10 Uhr?', berlin(6, 3), at(6, 9)).text,
    'Passt dir Mittwoch, 21.10., um 10 Uhr?',
  )
}

// ---- 4. Wochengrenze Freitag → Montag ----
{
  const roh = 'Passt dir Montag um 10 Uhr?'
  check('4 Fr geschrieben, Mo 8 Uhr gelesen: „heute"', entwurfZeitAnzeige(roh, berlin(9, 18), at(12, 8)).text, 'Passt dir heute um 10 Uhr?')
  check('4b Fr geschrieben, Sa gelesen: „übermorgen"', entwurfZeitAnzeige(roh, berlin(9, 18), at(10, 9)).text, 'Passt dir übermorgen um 10 Uhr?')
  const alt = entwurfZeitAnzeige('Passt dir morgen um 10 Uhr?', berlin(9, 18), at(12, 8))
  check('4c „morgen" vom Fr, am Mo gelesen: Samstag + Warnung', [alt.text, alt.zeitVeraltet], ['Passt dir Samstag, 10.10. um 10 Uhr?', true])
}

// ---- 5. „übermorgen" ----
{
  const r = entwurfZeitAnzeige('Übermorgen um 11 Uhr hätte ich Zeit.', berlin(5, 20), at(6, 12))
  check('5 übermorgen (Mo) am Di → „Morgen"', [r.text, r.zeitVeraltet], ['Morgen um 11 Uhr hätte ich Zeit.', false])
  const r2 = entwurfZeitAnzeige('Übermorgen um 11 Uhr hätte ich Zeit.', berlin(5, 20), at(5, 21))
  check('5b am selben Abend unverändert', r2.text, 'Übermorgen um 11 Uhr hätte ich Zeit.')
}

// ---- 6. „Mittwoch" am Mittwoch ----
{
  const roh = 'Mittwoch um 14 Uhr?'
  check('6 Mo geschrieben, Mi 9 Uhr: „Heute"', entwurfZeitAnzeige(roh, berlin(5, 20), at(7, 9)).text, 'Heute um 14 Uhr?')
  check('6b Mi 15 Uhr: vorbei', entwurfZeitAnzeige(roh, berlin(5, 20), at(7, 15)).zeitVeraltet, true)
  check(
    '6c am Mittwoch selbst geschrieben → nächste Woche',
    entwurfZeitAnzeige(roh, berlin(7, 8), at(7, 9)).text,
    'Mittwoch, 14.10. um 14 Uhr?',
  )
}

// ---- 7. Uhrzeit heute vorbei ----
{
  const roh = 'Ich ruf dich heute um 9 Uhr an.'
  check('7 heute 9 Uhr, um 8:30 gelesen', entwurfZeitAnzeige(roh, berlin(6, 7), at(6, 8, 30)).zeitVeraltet, false)
  check('7b heute 9 Uhr, um 9:30 gelesen', entwurfZeitAnzeige(roh, berlin(6, 7), at(6, 9, 30)).zeitVeraltet, true)
  check('7c „ab 15 Uhr" um 16 Uhr noch offen', entwurfZeitAnzeige('Heute ab 15 Uhr geht.', berlin(6, 7), at(6, 16)).zeitVeraltet, false)
}

// ---- 8. Kein Termin, nicht anfassen ----
{
  const roh = 'Guten Morgen Marco, heute entscheiden Eigentümer online. Am 1.10. hast du geschrieben, dass es klemmt.'
  const r = entwurfZeitAnzeige(roh, berlin(5, 20), at(6, 12))
  check('8 „Guten Morgen", „heute" ohne Uhrzeit, altes Datum bleiben', [r.text, r.zeitVeraltet], [roh, false])
  check('8b ohne Entstehungszeit bleibt „morgen" stehen', entwurfZeitAnzeige('Passt morgen um 10?', null, at(6, 12)).text, 'Passt morgen um 10?')
}

// ---- 9. Terminvorschläge als Platzhalter ----
const ANGEBOT =
  'Hast du was dagegen, wenn wir zehn Minuten telefonieren? Mir würde zum Beispiel [[Mittwoch, 7.10.2026, nachmittags]] oder [[Donnerstag, 8.10.2026, ganztägig]] ganz gut passen.'
{
  const di = entwurfZeitAnzeige(ANGEBOT, berlin(6, 3), at(6, 12, 40))
  check(
    '9 Kevins Satz: „morgen Nachmittag oder übermorgen"',
    di.text,
    'Hast du was dagegen, wenn wir zehn Minuten telefonieren? Mir würde zum Beispiel morgen Nachmittag oder übermorgen ganz gut passen.',
  )
  check('9b zwei Vorschläge erkannt', di.slots.length, 2)
  check('9c nichts vorbei', di.zeitVeraltet, false)
  const mi = entwurfZeitAnzeige(ANGEBOT, berlin(6, 3), at(7, 9))
  check('9d am Mittwoch gelesen: „heute Nachmittag oder morgen"', mi.text.endsWith('heute Nachmittag oder morgen ganz gut passen.'), true)
  const do_ = entwurfZeitAnzeige(ANGEBOT, berlin(6, 3), at(8, 10))
  check('9e am Donnerstag: Mittwoch vorbei → Warnung', [do_.slots[0].vorbei, do_.slots[1].vorbei, do_.zeitVeraltet], [true, false, true])
  check('9f vergangener Vorschlag mit Datum', do_.text.includes('Mittwoch, 7.10. nachmittags oder heute'), true)
  const satz = entwurfZeitAnzeige('[[Mittwoch, 7.10.2026, um 10 Uhr]] passt mir.', berlin(6, 3), at(6, 9))
  check('9g Satzanfang groß', satz.text, 'Morgen um 10 Uhr passt mir.')
  check('9h unlesbarer Platzhalter bleibt als Text', entwurfZeitAnzeige('Gern [[irgendwann]].', null, at(6, 9)).text, 'Gern irgendwann.')
  check(
    '9i Freitag: Montag/Dienstag',
    entwurfZeitAnzeige('[[Montag, 12.10.2026, nachmittags]] oder [[Dienstag, 13.10.2026, ganztägig]]', berlin(9, 3), at(9, 9)).text,
    'Montag Nachmittag oder Dienstag',
  )
}

// ---- 10. Kevin verschiebt einen Vorschlag — Anzeige und Kopieren gleich ----
{
  const jetzt = at(6, 12, 40)
  const basis = entwurfZeitAnzeige(ANGEBOT, berlin(6, 3), jetzt)
  const erster = basis.slots[0].slot as Slot
  const spaeter = slotVerschieben(erster, 1, jetzt)
  check('10 +1 Werktag: Do', spaeter.tag, tagAusDatum(2026, 10, 8))
  const um10: Slot = { ...spaeter, fenster: { art: 'um', stunde: 10, minute: 0 } }
  const geaendert = entwurfZeitAnzeige(ANGEBOT, berlin(6, 3), jetzt, [um10])
  check('10b Satz rechnet neu', geaendert.text.endsWith('übermorgen um 10 Uhr oder übermorgen ganz gut passen.'), true)
  const entwurf = { text: basis.text, roh: ANGEBOT, erstelltAm: berlin(6, 3) }
  check('10c Kopieren = Anzeige', versandText(entwurf, [um10], jetzt), geaendert.text)
  check('10d ohne Platzhalter: Text wie er ist', versandText({ text: 'Moin', erstelltAm: null }), 'Moin')
  const fr = slotVerschieben({ tag: tagAusDatum(2026, 10, 9), fenster: { art: 'ganztaegig' } }, 1, jetzt)
  check('10e Freitag +1 Werktag → Montag', fr.tag, tagAusDatum(2026, 10, 12))
  const nieZurueck = slotVerschieben({ tag: tagAusDatum(2026, 10, 6), fenster: { art: 'ganztaegig' } }, -1, jetzt)
  check('10f nie vor heute', nieZurueck.tag, tagAusDatum(2026, 10, 6))
}

// ---- 11. Runner: Datum, Vorschläge, Drift-Wache ----
{
  const k = zeitKontext(at(6, 12, 40))
  check('11 heute', k.heute, 'Dienstag, 6.10.2026, 12:40 Uhr (Europe/Berlin)')
  check('11b Standard-Vorschläge', k.anruf_vorschlaege, ['[[Mittwoch, 7.10.2026, nachmittags]]', '[[Donnerstag, 8.10.2026, ganztägig]]'])
  const fr = zeitKontext(at(9, 22))
  check('11c Freitag → Montag/Dienstag', fr.anruf_vorschlaege, ['[[Montag, 12.10.2026, nachmittags]]', '[[Dienstag, 13.10.2026, ganztägig]]'])
  // Kurz nach Mitternacht UTC ist in Berlin schon der nächste Tag.
  check('11d Berliner Datum, nicht UTC', zeitKontext(new Date('2026-10-06T22:30:00Z')).heute.startsWith('Mittwoch, 7.10.2026'), true)
  check('11e Einstellung: eigene Fenster', zeitKontext(at(6, 9), [{ werktage: 0, fenster: 'ab 15 Uhr' }, { werktage: 1, fenster: 'ganztägig' }]).anruf_vorschlaege, [
    '[[Dienstag, 6.10.2026, ab 15 Uhr]]',
    '[[Mittwoch, 7.10.2026, ganztägig]]',
  ])
  check('11f kaputte Einstellung → Standard', anrufFensterAus([{ werktage: 1, fenster: 'irgendwann' }]), ANRUF_FENSTER_STANDARD)
  check('11g keine Einstellung → Standard', anrufFensterAus(undefined), ANRUF_FENSTER_STANDARD)
  // Drift-Wache: Jeder Platzhalter des Runners ist im Cockpit lesbar und identisch formatiert.
  const heute = berlinZeit(at(6, 12)).tag
  for (const fenster of ['vormittags', 'nachmittags', 'ganztägig', 'um 14 Uhr', 'ab 15 Uhr', 'um 9:30 Uhr']) {
    const [token] = zeitKontext(at(6, 12), [{ werktage: 1, fenster }, { werktage: 2, fenster }]).anruf_vorschlaege
    const slot = parseSlot(token.slice(2, -2), heute)
    check(`11h Drift ${fenster}`, slot ? slotToken(slot) : null, token)
  }
}

// ---- 12. Sicherung hinter dem Agenten: Telefonat ohne Zeitvorschlag ----
{
  const v = ['[[Mittwoch, 7.10.2026, nachmittags]]', '[[Donnerstag, 8.10.2026, ganztägig]]']
  check(
    '12 Telefonat ohne Zeit → zwei Vorschläge',
    ergaenzeAnrufVorschlaege('Moin Jens, 14 Tage ist ehrlich.\n\nHast du was dagegen, wenn wir zehn Minuten telefonieren?', v),
    'Moin Jens, 14 Tage ist ehrlich.\n\nHast du was dagegen, wenn wir zehn Minuten telefonieren? Mir würde zum Beispiel [[Mittwoch, 7.10.2026, nachmittags]] oder [[Donnerstag, 8.10.2026, ganztägig]] ganz gut passen.',
  )
  check('12b schon zwei Platzhalter → unverändert', ergaenzeAnrufVorschlaege(ANGEBOT, v), ANGEBOT)
  const eigene = 'Gern austauschen, passt dir Freitag, 9.10., um 10 Uhr? Dann ruf ich dich an.'
  check('12c eigene Zeit genannt → unverändert', ergaenzeAnrufVorschlaege(eigene, v), eigene)
  check('12d kein Telefonat → unverändert', ergaenzeAnrufVorschlaege('Hast du was dagegen, wenn ich sie dir einmal rüberschicke?', v), 'Hast du was dagegen, wenn ich sie dir einmal rüberschicke?')
}

// ---- 13. Label „von …" ----
{
  check('13 gerade eben', entwurfStand(berlin(6, 12, 10), at(6, 12, 40)), 'gerade eben')
  check('13b vor 10 h', entwurfStand(berlin(5, 20, 10), at(6, 7)), 'vor 10 h')
  check('13c Nacht, nachmittags gelesen', entwurfStand(berlin(6, 3), at(6, 16)), 'von heute Nacht')
  check('13d gestern Mittag', entwurfStand(berlin(5, 12), at(6, 13)), 'von gestern Mittag')
  check('13e vor 2 Tagen', entwurfStand(berlin(4, 20), at(6, 12)), 'vor 2 Tagen')
}

// ---- 14. Am Posten: Kopieren nimmt den umgerechneten Text ----
{
  const thread = {
    id: 't1',
    brand_id: 'b1',
    thread_key: 'k1',
    contact_id: null,
    name: 'Marco Stadelmann',
    company: 'Stadelmann Immobilien',
    profile_url: 'https://www.linkedin.com/in/marco',
    preview: 'Ja wann hast du Zeit?',
    last_message_at: berlin(5, 20, 2),
    last_from: 'them',
    unread: false,
    starred: false,
    followup_stage: 0,
    snoozed_until: null,
    status: 'active',
    first_seen_at: berlin(1, 9),
    last_synced_at: berlin(6, 12),
    loom_status: 'offen',
    loom_erledigt_at: null,
    entwurf: 'Morgen um 10 Uhr oder Mittwoch um 14 Uhr, was passt dir besser? Schick mir deine Nummer, dann ruf ich dich an.',
    entwurf_at: berlin(5, 20, 10),
  } as unknown as LinkedinThread
  const [p] = antwortPosten([thread], at(6, 12, 40))
  check('14 Posten trägt den Text für jetzt', p?.entwurf?.text.startsWith('Heute um 10 Uhr oder morgen um 14 Uhr'), true)
  check('14b Posten markiert die veraltete Zeit', p?.entwurf?.zeitVeraltet, true)
  check('14c Rohtext bleibt erhalten', p?.entwurf?.roh?.startsWith('Morgen um 10 Uhr'), true)
}

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
