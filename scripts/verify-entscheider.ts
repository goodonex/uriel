/**
 * Drift-Wache für die tiefere Lead-Recherche und „Entscheider zuerst"
 * (22.09.2026).
 *
 * Anlass: Kevins Feedback zu den Erstnachrichten — Struktur gut, Recherche zu
 * flach. Vier Dinge müssen dauerhaft stimmen, und alle vier hängen an
 * Regeln ohne Modell, die beim nächsten Umbau leise brechen können:
 *   1. Alle aktuellen Stationen aus der LinkedIn-Erfahrung (Philipp Hilgeland:
 *      Makler bei MAUS + drei eigene Firmen), nicht nur die oberste.
 *   2. GF-Namen aus dem Impressum und die Rolle daraus — nie geraten.
 *   3. Website-Stufe und Werbebibliothek ohne falsches „nein".
 *   4. Wer zurückgestellt wird und wer trotzdem geschrieben wird.
 *
 * Start: npx tsx scripts/verify-entscheider.ts
 */
import { parseStationen } from '../runner/linkedin/erfahrung.mjs'
import { gfNamenAusImpressum, metaAdsAuswerten, firmaKern, metaAdsUrl } from '../runner/linkedin/seiteRendern.mjs'
import { rolleAusImpressum, rolleFuerSkill, websiteStufe } from '../runner/linkedin/leadRecherche.mjs'
import { entscheiderUrteil, namensSchluessel, grundFuer, istKonzern } from '../runner/linkedin/entscheider.mjs'
import { ALTE_GF_FRAGE, CTA_KATALOG, ohneAlteGfFrage, ohneAnalyseFuerAngestellte, parseErstnachrichtenRoh } from '../runner/linkedin/erstnachrichtenEntwuerfe.mjs'
import { heuteAnfragen, linkedinZiel, type EntscheiderKandidat } from '../app/src/cockpit/lib/entscheider'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis: unknown = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${typeof hinweis === 'string' ? hinweis : JSON.stringify(hinweis)}` : ''}`)
  }
}

/* ── 1. Stationen ──────────────────────────────────────────────────────── */
// So liest der iframe die Seite: jede Zeile doppelt (sichtbar + Screenreader, dort „bis Heute").
const hilgeland = `Erfahrung
Erfahrung
Makler
Makler
MAUS Immobilien · Vollzeit
MAUS Immobilien · Vollzeit
Jan. 2021 – Heute · 4 J. 9 Mon.
Jan. 2021 bis Heute · 4 Jahre 9 Monate
Sylt, Schleswig-Holstein, Deutschland

Inhaber
CheckOut GmbH · Selbstständig
Mai 2019 – Heute · 6 J. 5 Mon.
Inhaber
Stulle & Meer Sylt · Selbstständig
2020 – Heute · 5 J.
Flippi's Hüs Sylt
Selbstständig · 3 J. 2 Mon.
Gastgeber
Aug. 2022 – Heute · 3 J. 2 Mon.
Werkstudent
Sparkasse · Teilzeit
Okt. 2015 – Sept. 2018 · 3 J.
Weitere Profile ansehen
Max Muster · Makler`
const st = parseStationen(hilgeland)
check('Hilgeland: vier aktuelle Stationen', st.length === 4, st)
check('Hilgeland: MAUS angestellt', st[0]?.firma === 'MAUS Immobilien' && st[0]?.rolle === 'Makler' && st[0]?.selbststaendig === false, st[0])
check('Hilgeland: CheckOut selbstständig', st.some((s) => s.firma === 'CheckOut GmbH' && s.selbststaendig), st)
check('Hilgeland: Stulle & Meer', st.some((s) => s.firma === 'Stulle & Meer Sylt' && s.seit === '2020'), st)
check("Hilgeland: Flippi's Hüs aus der Gruppe", st.some((s) => s.firma === "Flippi's Hüs Sylt" && s.selbststaendig), st)
check('beendete Station fehlt', !st.some((s) => s.firma === 'Sparkasse'), st)
check('Empfehlungen am Seitenende sind keine Station', !st.some((s) => /max muster/i.test(s.firma)), st)

const gruppe = parseStationen(`Engel & Völkers
Vollzeit · 8 J. 1 Mon.
Hamburg
Teamleiter Vertrieb
Jan. 2022 – Heute · 3 J. 9 Mon.
Führt das Team.
Immobilienberater
Vollzeit
Sept. 2017 – Dez. 2021 · 4 J. 4 Mon.
Geschäftsführer
Müller Immobilien GmbH
März 2023 – Heute · 2 J. 7 Mon.`)
check('Gruppe: Rolle aus der Gruppe, Firma aus dem Kopf', gruppe[0]?.firma === 'Engel & Völkers' && gruppe[0]?.rolle === 'Teamleiter Vertrieb', gruppe)
check('nach einer Gruppe: Einzelstation ohne Anstellungsart', gruppe.some((s) => s.firma === 'Müller Immobilien GmbH' && s.selbststaendig), gruppe)
check('englische Oberfläche', parseStationen('Founder\nAcme Realty · Self-employed\nJan 2020 - Present · 5 yrs')[0]?.selbststaendig === true)
check('leerer Text → keine Station', parseStationen('').length === 0)

/* ── 2. Impressum ──────────────────────────────────────────────────────── */
const faelle: [string, string, string[]][] = [
  ['GmbH mit zwei GF', 'Angaben gemäß § 5 TMG\nMAUS Immobilien GmbH\nMusterweg 3\n25980 Sylt\nVertreten durch den Geschäftsführer:\nDr. Klaus Maus, Anna-Lena Maus\nRegistergericht: Amtsgericht Flensburg', ['Klaus Maus', 'Anna-Lena Maus']],
  ['Einzelunternehmen ohne Amtsbezeichnung', 'Impressum\nAngaben gemäß § 5 DDG\nPhilipp Hilgeland\nCheckOut\nStrandweg 1', ['Philipp Hilgeland']],
  ['„und" und Adelsprädikat', 'Geschäftsführung: Max Mustermann und Erika von Musterfrau (Vors.)\nHandelsregister HRB 123', ['Max Mustermann', 'Erika von Musterfrau']],
  ['Komplementär-GmbH', 'vertreten durch die XY Verwaltungs GmbH, diese vertreten durch ihren Geschäftsführer Jens Peter Hansen\nSitz der Gesellschaft: Hamburg', ['Jens Peter Hansen']],
  ['Inhaber, dann Telefon', 'Inhaber: Tobias Jauck\nTelefon: 0171 123', ['Tobias Jauck']],
  ['„Mustermann" ist kein USt-Stopp', 'Geschäftsführer: Christian Mustermann\nUSt-IdNr.: DE123', ['Christian Mustermann']],
  ['Einzelfirma: Name unter dem Firmenkopf', 'IMPRESSUM\n\nWOHNSCHMIEDE HAMBURG IMMOBILIEN\n\nKaren Dierks\n\nKuhmühle 16\n\n22087 Hamburg', ['Karen Dierks']],
  ['Betreiber-Block', 'BETREIBER\nM.J. Real Estate Consulting GmbH\nMaurice Jnglin\nNeuhausweg 6', ['Maurice Jnglin']],
  ['Firma ohne Personen', 'Angaben gemäß § 5 TMG\nMAUS Immobilien GmbH\nStr. 1\nE-Mail: info@maus.de', []],
]
for (const [label, text, soll] of faelle) {
  const ist = gfNamenAusImpressum(text)
  check(`Impressum: ${label}`, JSON.stringify(ist) === JSON.stringify(soll), `${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

check('Rolle: Nachname im Impressum → gf', rolleAusImpressum('Klaus Maus', ['Klaus Maus']) === 'gf')
check('Rolle: mit Titel und Zusatz → gf', rolleAusImpressum('Dr. Philipp Hilgeland, MBA', ['Philipp Hilgeland']) === 'gf')
check('Rolle: nicht im Impressum → angestellt', rolleAusImpressum('Charlotte Rostek', ['Jan Paegel']) === 'angestellt')
check('Rolle: voller Name im Firmenkopf → gf', rolleAusImpressum('Natascha Borkowski', [], 'Impressum\nNBI-Natascha Borkowski Immobilien\nAnschrift:') === 'gf')
check('Rolle: nur Nachname im Kopf reicht nicht', rolleAusImpressum('Tim Borkowski', [], 'Impressum\nNBI-Natascha Borkowski Immobilien') === 'unklar')
check('Rolle: Tippfehler im Impressum (Jnglin/Jünglin) → gf', rolleAusImpressum('Maurice Jünglin', ['Maurice Jnglin']) === 'gf')
check('Rolle: ähnlicher, aber anderer Mensch → angestellt', rolleAusImpressum('Maria Schulz', ['Jan Paegel']) === 'angestellt')
check('Rolle: kein Impressum → unklar', rolleAusImpressum('Charlotte Rostek', []) === 'unklar')
check('Rolle: gleicher Nachname, anderer Vorname (Familie) → unklar', rolleAusImpressum('Anna-Lena Maus', ['Klaus Maus']) === 'unklar')
check('Skill-Rolle: gf → inhaber', rolleFuerSkill('gf', 'angestellt') === 'inhaber')
check('Skill-Rolle: Modell-„angestellt" ohne Impressum → unklar', rolleFuerSkill('unklar', 'angestellt') === 'unklar')
check('Skill-Rolle: Impressum angestellt sticht Modell-inhaber', rolleFuerSkill('angestellt', 'inhaber') === 'angestellt')

/* ── 3. Website-Stufe und Werbebibliothek ──────────────────────────────── */
check('Stufe: veraltet kann nicht stark sein', websiteStufe({ website_stufe: 'stark', zeitgemaess: 'nein' }) === 'schwach')
check('Stufe: stark nur bei zeitgemäß', websiteStufe({ website_stufe: 'stark', zeitgemaess: 'teils' }) === 'solide')
check('Stufe: stark bleibt stark', websiteStufe({ website_stufe: 'stark', zeitgemaess: 'ja', optik: 'modern' }) === 'stark')
check('Stufe: Unsinn → leer', websiteStufe({ website_stufe: 'super', zeitgemaess: 'ja' }) === '')

check('Firmenkern ohne Rechtsform', firmaKern('Müller Immobilien GmbH & Co. KG') === 'Müller Immobilien', firmaKern('Müller Immobilien GmbH & Co. KG'))
check('Werbebibliothek-Link nach Kevins Muster', metaAdsUrl('Maus Immobilien GmbH') === 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=DE&q=Maus%20Immobilien&search_type=keyword_unordered')
// Texte wie am 22.09. gemessen (gekürzt)
const evTreffer = 'Cookies\n~300 Ergebnisse\nDiese Ergebnisse beinhalten aktive Werbeanzeigen\nAktiv\nAnzeigendetails ansehen\nEngel & Völkers\nAnzeige\nElegant contemporary architecture'
check('Ads: Werbetreibender trägt den Namen → ja', metaAdsAuswerten(evTreffer, 'Engel & Völkers GmbH') === 'ja')
check('Ads: Treffer nur im Anzeigentext anderer → unbekannt, nie „nein"', metaAdsAuswerten(evTreffer, 'Maus Immobilien') === 'unbekannt')
check('Ads: keine Anzeigen → nein', metaAdsAuswerten('Filter\nFür deine Suchkriterien wurden keine Anzeigen gefunden\nEntferne', 'Stierling Immobilien') === 'nein')
check('Ads: Login-Wand/kaputt → unbekannt', metaAdsAuswerten('Anmelden\nPasswort vergessen?', 'Stierling Immobilien') === 'unbekannt')

/* ── 4. Entscheider zuerst ─────────────────────────────────────────────── */
const basis = {
  firma: 'Paegel Real Estate GmbH',
  website: 'https://paegel.de/',
  geschaeftsmodell: 'makler',
  rolle_impressum: 'angestellt',
  impressum_gf: ['Jan Paegel'],
  stationen: [{ firma: 'Paegel Real Estate', rolle: 'Maklerin', seit: '2023', selbststaendig: false }],
  groesse: 'klein',
}
const charlotte = { name: 'Charlotte Rostek', headline: 'Maklerin mit Herz' }
const u1 = entscheiderUrteil(charlotte, basis)
check('reine Angestellte → zurückgestellt', u1.zurueckstellen === true, u1)
check('Text beginnt mit „[zurückgestellt] erst GF <Name> anfragen"', u1.text.startsWith('[zurückgestellt] erst GF Jan Paegel anfragen'), u1.text)
check('GF wird neuer Kandidat', u1.neu.length === 1 && u1.neu[0].gf_key === 'jan paegel', u1.neu)
check('Grund nennt die Mitarbeiterin und ihre Rolle', grundFuer(charlotte, basis) === 'Charlotte Rostek (Maklerin) ist schon in deiner Liste', grundFuer(charlotte, basis))

const u2 = entscheiderUrteil(charlotte, basis, { bekannteLeads: new Set(['jan paegel']) })
check('GF schon Kontakt → kein neuer Kandidat, trotzdem zurückgestellt', u2.neu.length === 0 && u2.zurueckstellen && /schon in deinen Kontakten/.test(u2.text), u2)
const u3 = entscheiderUrteil(charlotte, basis, { kandidatStatus: new Map([['jan paegel', 'angefragt']]) })
check('GF schon angefragt → kein neuer Kandidat, zurückgestellt', u3.neu.length === 0 && u3.zurueckstellen, u3)
const u4 = entscheiderUrteil(charlotte, basis, { kandidatStatus: new Map([['jan paegel', 'verworfen']]) })
check('GF verworfen → Angestellte wird normal geschrieben', !u4.zurueckstellen && u4.neu.length === 0, u4)

const philipp = { name: 'Philipp Hilgeland', headline: 'Makler auf Sylt' }
const u5 = entscheiderUrteil(philipp, { ...basis, firma: 'MAUS Immobilien', impressum_gf: ['Klaus Maus'], stationen: st })
check('Angestellt mit eigener Firma → GF auf die Liste, aber nicht zurückgestellt', !u5.zurueckstellen && u5.neu.length === 1, u5)

const konzern = { ...basis, firma: 'Von Poll Immobilien GmbH', groesse: 'konzern', impressum_gf: ['Daniel Ritter', 'Sven Pauly'], stationen: [{ firma: 'Von Poll Immobilien', rolle: 'Head of Marketing', seit: '2021', selbststaendig: false }] }
const u6 = entscheiderUrteil({ name: 'Lisa Marketing', headline: 'Head of Marketing' }, konzern)
check('Konzern + Marketing → GF aufnehmen, Angestellte NICHT zurückstellen', !u6.zurueckstellen && u6.neu.length === 2, u6)
const u7 = entscheiderUrteil({ name: 'Tom Makler', headline: 'Immobilienberater' }, { ...konzern, stationen: [{ firma: 'Von Poll Immobilien', rolle: 'Immobilienberater', seit: '2021', selbststaendig: false }] })
check('Konzern ohne Marketing-Rolle → zurückgestellt', u7.zurueckstellen, u7)
check('Konzern erkannt an AG im Namen', istKonzern({ firma: 'Muster Wohnen AG' }))
check('sich selbst (mit Tippfehler) findet niemand als GF', entscheiderUrteil({ name: 'Maurice Jünglin' }, { ...basis, impressum_gf: ['Maurice Jnglin'] }).gf.length === 0)
check('höchstens zwei GF je Firma', entscheiderUrteil(charlotte, { ...basis, impressum_gf: ['A Eins', 'B Zwei', 'C Drei'] }).neu.length === 2)

check('GF im Impressum → nichts zu tun', !entscheiderUrteil(charlotte, { ...basis, rolle_impressum: 'gf' }).zurueckstellen)
check('Rolle unklar → nichts zu tun', !entscheiderUrteil(charlotte, { ...basis, rolle_impressum: 'unklar' }).zurueckstellen)
check('Hausverwaltung ist nicht Zielgruppe', !entscheiderUrteil(charlotte, { ...basis, geschaeftsmodell: 'hausverwaltung' }).zurueckstellen)
check('Projektentwickler ist Zielgruppe', entscheiderUrteil(charlotte, { ...basis, geschaeftsmodell: 'projektentwickler' }).zurueckstellen)
check('Namensschlüssel ohne Titel/Zusatz', namensSchluessel('Dr. Jan Pägel, MRICS') === 'jan pagel', namensSchluessel('Dr. Jan Pägel, MRICS'))

/* ── Die abgeschaffte GF-Frage ─────────────────────────────────────────── */
check('GF-Frage steht nicht mehr im CTA-Katalog', !Object.values(CTA_KATALOG).includes(ALTE_GF_FRAGE))
const alt = ohneAlteGfFrage(`Moin Jan,\n\neure Seite ist stark.\n\n${ALTE_GF_FRAGE}`)
check('GF-Frage wird aus Entwürfen entfernt, Mandats-Frage rückt nach', alt.korrigiert && !alt.text.includes('Geschäftsführung') && alt.text.endsWith(CTA_KATALOG.mandate), alt.text)
const ang = ohneAnalyseFuerAngestellte('Moin Philipp,\n\nMakler bei Maus, dazu CheckOut. Wo liegt bei dir gerade der Hauptfokus?\n\nIch hab dir eine Analyse gemacht. Hast du was dagegen, wenn ich sie dir einmal rüberschicke?')
check('Angestellte: Analyse raus, eigene Schlussfrage bleibt, keine GF-Frage', !/analyse|Geschäftsführung/i.test(ang) && ang.endsWith('Hauptfokus?'), ang)

const roh = parseErstnachrichtenRoh('```json\n{"nachrichten":[],"uebersprungen":[{"profil_key":"k","name":"N","grund":"[zurückgestellt] erst GF X anfragen","firma":"F","website":"w.de"}]}\n```')
check('übersprungen trägt Firma und Website mit', roh.uebersprungen[0]?.firma === 'F' && roh.uebersprungen[0]?.website === 'w.de', roh.uebersprungen)

/* ── Oberfläche ────────────────────────────────────────────────────────── */
check(
  'LinkedIn-Suchlink nach Kevins Muster',
  linkedinZiel({ gf_name: 'Jan Paegel', firma: 'Paegel Real Estate GmbH', linkedin_url: null }) ===
    'https://www.linkedin.com/search/results/people/?keywords=Jan%20Paegel%20Paegel%20Real%20Estate',
)
check('bekanntes Profil schlägt die Suche', linkedinZiel({ gf_name: 'X', firma: 'Y', linkedin_url: 'https://www.linkedin.com/in/x/' }) === 'https://www.linkedin.com/in/x/')
check('fremde URL wird nicht verlinkt', linkedinZiel({ gf_name: 'X', firma: '', linkedin_url: 'https://evil.example/' }).startsWith('https://www.linkedin.com/search/'))
const k = (id: string, status: EntscheiderKandidat['status'], created_at: string): EntscheiderKandidat => ({ id, gf_name: id, firma: '', website: '', quelle_name: '', grund: '', linkedin_url: null, status, status_at: null, created_at })
const liste = heuteAnfragen([k('b', 'offen', '2026-09-22T10:00'), k('a', 'offen', '2026-09-21T10:00'), k('c', 'angefragt', '2026-09-20T10:00')])
check('Heute anfragen: nur offene, älteste zuerst', liste.map((x) => x.id).join() === 'a,b', liste.map((x) => x.id))

console.log(`verify-entscheider: ${pass} ok, ${fail} fehlgeschlagen`)
if (fail) process.exit(1)
