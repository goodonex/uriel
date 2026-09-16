/**
 * Wache für die festen Follow-up-Texte (25.08.2026).
 *
 * Diese Texte gehen ungelesen an Leute raus — Kevin kopiert sie aus dem
 * Cockpit und fügt sie in LinkedIn ein. Ein Fehler hier ist deshalb nicht
 * still, sondern peinlich: „Moin [Vorname]," oder „Moin --," in einer echten
 * Nachricht an einen Makler.
 *
 * Start: npx tsx scripts/verify-followup-vorlagen.ts
 */
import {
  ANALYSE_CTA,
  FOLLOWUP_VORLAGEN,
  LOOM_FOLLOWUP_VORLAGEN,
  LOOM_GESICHTET_VORLAGE,
  LOOM_VERSAND_VORLAGE,
  LOOM_ZUSAGE_VORLAGE,
  TERMIN_LINK,
  followupVorlage,
  loomVersandVorlage,
  loomZusageVorlage,
  vornameAus,
} from '../app/src/cockpit/lib/followupVorlagen'
import { FOLLOWUP_THRESHOLDS_DAYS } from '../app/src/cockpit/lib/linkedinFollowups'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/* ── Eine Vorlage je Follow-up-Stufe ───────────────────────────────────── */
check(
  'für jede Follow-up-Stufe gibt es genau einen Text',
  FOLLOWUP_VORLAGEN.length === FOLLOWUP_THRESHOLDS_DAYS.length,
  `${FOLLOWUP_VORLAGEN.length} Texte, ${FOLLOWUP_THRESHOLDS_DAYS.length} Stufen`,
)

/* ── Kevins harte Stimm-Regeln (Skill `herrmann-outreach`) ─────────────── */
{
  const emoji = /\p{Extended_Pictographic}/u
  const verboten: [string, RegExp][] = [
    ['Rückzugsfloskel „lass dich in Ruhe"', /lass ich (dich|Sie)/i],
    ['toter Satz „weißt ja, wo du mich findest"', /wo (du|Sie) mich findest/i],
    ['Rückzug „halte dich nicht weiter auf"', /nicht weiter auf(halten|zuhalten)/i],
    ['Entschuldigung für Verspätung', /sorry|entschuldig|verzeih/i],
    ['Corporate-Weichspüler „gerne würde ich"', /gerne würde ich/i],
    ['Weichspüler „wollte mal nachfragen"', /wollte (mal )?nachfragen/i],
    ['Bittsteller „hätte ich Interesse"', /hätte ich/i],
    // Kevin, 10.09.2026: „Darf ich sie dir schicken — wie so ein Wicht."
    // Um Erlaubnis wird nicht gebeten; siehe ANALYSE_CTA.
    ['Erlaubnis-CTA „darf ich …"', /darf ich/i],
    ['Erlaubnis-CTA „soll ich …"', /soll ich/i],
    ['Erlaubnis-CTA „willst du … sehen"', /willst du .{0,20}sehen/i],
    ['Weichspüler „unverbindlich"', /unverbindlich/i],
  ]

  /**
   * Dieselben Stimm-Regeln gelten für die Loom-Reihe. Sie hier zweimal
   * hinzuschreiben wäre die Art von Duplikat, das beim nächsten Zusatz
   * auseinanderläuft — also einmal als Funktion, zweimal aufgerufen.
   */
  function pruefeReihe(reihe: readonly string[], etikett: string) {
    reihe.forEach((text, stufe) => {
      check(`${etikett} ${stufe}: keine Emojis`, !emoji.test(text), text)
      check(`${etikett} ${stufe}: Anrede „Moin"`, text.startsWith('Moin [Vorname],'), text.slice(0, 30))
      check(`${etikett} ${stufe}: enthält den Platzhalter`, text.includes('[Vorname]'))
      check(`${etikett} ${stufe}: keine Höflichkeitsanrede`, !/\b(Ihnen|Ihre[mnrs]?)\b/.test(text), text)
      check(`${etikett} ${stufe}: duzt erkennbar`, /\b(du|dir|dich|euch|eure[mnrs]?)\b/i.test(text), text)
      for (const [name, muster] of verboten) {
        check(`${etikett} ${stufe}: ${name} kommt nicht vor`, !muster.test(text), text)
      }
      const saetze = text.split(/[.?!]\s/).filter((t) => t.trim()).length
      check(`${etikett} ${stufe}: höchstens vier Sätze`, saetze <= 4, `${saetze} Sätze`)
    })
    check(
      `${etikett}: kein Duplikat`,
      new Set(reihe).size === reihe.length,
    )
  }

  pruefeReihe(LOOM_FOLLOWUP_VORLAGEN, 'Loom-Stufe')

  FOLLOWUP_VORLAGEN.forEach((text, stufe) => {
    check(`Stufe ${stufe}: keine Emojis`, !emoji.test(text), text)
    check(`Stufe ${stufe}: Anrede „Moin"`, text.startsWith('Moin [Vorname],'), text.slice(0, 30))
    check(`Stufe ${stufe}: enthält den Platzhalter`, text.includes('[Vorname]'))
    // Geduzt wird durchgehend. Auf „Sie" allein lässt sich das nicht prüfen —
    // in Stufe 1 verweist es auf die Maklerseite („Sie ist für Käufer gebaut"),
    // nicht auf den Leser. Eindeutig sind nur die Possessiv-/Dativformen der
    // Höflichkeitsanrede, und dass überhaupt eine Du-Form vorkommt.
    check(`Stufe ${stufe}: keine Höflichkeitsanrede`, !/\b(Ihnen|Ihre[mnrs]?)\b/.test(text), text)
    check(`Stufe ${stufe}: duzt erkennbar`, /\b(du|dir|dich|euch|eure[mnrs]?)\b/i.test(text), text)
    for (const [name, muster] of verboten) {
      check(`Stufe ${stufe}: ${name} kommt nicht vor`, !muster.test(text), text)
    }
    // Kurz halten: Kevins Regel ist „wäre sie kürzer besser?". Vier Sätze sind
    // für ein Follow-up die Obergrenze.
    const saetze = text.split(/[.?!]\s/).filter((t) => t.trim()).length
    check(`Stufe ${stufe}: höchstens vier Sätze`, saetze <= 4, `${saetze} Sätze`)
  })

  // Die ersten beiden Stufen wollen eine Reaktion, also endet der Text auf eine
  // Frage (CTA als letzter Satz). Stufe 2 ist selbst nur eine Frage.
  FOLLOWUP_VORLAGEN.forEach((text, stufe) => {
    check(`Stufe ${stufe}: endet auf eine Frage`, text.trimEnd().endsWith('?'), text.slice(-40))
  })

  // Der CTA ist eine Konstante, keine Formulierungsfrage. Variiert er, misst
  // eine Antwortquote den CTA mit und sagt nichts mehr über den Befund davor.
  // Stufe 2 bietet keine Analyse an und hat deshalb ihre eigene Frage.
  for (const stufe of [0, 1]) {
    check(
      `Stufe ${stufe}: endet auf den kanonischen Analyse-CTA`,
      FOLLOWUP_VORLAGEN[stufe].trimEnd().endsWith(ANALYSE_CTA),
      `erwartet: „${ANALYSE_CTA}" — gefunden: „${FOLLOWUP_VORLAGEN[stufe].trimEnd().slice(-60)}"`,
    )
  }
}

/* ── Kein Text ist wie der andere ──────────────────────────────────────── */
{
  const einzig = new Set(FOLLOWUP_VORLAGEN)
  check('drei verschiedene Texte, kein Duplikat', einzig.size === FOLLOWUP_VORLAGEN.length)
}

/* ── Vorname lösen ─────────────────────────────────────────────────────── */
{
  const faelle: [string | null, string | null][] = [
    ['Felix Range', 'Felix'],
    ['Bernd Benno Herrfurth', 'Bernd'],
    ['Timo  Kinzinger', 'Timo'], // doppeltes Leerzeichen steht so im Bestand
    ['  Anna   Meier ', 'Anna'],
    ['Dr. Frank Meierhofer', 'Frank'],
    ['Prof. Dr. Klaus Weber', 'Klaus'],
    ['Sven-Oliver Drasdo', 'Sven-Oliver'],
    ['BizBuilder', 'BizBuilder'], // ein Wort, aber ein gültiger Name
    ['--', null],
    ['', null],
    [null, null],
    ['   ', null],
    ['A', null], // ein Zeichen ist kein Vorname
    ['|', null],
  ]
  for (const [eingabe, erwartet] of faelle) {
    check(`Vorname aus ${JSON.stringify(eingabe)} = ${JSON.stringify(erwartet)}`, vornameAus(eingabe) === erwartet, String(vornameAus(eingabe)))
  }
}

/* ── Der fertige Entwurf ───────────────────────────────────────────────── */
{
  const e = followupVorlage({ name: 'Felix Range', followup_stage: 0 })
  check('Stufe 0 liefert einen Entwurf', Boolean(e))
  check('der Platzhalter ist ersetzt', !e?.text.includes('[Vorname]'), e?.text)
  check('der Vorname steht drin', e?.text.startsWith('Moin Felix,') === true, e?.text.slice(0, 20))
  check('eine Vorlage veraltet nicht', e?.veraltet === false)
  check('eine Vorlage behauptet kein Entstehungsdatum', e?.erstelltAm === null)
}

{
  // Der Fall, der Kevin blamieren würde.
  check('unbrauchbarer Name = kein Entwurf', followupVorlage({ name: '--', followup_stage: 0 }) === undefined)
  check('leerer Name = kein Entwurf', followupVorlage({ name: '', followup_stage: 1 }) === undefined)
}

{
  // Ab Stufe 3 übernimmt die laute Kette (Instagram, PDF, Postkarte, Anruf) —
  // ein LinkedIn-Text wäre dort der falsche Kanal.
  check('Stufe 3 bekommt keine LinkedIn-Vorlage', followupVorlage({ name: 'Felix Range', followup_stage: 3 }) === undefined)
  check('negative Stufe stürzt nicht ab', followupVorlage({ name: 'Felix Range', followup_stage: -1 }) === undefined)
  check(
    'krumme Stufe stürzt nicht ab',
    followupVorlage({ name: 'Felix Range', followup_stage: 1.5 as number }) === undefined,
  )
}

{
  // Jede Stufe liefert ihren eigenen Text — sonst bekäme derselbe Lead
  // dreimal dieselbe Nachricht, und das ist der Vorwurf, den Automation
  // verdient hat.
  const texte = [0, 1, 2].map((stufe) => followupVorlage({ name: 'Felix Range', followup_stage: stufe })?.text)
  check('drei Stufen, drei verschiedene Nachrichten', new Set(texte).size === 3, JSON.stringify(texte))
  check('alle drei sprechen den Lead mit Namen an', texte.every((t) => t?.includes('Felix')))
}

/* ── Die Loom-Reihe: eigene Texte für Leads, die die Analyse schon haben ── */
{
  check(
    'eine Loom-Vorlage je Follow-up-Stufe',
    LOOM_FOLLOWUP_VORLAGEN.length === FOLLOWUP_VORLAGEN.length,
    `${LOOM_FOLLOWUP_VORLAGEN.length} Loom-Texte, ${FOLLOWUP_VORLAGEN.length} kalte Texte`,
  )

  // Der eigentliche Zweck dieser Reihe: Wer die Analyse hat, darf sie nicht
  // noch einmal angeboten bekommen.
  for (const [stufe, text] of LOOM_FOLLOWUP_VORLAGEN.entries()) {
    check(
      `Loom-Stufe ${stufe}: bietet die Analyse nicht erneut an`,
      !text.includes(ANALYSE_CTA),
      text,
    )
  }

  // Keine Überschneidung mit der kalten Reihe — sonst hätte die Verzweigung
  // keinen Effekt und niemand würde es merken.
  const ueberschneidung = LOOM_FOLLOWUP_VORLAGEN.filter((t) => FOLLOWUP_VORLAGEN.includes(t))
  check('Loom-Reihe und kalte Reihe teilen keinen Text', ueberschneidung.length === 0, ueberschneidung.join(' | '))

  // Verzweigung wirkt: derselbe Lead, dieselbe Stufe, anderer Loom-Status.
  for (const stufe of [0, 1, 2]) {
    const kalt = followupVorlage({ name: 'Felix Range', followup_stage: stufe })
    const warm = followupVorlage({ name: 'Felix Range', followup_stage: stufe, loom_status: 'verschickt' })
    check(`Stufe ${stufe}: Loom verschickt ergibt einen anderen Text`, Boolean(kalt && warm) && kalt?.text !== warm?.text)
  }

  // Ohne Loom-Status bleibt alles wie vorher — ältere Aufrufer geben ihn nicht mit.
  check(
    'ohne Loom-Status gilt die kalte Reihe',
    followupVorlage({ name: 'Felix Range', followup_stage: 0 })?.text ===
      followupVorlage({ name: 'Felix Range', followup_stage: 0, loom_status: 'offen' })?.text,
  )
}

/* ── Zusage-Antwort und Loom-Versand ───────────────────────────────────── */
{
  const emoji = /\p{Extended_Pictographic}/u
  const zusage = loomZusageVorlage()

  check('Zusage-Antwort: keine Emojis', !emoji.test(zusage.text), zusage.text)
  check('Zusage-Antwort: fragt nach der E-Mail', /E-Mail/i.test(zusage.text), zusage.text)
  check('Zusage-Antwort: duzt', /\bdeine\b|\bdir\b/i.test(zusage.text), zusage.text)
  // Bewusst ohne Anrede: Das ist eine Antwort im laufenden Chat und spiegelt
  // die Länge der Zusage. „Moin [Vorname]" wäre hier eine Stilbruch-Anrede
  // mitten im Gespräch.
  check('Zusage-Antwort: keine Anrede, kein Platzhalter', !zusage.text.includes('[Vorname]'), zusage.text)
  check('Zusage-Antwort: veraltet nie', zusage.veraltet === false)
  check('Zusage-Antwort: behauptet kein Entstehungsdatum', zusage.erstelltAm === null)
  check('Zusage-Antwort: bleibt kurz', zusage.text.length < 200, `${zusage.text.length} Zeichen`)

  const versand = loomVersandVorlage({ name: 'Felix Range' })
  check('Loom-Versand: liefert einen Text', Boolean(versand))
  check('Loom-Versand: Vorname ist gesetzt', versand?.text.startsWith('Moin Felix,') === true, versand?.text.slice(0, 20))
  check('Loom-Versand: keine Emojis', !emoji.test(versand?.text ?? ''), versand?.text)
  check('Loom-Versand: enthält den Terminlink', versand?.text.includes(TERMIN_LINK) === true, versand?.text)
  // Der Link zum Video entsteht erst beim Hochladen — ein sichtbarer
  // Platzhalter ist besser als ein erfundener Link.
  check('Loom-Versand: Video-Platzhalter bleibt stehen', versand?.text.includes('[Loom-Link]') === true, versand?.text)
  check('Loom-Versand: unbrauchbarer Name = kein Text', loomVersandVorlage({ name: '--' }) === undefined)

  // Der Terminlink zeigt auf das Vorgespräch. Das Konzeptgespräch ist auf der
  // Buchungsseite ausgeblendet und wird live vereinbart — taucht hier also nie auf.
  check('kein Link auf das Konzeptgespräch', !LOOM_VERSAND_VORLAGE.includes('konzeptgespraech'))
  check(
    'Zusage-Vorlage und Versand-Vorlage sind nicht dasselbe',
    LOOM_ZUSAGE_VORLAGE !== LOOM_VERSAND_VORLAGE,
  )
}

/* ── Nachweislich gesehen: eigener Text für die erste Stufe ─────────────── */
{
  const emoji = /\p{Extended_Pictographic}/u
  check('Gesichtet-Vorlage: keine Emojis', !emoji.test(LOOM_GESICHTET_VORLAGE), LOOM_GESICHTET_VORLAGE)
  check('Gesichtet-Vorlage: Anrede „Moin"', LOOM_GESICHTET_VORLAGE.startsWith('Moin [Vorname],'))
  check('Gesichtet-Vorlage: endet auf eine Frage', LOOM_GESICHTET_VORLAGE.trimEnd().endsWith('?'))
  // Der ganze Zweck: Sie darf nicht behaupten, das Video liege ungesehen da.
  check(
    'Gesichtet-Vorlage: behauptet nicht, es läge noch im Chat',
    !/liegt noch/i.test(LOOM_GESICHTET_VORLAGE),
    LOOM_GESICHTET_VORLAGE,
  )
  check(
    'Gesichtet-Vorlage: kein Dank fürs Anschauen',
    !/danke/i.test(LOOM_GESICHTET_VORLAGE),
    LOOM_GESICHTET_VORLAGE,
  )

  const basis = { name: 'Felix Range', loom_status: 'verschickt' as const }
  const ungesehen = followupVorlage({ ...basis, followup_stage: 0 })
  const gesehen = followupVorlage({ ...basis, followup_stage: 0 }, true)
  check('Stufe 0: Sichtung ändert den Text', ungesehen?.text !== gesehen?.text)
  check('Stufe 0 gesehen: der Vorname steht drin', gesehen?.text.startsWith('Moin Felix,') === true, gesehen?.text)

  // Ab Stufe 1 ist die Frage nicht mehr, ob er das Video kennt — dort ist der
  // Text für beide derselbe, und das ist Absicht, kein vergessener Zweig.
  for (const stufe of [1, 2]) {
    check(
      `Stufe ${stufe}: Sichtung ändert den Text NICHT`,
      followupVorlage({ ...basis, followup_stage: stufe })?.text ===
        followupVorlage({ ...basis, followup_stage: stufe }, true)?.text,
    )
  }

  // Ein Sichtungs-Beleg ohne verschicktes Loom ist ein Widerspruch und darf
  // den kalten Text nicht ersetzen.
  check(
    'gesichtet ohne Versand bleibt die kalte Reihe',
    followupVorlage({ name: 'Felix Range', followup_stage: 0, loom_status: 'offen' }, true)?.text ===
      followupVorlage({ name: 'Felix Range', followup_stage: 0 })?.text,
  )
}

console.log(`\nverify-followup-vorlagen: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
