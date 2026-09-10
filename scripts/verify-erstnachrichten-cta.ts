/**
 * Wache für den einen Erstnachrichten-CTA (10.09.2026).
 *
 * Der Anlass ist Kevins Fund: In 67 offenen Erstnachrichten standen rund 50
 * verschiedene Schlussfragen — „Darf ich sie dir schicken?", „Schick ich sie
 * dir rüber?", „Interesse?". Sein Einwand war doppelt und beides trägt: Um
 * Erlaubnis bittet der Bittsteller, nicht der Anbieter. Und solange der CTA
 * mitvariiert, misst jede Antwortquote ihn mit statt die Beobachtung davor —
 * es gibt schlicht keine Datengrundlage.
 *
 * Geprüft wird deshalb dreierlei: dass der Wortlaut an beiden Orten im Code
 * derselbe ist, dass die Wache die Angebots-Fragen tatsächlich einfängt, und
 * dass sie die Nachrichten in Ruhe lässt, die etwas anderes wollen.
 *
 * Start: npx tsx scripts/verify-erstnachrichten-cta.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ANALYSE_CTA as RUNNER_CTA, CTA_KATALOG, erzwingeAnalyseCta, hatFestenCta, parseErstnachrichtenRoh } from '../runner/linkedin/erstnachrichtenEntwuerfe.mjs'
import { ANALYSE_CTA as APP_CTA } from '../app/src/cockpit/lib/followupVorlagen'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/* ── Ein Wortlaut, überall ─────────────────────────────────────────────── */
check('Runner und App tragen denselben CTA', RUNNER_CTA === APP_CTA, `${RUNNER_CTA} !== ${APP_CTA}`)
check('der CTA bittet nicht um Erlaubnis', !/^(darf|soll|kann) ich/i.test(RUNNER_CTA), RUNNER_CTA)
check('der CTA ist eine Frage', RUNNER_CTA.trimEnd().endsWith('?'), RUNNER_CTA)

// Die Skills schreiben den Satz, der Code erzwingt ihn — laufen sie
// auseinander, produziert der Agent brav den falschen Wortlaut.
for (const skill of [
  join(process.env.HOME!, 'Second Brain/.claude/skills/linkedin-erstnachrichten/SKILL.md'),
  join(process.env.HOME!, '.claude/skills/herrmann-outreach/SKILL.md'),
  join(process.env.HOME!, '.claude/skills/linkedin-leads/SKILL.md'),
]) {
  let text = ''
  try {
    text = readFileSync(skill, 'utf8')
  } catch {
    check(`Skill lesbar: ${skill}`, false, 'nicht gefunden')
    continue
  }
  check(`${skill.split('/').slice(-2)[0]} nennt denselben CTA`, text.includes(RUNNER_CTA))
  // Die Nicht-Analyse-Typen stehen nur im Skill — der Runner warnt dort bloß.
  // Läuft der Katalog auseinander, schreibt der Agent brav einen Satz, den die
  // Wache anschließend als unbekannt meldet.
  if (skill.includes('herrmann-outreach') || skill.includes('linkedin-erstnachrichten')) {
    for (const [typ, satz] of Object.entries(CTA_KATALOG)) {
      check(`${skill.split('/').slice(-2)[0]} kennt den CTA „${typ}"`, text.includes(satz), satz)
    }
    check(`${skill.split('/').slice(-2)[0]} verbietet die Grußformel`, /grußformel|grüße/i.test(text))
  }
}

/* ── Was die Wache einfangen MUSS ──────────────────────────────────────── */
{
  // Echte Schlusssätze aus dem Bestand vom 10.09.2026.
  const angebote = [
    'Darf ich sie dir schicken?',
    'Soll ich sie dir schicken?',
    'Willst du sie sehen?',
    'Magst du sie sehen?',
    'Schick ich sie dir rüber?',
    'Darf ich dir die kurz rüberschicken?',
    'Soll ich sie dir als Video schicken?',
    'Darf ich sie dir zusenden?',
    'Soll ich sie dir hier reinschicken?',
    'Soll ich?',
    'Interesse?',
    'Passt das für dich?',
    'Wäre das interessant für dich?',
  ]
  for (const frage of angebote) {
    const roh = `Moin Jan,\n\nauf eurer Seite steht der Verkäufer nirgends. Ich hab dazu eine kurze Analyse aufgenommen. ${frage}`
    const { text, korrigiert } = erzwingeAnalyseCta(roh)
    check(`ersetzt „${frage}"`, korrigiert && text.endsWith(ANALYSE_CTA_ERWARTET()), text.slice(-70))
  }
}

function ANALYSE_CTA_ERWARTET() {
  return RUNNER_CTA
}

/* ── Was sie in Ruhe lassen MUSS ───────────────────────────────────────── */
{
  // Andere Nachrichtentypen haben ihren eigenen festen CTA. Würde die Wache
  // hier zuschlagen, bekäme jemand mit toter Website eine Analyse zu einer
  // Seite angeboten, die es nicht gibt.
  const fremd = [
    ['Ist eure Seite gerade offline, oder komme nur ich nicht drauf?', 'Ich wollte mir eure Analyse-Grundlage ansehen.'],
    ['Wo finde ich euch?', 'Ich hab nach einer Website gesucht und keine gefunden. Ein Video zur Analyse geht so nicht.'],
    ['Kommen eure Mandate aktuell rein über Kontakte, oder wollt ihr da unabhängiger werden?', 'Dazu hätte ich eine Analyse.'],
    ['Hast du diese Woche kurz Zeit für ein Telefonat?', 'Eine Analyse als Video bringt hier nichts.'],
    ['Baust du gerade neu, oder liegt das Projekt?', 'Für ein Video zur Analyse ist es dann zu früh.'],
  ]
  for (const [frage, vorher] of fremd) {
    const roh = `Moin Jan,\n\n${vorher} ${frage}`
    const { korrigiert } = erzwingeAnalyseCta(roh)
    check(`lässt „${frage.slice(0, 40)}…" stehen`, !korrigiert, roh.slice(-80))
  }

  // Ohne benanntes Angebot hätte „sie" im CTA keinen Bezug.
  const ohne = erzwingeAnalyseCta('Moin Jan,\n\nwie läuft es bei euch gerade? Soll ich mal vorbeischauen?')
  check('ohne Analyse/Video bleibt alles stehen', !ohne.korrigiert, ohne.text.slice(-50))

  // Grußformeln fliegen raus: Auf LinkedIn steht der Absender am Profil.
  const mitGruss = erzwingeAnalyseCta(
    'Moin Jan,\n\nIch hab dir dazu eine kurze Analyse vorbereitet.\n\nDarf ich dir die kurz rüberschicken?\n\nBeste Grüße\nKevin',
  )
  check('findet den CTA auch hinter „Beste Grüße"', mitGruss.korrigiert, mitGruss.text.slice(-90))
  check('die Grußformel ist weg', !/grüße|kevin$/i.test(mitGruss.text), mitGruss.text.slice(-60))
  check('der CTA ist der letzte Satz', mitGruss.text.trimEnd().endsWith(RUNNER_CTA), mitGruss.text.slice(-70))

  // Auch wenn der CTA schon stimmt, muss die Signatur weichen.
  for (const formel of ['Beste Grüße\nKevin', 'Viele Grüße\nKevin', 'LG\nKevin', 'Grüße', 'Herzliche Grüße\nKevin']) {
    const r = erzwingeAnalyseCta(`Moin Jan,\n\nIch hab eine Analyse aufgenommen. ${RUNNER_CTA}\n\n${formel}`)
    check(`entfernt „${formel.split('\n')[0]}"`, r.korrigiert && r.text.trimEnd().endsWith(RUNNER_CTA), r.text.slice(-60))
  }

  // Ein Text, der schon richtig endet, wird nicht angefasst.
  const fertig = erzwingeAnalyseCta(`Moin Jan,\n\nIch hab eine Analyse aufgenommen. ${RUNNER_CTA}`)
  check('richtiger CTA bleibt unverändert', !fertig.korrigiert && fertig.text.endsWith(RUNNER_CTA))
}

/* ── Der Weg durch den Parser ──────────────────────────────────────────── */
{
  const antwort =
    'Bericht: eine geschrieben.\n\n```json\n' +
    JSON.stringify({
      nachrichten: [
        { profil_key: 'jan-b', name: 'Jan Beispiel', firma: 'Beispiel Immobilien', website: 'beispiel.de', nachricht: 'Moin Jan,\n\neure Seite spricht nur Käufer an. Ich hab dazu eine kurze Analyse aufgenommen. Darf ich sie dir schicken?' },
      ],
      uebersprungen: [],
    }) +
    '\n```'
  const { nachrichten } = parseErstnachrichtenRoh(antwort)
  check('der Parser liefert die Nachricht', nachrichten.length === 1)
  check('und sie trägt den festen CTA', nachrichten[0]?.nachricht.trimEnd().endsWith(RUNNER_CTA), nachrichten[0]?.nachricht.slice(-70))
}

/* ── Der Katalog: ein CTA je Nachrichtentyp ────────────────────────────── */
{
  const werte = Object.values(CTA_KATALOG)
  check('jeder Typ hat einen eigenen Satz', new Set(werte).size === werte.length, werte.join(' | '))
  for (const [typ, satz] of Object.entries(CTA_KATALOG)) {
    check(`„${typ}" endet auf ein Fragezeichen`, satz.trimEnd().endsWith('?'), satz)
    check(`„${typ}" bittet nicht um Erlaubnis`, !/^(darf|soll|kann) ich/i.test(satz), satz)
  }
  // `mandate` muss ohne Possessivpronomen auskommen, damit ein Satz für
  // geduzte Einzelmakler und für Firmen gleichermaßen passt.
  check('der Mandate-CTA legt sich nicht auf du/ihr fest', !/\b(deine|eure|Ihre)\b/i.test(CTA_KATALOG.mandate), CTA_KATALOG.mandate)

  check('hatFestenCta erkennt jeden Katalog-Satz', werte.every((c) => hatFestenCta(`Moin Jan,\n\nIrgendein Befund. ${c}`)))
  check('hatFestenCta lehnt einen freien Schlusssatz ab', !hatFestenCta('Moin Jan,\n\nMelde dich gerne mal.'))
}

console.log(`\nverify-erstnachrichten-cta: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
