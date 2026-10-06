/**
 * Drift-Wache für „Anfragen an dich" (06.10.2026, Migration 0098).
 *
 * Kevin: *„Ich will noch einen Reiter für wenn einer meiner Zielgruppe mich
 * anfragt."* Geprüft wird die ganze Kette ohne Browser und ohne Datenbank:
 * das Lesen der Eingangsliste, die Zielgruppe, die Wachen am Text, die
 * Doppel-Sperre gegen die kalte Erstnachricht und was die Zeile in der
 * Tagesliste sagt — vor allem, dass ein Ladefehler nie „0 von 0 ✓" heißt.
 *
 * Die Karten-Fixtures haben die Form, die am 06.10. auf Kevins echter
 * Eingangsseite stand (drei Karten, eine Vernetzungsanfrage, zwei
 * Einladungen zu Firmenseiten); die Namen sind ersetzt.
 *
 * Start: npx tsx scripts/verify-anfragen-an-dich.ts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — .mjs ohne Typen, dieselbe Fassung wie im Runner
import { anfrageKarteZuEintrag, anfragenGesamtAus, anfragenVollstaendig } from '../runner/linkedin/netzwerkParse.mjs'
import {
  anfrageZielgruppe,
  baueAnfragenPrompt,
  fuerSchreiber,
  glaetteAnfrageText,
  parseAnfrageAntwort,
  // @ts-expect-error — .mjs ohne Typen
} from '../runner/linkedin/anfragen.mjs'
// @ts-expect-error — .mjs ohne Typen
import { ETAPPEN, ETAPPEN_LIMIT_MIN } from '../runner/runde.mjs'
import { anfragenZeilenText, teileAnfragen, type Anfrage } from '../app/src/cockpit/lib/anfragenAnDich'
import { angenommenOhneErstnachricht, type NetzwerkEintrag } from '../app/src/cockpit/lib/funnelStufen'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p: string) => readFileSync(join(wurzel, p), 'utf8')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

const JETZT = new Date('2026-10-06T10:00:00+02:00')

// --- 1. Die Eingangsliste lesen ----------------------------------------
console.log('1) Eingangsliste')
{
  const anfrage = anfrageKarteZuEintrag(
    {
      href: '/in/dana-beispiel-39b80417a/',
      nameAusBild: 'Dana Beispiels Profilbild',
      zeilen: [
        'Dana Beispiel möchte Kontakt mit Ihnen aufnehmen',
        'Immobilienmaklerin | Inhaberin Beispiel Immobilien Kiel',
        'Max Muster und 71 weitere gemeinsame Kontakte',
        'Ignorieren',
        'Annehmen',
      ],
    },
    JETZT,
  )
  check('der Name ohne „möchte Kontakt mit Ihnen aufnehmen"', anfrage?.name === 'Dana Beispiel', JSON.stringify(anfrage))
  check('die Headline steht an zweiter Stelle', anfrage?.headline === 'Immobilienmaklerin | Inhaberin Beispiel Immobilien Kiel')
  check('gemeinsame Kontakte sind keine Notiz', anfrage?.notiz === '' && /71 weitere/.test(anfrage?.gemeinsame ?? ''))
  check('Profil-Schlüssel und Link', anfrage?.profilKey === 'dana-beispiel-39b80417a' && anfrage?.profileUrl === 'https://www.linkedin.com/in/dana-beispiel-39b80417a/')
  check('ohne Zeitangabe kein erfundenes Datum', anfrage?.eingegangenAt === null)

  const mitNotiz = anfrageKarteZuEintrag(
    {
      href: '/in/jan-probe/',
      nameAusBild: '',
      zeilen: [
        'Jan Probe möchte Kontakt mit Ihnen aufnehmen',
        'Geschäftsführer | Probe & Partner Immobilien',
        'Mehr Eigentümer wären schön, habe deinen Post zur Bewertungsseite gelesen. …mehr',
        'Vor 2 Tagen',
        'Ignorieren',
        'Annehmen',
      ],
    },
    JETZT,
  )
  check('die Notiz wird gelesen', mitNotiz?.notiz === 'Mehr Eigentümer wären schön, habe deinen Post zur Bewertungsseite gelesen.', JSON.stringify(mitNotiz?.notiz))
  check('eine Notiz, die mit „Mehr" anfängt, überlebt', /^Mehr Eigentümer/.test(mitNotiz?.notiz ?? ''))
  check('eine Zeitangabe wird gelesen, wenn sie dasteht', mitNotiz?.eingegangenAt?.slice(0, 10) === '2026-10-04', mitNotiz?.eingegangenAt ?? 'null')

  const folgen1 = anfrageKarteZuEintrag(
    { href: '/in/gbaroneg/', nameAusBild: 'Unternehmenslogo von Beispiel AG', zeilen: ['Gino Muster', 'hat Sie eingeladen, Beispiel AG zu folgen', 'Ignorieren', 'Annehmen'] },
    JETZT,
  )
  const folgen2 = anfrageKarteZuEintrag(
    { href: '/in/massimo-test-28b77b46/', nameAusBild: '', zeilen: ['Massimo Test hat Sie eingeladen, Studio Test - Retail & Real Estate Consulting zu folgen', 'Ignorieren', 'Annehmen'] },
    JETZT,
  )
  const vorschlag = anfrageKarteZuEintrag(
    { href: '/in/paul-vorschlag/', nameAusBild: '', zeilen: ['Paul Vorschlag', 'Immobilienmakler', 'Vernetzen'] },
    JETZT,
  )
  check('ein Vorschlag ohne „Annehmen" ist keine Anfrage', vorschlag === null, JSON.stringify(vorschlag))
  check('Einladung, einer Seite zu folgen, ist keine Anfrage (eigene Zeile)', folgen1?.folgen === true)
  check('… und auch nicht im selben Satz wie der Name', folgen2?.folgen === true)

  check('„Alle (3)" ist die Gesamtzahl', anfragenGesamtAus('Einladungen verwalten\nEingegangen\nGesendet\nAlle (3)\nGemeinsame Kontakte (1)') === 3)
  check('leere Liste heißt 0, nicht unbekannt', anfragenGesamtAus('Keine ausstehenden Einladungen') === 0)
  check('ohne Kopfzeile bleibt es unbekannt', anfragenGesamtAus('irgendwas') === null)
  check('drei Karten von drei sind vollständig (Folge-Einladungen zählen mit)', anfragenVollstaendig(3, 3) === true)
  check('eine Karte von drei ist es nicht', anfragenVollstaendig(1, 3) === false)
  check('null von null ist vollständig', anfragenVollstaendig(0, 0) === true)
  check('unbekannte Gesamtzahl ist nie vollständig', anfragenVollstaendig(3, null) === false)

  const netz = lies('runner/linkedin/netzwerk.mjs')
  check('der Leser kennt die Eingangsseite', /invitation-manager\/received/.test(netz))
  check('der Leser klickt nie (kein .click im Netzwerk-Leser)', !/\.click\(/.test(netz))
  check('die Eingangsliste darf leer sein, ohne als Ladefehler zu gelten', /darfLeerSein: true/.test(netz))
}

// --- 2. Zielgruppe -----------------------------------------------------
console.log('2) Zielgruppe')
{
  const makler = anfrageZielgruppe('Immobilienmakler | Inhaber Muster Immobilien', 'Max Muster')
  check('ein Makler bekommt einen Text', makler.ausgeblendet === null && makler.urteil !== 'off', JSON.stringify(makler))
  const coach = anfrageZielgruppe('Business Coach für Immobilienmakler', 'Clara Coach')
  check('ein Makler-Coach wird ausgeblendet, mit Grund', coach.urteil === 'off' && /Zielgruppe/.test(coach.ausgeblendet ?? ''), JSON.stringify(coach))
  const unklar = anfrageZielgruppe('', 'Ohne Headline')
  check('ohne Headline bekommt der Schreiber eine Chance', unklar.ausgeblendet === null)
}

// --- 3. Die Wachen am Text ---------------------------------------------
console.log('3) Der Text')
{
  const roh = '```\nMoin Jana,\n\ndanke für die Anfrage — freut mich 🙂\n\nWas hat dich zu mir geführt? – kurz gefragt\n\nBeste Grüße\nKevin\n```'
  const t = glaetteAnfrageText(roh)
  check('keine Gedankenstriche', !/[—–]/.test(t), t)
  check('keine Emojis', !/\p{Extended_Pictographic}/u.test(t), t)
  check('keine Grußformel', !/Grüße|Kevin$/.test(t), t)
  check('keine Code-Zäune', !t.includes('```'), t)
  check('der Strich wird zum Komma', t.includes('danke für die Anfrage, freut mich'), t)
  check('Bindestriche in Wörtern bleiben', glaetteAnfrageText('Moin Max, eure Eigentümer-Seite ist stark.') === 'Moin Max, eure Eigentümer-Seite ist stark.')
  check('freistehender Bindestrich wird zum Komma', glaetteAnfrageText('Moin Max - kurze Frage.') === 'Moin Max, kurze Frage.')

  const antwort =
    'Hier die Texte.\n```json\n' +
    JSON.stringify({
      entwuerfe: [
        { profil_key: 'dana-beispiel', nachricht: 'Moin Dana,\n\ndanke für die Anfrage — schön.\n\nWas hat dich zu mir geführt?' },
        { profil_key: 'erfunden', nachricht: 'Moin Niemand, das ist ein erfundener Kontakt hier.' },
        { profil_key: 'kurz', nachricht: 'Hi' },
      ],
      ausgeblendet: [{ profil_key: 'clara-coach', grund: 'Will Kevin Coaching verkaufen' }],
    }) +
    '\n```'
  const p = parseAnfrageAntwort(antwort, ['dana-beispiel', 'clara-coach', 'kurz'])
  check('Texte zu bekannten Personen kommen an', p?.entwuerfe.length === 1 && p.entwuerfe[0].profil_key === 'dana-beispiel', JSON.stringify(p))
  check('die Wachen laufen auch hier', !/—/.test(p?.entwuerfe[0]?.nachricht ?? '—'))
  check('erfundene Personen fliegen raus', !p?.entwuerfe.some((e: { profil_key: string }) => e.profil_key === 'erfunden'))
  check('ein Zweizeiler ist kein Text', !p?.entwuerfe.some((e: { profil_key: string }) => e.profil_key === 'kurz'))
  check('ausgeblendet mit Grund', p?.ausgeblendet[0]?.grund === 'Will Kevin Coaching verkaufen')
  check('ohne json-Block kein Ergebnis', parseAnfrageAntwort('nur Prosa', ['a']) === null)

  const stimme = lies('runner/regeln/stimme/herrmann-outreach.md')
  check('die Stimme kennt den neuen Typ', stimme.includes('**Eingehende Anfrage aus der Zielgruppe**'))
  const abschnitt = stimme.slice(stimme.indexOf('**Eingehende Anfrage aus der Zielgruppe**'), stimme.indexOf('**Terminbestätigung nach Telefonat:**'))
  const beispiele = [...abschnitt.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1])
  check('der Abschnitt hat zwei Beispiele', beispiele.length === 2)
  check('die Beispiele haben keine Striche', beispiele.every((b) => !/[—–]/.test(b)), beispiele.join('\n---\n'))
  check('die Beispiele verkaufen nichts', beispiele.every((b) => !/Analyse|rüberschicke|telefonieren|Loom/.test(b)))

  const person = fuerSchreiber({ profil_key: 'x', name: 'Jan Probe', headline: 'GF', notiz: 'Hallo Kevin', gemeinsame: '', recherche: { firma: 'Probe GmbH', website: 'https://probe.de/', sicher: true, profil: { geheim: 1 } } })
  check('der Schreiber sieht kein Lead-Profil (Rohdaten)', !('profil' in (person.recherche ?? {})))
  const prompt = baueAnfragenPrompt([person], stimme)
  check('der Prompt trägt Kevins Stimme und die Notiz', prompt.includes('Eingehende Anfrage aus der Zielgruppe') && prompt.includes('Hallo Kevin'))
  check('der Prompt verbietet den Pitch', /Kein Pitch/.test(prompt))
}

// --- 4. Doppel-Sperre gegen die kalte Erstnachricht ---------------------
console.log('4) Keine zweite Erstnachricht')
{
  const basis = { headline: 'Immobilienmakler', profile_url: '', eingeladen_at: null, zuletzt_gesehen_at: '2026-10-05T00:00:00Z' }
  const netzwerk: NetzwerkEintrag[] = [
    { ...basis, id: '1', profil_key: 'dana-beispiel', name: 'Dana Beispiel', status: 'angenommen', angenommen_at: '2026-10-05T08:00:00Z', richtung: 'eingehend' },
    { ...basis, id: '2', profil_key: 'max-muster', name: 'Max Muster', status: 'angenommen', angenommen_at: '2026-10-05T08:00:00Z', richtung: 'ausgehend' },
    { ...basis, id: '3', profil_key: 'ohne-feld', name: 'Olaf Ohnefeld', status: 'angenommen', angenommen_at: '2026-10-05T08:00:00Z' },
  ]
  const wartend = angenommenOhneErstnachricht(netzwerk, [], [], JETZT).map((p) => p.name)
  check('wer Kevin angefragt hat, wartet nicht auf eine Erstnachricht', !wartend.includes('Dana Beispiel'), wartend.join(', '))
  check('wen Kevin angefragt hat, schon', wartend.includes('Max Muster'))
  check('ohne Migration (kein Feld) bleibt alles wie bisher', wartend.includes('Olaf Ohnefeld'))

  const input = lies('scripts/erstnachrichten-input.ts')
  check('der Erstnachrichten-Vorrat liest die Richtung mit', /angenommen_at,richtung&order=profil_key/.test(input))
  check('… und läuft ohne Migration trotzdem weiter', /angenommen_at,richtung&order=profil_key`,\n\s*\)\.catch\(/.test(input))

  const mig = lies('supabase/migrations/0098_linkedin_anfragen_eingehend.sql')
  check('Migration legt die Tabelle an', /create table if not exists linkedin_anfragen/.test(mig))
  check('Migration setzt die Richtung bei neuer Anfrage', /after insert on linkedin_anfragen/.test(mig))
  check('… und bei neuer Netzwerk-Zeile (Annahme Tage später)', /before insert on linkedin_netzwerk/.test(mig))
  check('Migration hat Zeilenschutz', /enable row level security/.test(mig) && /linkedin_anfragen_via_brand/.test(mig))
}

// --- 5. Die Zeile in der Tagesliste -----------------------------------
console.log('5) Die Zeile')
{
  const zeile = (o: Partial<Anfrage>): Anfrage => ({
    id: o.profil_key ?? 'x',
    profil_key: 'x',
    name: 'X',
    headline: 'Immobilienmakler',
    profile_url: '',
    notiz: '',
    gemeinsame: '',
    eingegangen_at: '2026-10-06T07:00:00Z',
    nicht_mehr_da_at: null,
    icp_urteil: 'kern',
    icp_grund: 'makler',
    ausgeblendet_grund: null,
    firma: '',
    website: '',
    entwurf: 'Moin X, danke für die Anfrage. Was hat dich zu mir geführt?',
    entwurf_at: '2026-10-06T07:30:00Z',
    entwurf_versuche: 1,
    status: 'offen',
    status_at: null,
    ...o,
  })
  const zeilen: Anfrage[] = [
    zeile({ profil_key: 'a', name: 'Anna Offen' }),
    zeile({ profil_key: 'b', name: 'Bert Ohnetext', entwurf: null }),
    zeile({ profil_key: 'c', name: 'Carl Coach', icp_urteil: 'off', ausgeblendet_grund: 'Nicht deine Zielgruppe' }),
    zeile({ profil_key: 'd', name: 'Dora Gesendet', status: 'gesendet', status_at: '2026-10-06T08:00:00+02:00' }),
    zeile({ profil_key: 'e', name: 'Emil Gestern', status: 'verworfen', status_at: '2026-10-05T08:00:00+02:00' }),
    zeile({ profil_key: 'f', name: 'Fritz Ignoriert', nicht_mehr_da_at: '2026-10-06T06:00:00Z' }),
    zeile({ profil_key: 'g', name: 'Gina Angenommen', nicht_mehr_da_at: '2026-10-06T06:00:00Z' }),
    zeile({ profil_key: 'h', name: 'Hans Imgespraech' }),
  ]
  const a = teileAnfragen(zeilen, {
    threads: [{ name: 'Hans Imgespraech' }],
    netzwerk: [{ profil_key: 'g', status: 'angenommen' }],
    jetzt: JETZT,
  })
  const namen = a.offen.map((x) => x.name)
  check('offen: wartet mit und ohne Text', namen.includes('Anna Offen') && namen.includes('Bert Ohnetext'), namen.join(', '))
  check('nicht Zielgruppe steht eingeklappt', a.ausgeblendet.map((x) => x.name).join() === 'Carl Coach')
  check('ignoriert auf LinkedIn verschwindet von selbst', !namen.includes('Fritz Ignoriert'))
  check('schon angenommen, Text nicht raus: bleibt, mit Hinweis', a.offen.find((x) => x.name === 'Gina Angenommen')?.angenommen === true)
  check('mit Gespräch: nicht doppelt (läuft in Antworten)', !namen.includes('Hans Imgespraech'))
  check('heute erledigt zählt, gestern nicht', a.heuteErledigt === 1, String(a.heuteErledigt))

  const t = anfragenZeilenText({ laedt: false, tabelleFehlt: false, fehler: null, aufteilung: a })
  check('die Zeile zählt „erledigt von gesamt"', t.kennzahl === '1 von 4', t.kennzahl)
  check('mit Wartenden ist die Zeile dran', t.zustand === 'aktiv')
  check('die Unterzeile sagt, dass ein Text fehlt', /1 ohne Text/.test(t.unterzeile), t.unterzeile)

  const fehler = anfragenZeilenText({ laedt: false, tabelleFehlt: false, fehler: 'JWT expired', aufteilung: null })
  check('Ladefehler ist NIE „0 von 0"', !/0 von 0/.test(fehler.kennzahl) && fehler.kennzahl === 'nicht geladen', fehler.kennzahl)
  check('Ladefehler bekommt nie den Haken', fehler.zustand !== 'erledigt')
  check('Ladefehler ist gold markiert', fehler.warnung === true)
  const ohneTabelle = anfragenZeilenText({ laedt: false, tabelleFehlt: true, fehler: null, aufteilung: null })
  check('fehlende Migration ist kein Haken', ohneTabelle.zustand !== 'erledigt' && /0098/.test(ohneTabelle.kennzahl))
  const laedt = anfragenZeilenText({ laedt: true, tabelleFehlt: false, fehler: null, aufteilung: null })
  check('beim Laden steht „…", kein Haken', laedt.kennzahl === '…' && laedt.zustand !== 'erledigt')
  const leer = anfragenZeilenText({ laedt: false, tabelleFehlt: false, fehler: null, aufteilung: { offen: [], ausgeblendet: [], heuteErledigt: 0 } })
  check('wirklich niemand: „Keine offen" statt „0 von 0"', leer.kennzahl === 'Keine offen' && leer.zustand === 'erledigt', leer.kennzahl)

  const dash = lies('app/src/cockpit/pages/SalesDashboard.tsx')
  check('die Zeile steht in der Tagesliste', /id: 'anfragen-an-dich'/.test(dash) && /\[anfragenZeile, pruefZeile, \.\.\.flowZeilen\]/.test(dash))
  check('die Kennzahl kommt aus anfragenZeilenText (eine Stelle für den Fehlerfall)', /anfragenZeilenText\(/.test(dash))
}

// --- 6. Der Runner-Lauf ------------------------------------------------
console.log('6) Runner')
{
  const idx = (s: string) => ETAPPEN.findIndex((e: { schluessel: string }) => e.schluessel === s)
  check('Etappe „Anfragen an dich" existiert und braucht Chrome', ETAPPEN[idx('anfragen')]?.brauchtChrome === true)
  check('… nach den Kontakten, vor den Erstnachrichten', idx('kontakte') < idx('anfragen') && idx('anfragen') < idx('erstnachrichten'))
  check('… mit eigener Zeitgrenze', Number(ETAPPEN_LIMIT_MIN.anfragen) > 0)
  const kern = lies('runner/index.mjs')
  check('die Etappe ist verdrahtet', /anfragen: async \(\{ melde, signal \}\) => tueAnfragen\(/.test(kern))
  check('die Tages-Runden lesen die Anfragen mit', /RUNDE_TAG_ETAPPEN = \[[^\]]*'anfragen'/.test(kern))
  check('gelesen wird unter dem Netzwerk-Lock', /mitNetzwerkLock\(async \(\) => \{\n\s*const gelesen = await leseListe\('anfragen'/.test(kern))
  check('ein Lesefehler wird als Fehler gemeldet, nicht als „0 neu"', /if \(lesefehler\) throw new Error/.test(kern))
  const anfr = lies('runner/linkedin/anfragen.mjs')
  check('der Anfragen-Schritt klickt nie auf LinkedIn', !/\.click\(|Annehmen'|invitation.*accept/i.test(anfr))
  check('dieselbe Recherche wie die Erstnachrichten (rechercheLeads)', /rechercheLeads/.test(kern.slice(kern.indexOf('async function tueAnfragen'))))
}

console.log(`\nverify-anfragen-an-dich: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
