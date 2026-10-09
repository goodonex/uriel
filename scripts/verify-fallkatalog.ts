/**
 * scripts/verify-fallkatalog.ts — der Fallkatalog als Prüfung (09.10.2026).
 *
 * Kevin, 09.10.2026: *„Kannst du einmal postmortem-mäßig durchspielen, was sind
 * die nächsten 100 Fälle, die auf uns zukommen? Was sind die nächsten 100 Leads,
 * die wir verbrennen?"* Die Antwort steht in `docs/fallkatalog-outreach.md`.
 * Diese Datei hält sie fest, damit kein Umbau sie still wieder aufreißt:
 *
 * 1. **Matrix** — jede Kombination aus Zielgruppe × Größe × Website-Zustand ×
 *    Anzeigen × Verbund × Rolle (504 Fälle) bekommt einen Ansatz, und für jeden
 *    gelten dieselben Gesetze: großer Player nie Analyse, Verwaltung nie
 *    Analyse, keine Seite nie Analyse, starke Seite nie Analyse …
 * 2. **Satz-Wache an echten Sätzen** — Sätze, die wirklich rausgingen und Leads
 *    gekostet haben, müssen hängen bleiben; die Vorlagen aus `schreiben.md`
 *    müssen durchgehen (sonst blockiert die Wache Kevins eigene Texte).
 * 3. **Lage** — große Player werden an Belegen erkannt, normale Makler nicht.
 *
 *   npx tsx scripts/verify-fallkatalog.ts
 */
// @ts-expect-error — .mjs ohne Typen
import { ansatzFuer, istFrisch } from '../runner/linkedin/erstnachrichtenAblauf.mjs'
// @ts-expect-error — .mjs ohne Typen
import { klaresNein } from '../runner/linkedin/antwortThreads.mjs'
// @ts-expect-error — .mjs ohne Typen
import { domainVarianten } from '../runner/linkedin/leadRecherche.mjs'
// @ts-expect-error — .mjs ohne Typen
import { gewichtAus, kanalFuerAnsatz, lageAus } from '../runner/regeln/lage.mjs'
// @ts-expect-error — .mjs ohne Typen
import { pruefeText } from '../runner/regeln/textWache.mjs'
// @ts-expect-error — .mjs ohne Typen
import { regelwerk } from '../runner/regeln/fassung.mjs'

let fehler = 0
let geprueft = 0
const fehlerListe: string[] = []
function check(name: string, ok: boolean, detail?: unknown) {
  geprueft++
  if (ok) return
  fehler++
  fehlerListe.push(`✗ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail).slice(0, 300)}`}`)
}
const heute = new Date('2026-10-09T12:00:00Z')

/* ── 1. Matrix ─────────────────────────────────────────────────────────── */

const MODELLE = ['makler', 'projektentwickler', 'hausverwaltung'] as const
const GEWICHTE = ['normal', 'gross'] as const
const SEITEN = {
  keine: { website: '', erreichbar: '', sicher: false },
  'offline-sicher': { website: 'https://x-immo.de/', erreichbar: 'offline', sicher: true },
  'offline-geraten': { website: 'https://x-immo.de/', erreichbar: 'offline', sicher: false },
  schwach: { website: 'https://x-immo.de/', erreichbar: 'ja', sicher: true, website_stufe: 'schwach', zeitgemaess: 'nein', wow_potenzial: 'ja', elefant_typ: 'optik-veraltet' },
  'solide-knapp': { website: 'https://x-immo.de/', erreichbar: 'ja', sicher: true, website_stufe: 'solide', zeitgemaess: 'ja', wow_potenzial: 'knapp', elefant_typ: 'feinschliff' },
  'solide-wow': { website: 'https://x-immo.de/', erreichbar: 'ja', sicher: true, website_stufe: 'solide', zeitgemaess: 'ja', wow_potenzial: 'ja', elefant_typ: 'kein-eigentuemer-weg' },
  stark: { website: 'https://x-immo.de/', erreichbar: 'ja', sicher: true, website_stufe: 'stark', zeitgemaess: 'ja', wow_potenzial: 'nein', elefant_typ: 'feinschliff' },
  'neu-relauncht': { website: 'https://x-immo.de/', erreichbar: 'ja', sicher: true, website_stufe: 'solide', zeitgemaess: 'ja', wow_potenzial: 'ja', relaunch: 'neu' },
  'im-umbau': { website: 'https://x-immo.de/', erreichbar: 'ja', sicher: true, website_stufe: 'schwach', zeitgemaess: 'nein', wow_potenzial: 'ja', relaunch: 'im-umbau' },
  'suche-gescheitert': { website: '', erreichbar: '', sicher: false, suche_vollstaendig: false },
} as const
const ANZEIGEN = {
  'beide-nein': { meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein' },
  'google-ja': { meta_ads_aktiv: 'nein', google_ads_aktiv: 'ja' },
  unbekannt: { meta_ads_aktiv: 'unbekannt', google_ads_aktiv: 'unbekannt' },
} as const
const VERBUENDE = ['', 'RE/MAX'] as const
const ROLLEN = ['inhaber', 'angestellt-nebenfirma'] as const

const ANALYSE_ANSAETZE = new Set(['analyse', 'seite-ist-das-thema', 'projektentwickler'])
const zaehler: Record<string, Record<string, number>> = {}

for (const modell of MODELLE)
  for (const gewicht of GEWICHTE)
    for (const [seiteName, seite] of Object.entries(SEITEN))
      for (const [anzName, anz] of Object.entries(ANZEIGEN))
        for (const verbund of VERBUENDE)
          for (const rolle of ROLLEN) {
            const firma = verbund ? 'Müller Immobilien' : 'X Immobilien GmbH'
            const recherche: Record<string, unknown> = {
              firma,
              geschaeftsmodell: modell,
              ...seite,
              ...anz,
              rolle: rolle === 'inhaber' ? 'inhaber' : 'angestellt',
              rolle_impressum: rolle === 'inhaber' ? 'gf' : 'angestellt',
              stationen:
                rolle === 'inhaber'
                  ? [{ firma, rolle: 'Geschäftsführer', seit: '2015', selbststaendig: true }]
                  : [
                      { firma: 'Großmakler AG', rolle: 'Makler', seit: '2019', selbststaendig: false },
                      { firma: 'Eigene Projekte GbR', rolle: 'Inhaber', seit: '2018', selbststaendig: true },
                    ],
              ...(verbund ? { verbund, verbund_beleg: `Franchisepartner bei ${verbund}` } : {}),
              ...(gewicht === 'gross' ? { gewicht: 'gross', gewicht_beleg: 'über 30 Milliarden begleitetes Transaktionsvolumen' } : {}),
            }
            const lead = { name: 'Max Muster', profil_key: 'm', headline: verbund ? `Immobilienmakler bei ${verbund}` : 'Geschäftsführer', recherche }
            const fall = `${modell}/${gewicht}/${seiteName}/${anzName}/${verbund || 'eigen'}/${rolle}`
            const a = ansatzFuer(lead, heute)
            const ansatz = 'ansatz' in a ? a.ansatz : 'spaeter' in a ? 'spaeter' : 'zurueck'
            ;(zaehler[modell] ??= {})[ansatz] = ((zaehler[modell] ??= {})[ansatz] ?? 0) + 1

            // Gesetz 1: Verbund mit Beleg geht vor allem (Kevin 07.10.2026).
            if (verbund) {
              check(`${fall}: Verbund → Aufbau V`, ansatz === 'verbund', a)
              continue
            }
            // Gesetz 2: Angestellter mit eigener Firma nebenher → Nebenfirma, keine Analyse.
            if (rolle === 'angestellt-nebenfirma') {
              check(`${fall}: angestellt + Nebenfirma → Aufbau N`, ansatz === 'nebenfirma', a)
              continue
            }
            // Gesetz 3: Großer Player → G, egal wie die Seite ist (Anzenberger, 05.10.2026).
            if (gewicht === 'gross') {
              check(`${fall}: großer Player → Aufbau G`, ansatz === 'grosser-player', a)
              continue
            }
            // Gesetz 4: Verwaltung → H, nie Analyse (Kevin 25.09. und 08.10.2026).
            if (modell === 'hausverwaltung') {
              check(`${fall}: Verwaltung → Aufbau H`, ansatz === 'hausverwaltung', a)
              continue
            }
            // Gesetz 5: Seite nicht da oder nur geraten → nie Analyse, nie „offline" über eine geratene Domain.
            if (seiteName === 'keine') check(`${fall}: keine Seite → D oder F`, ['keine-seite', 'frisch-ohne-seite'].includes(ansatz), a)
            if (seiteName === 'offline-geraten') check(`${fall}: geratene tote Domain → D mit Prüf-Hinweis, nie C`, ansatz === 'keine-seite' && 'pruefen' in a, a)
            if (seiteName === 'offline-sicher') check(`${fall}: bestätigte Seite offline → C`, ansatz === 'seite-offline', a)
            // Gesetz 5b: Gescheiterte Suche ist nicht „keine Seite" → später neu suchen, keine Zeile (09.10.2026).
            if (seiteName === 'suche-gescheitert') {
              check(`${fall}: Suche gescheitert → später, kein D`, ansatz === 'spaeter', a)
              continue
            }
            // Gesetz 5c: Relaunch → R/R2, nie Analyse an eine frisch bezahlte Seite (Postmortem: 13 Fälle).
            if (seiteName === 'neu-relauncht') check(`${fall}: frisch neue Seite → R`, ansatz === 'neue-seite', a)
            if (seiteName === 'im-umbau') check(`${fall}: Seite im Umbau → R2`, ansatz === 'seite-im-umbau', a)
            // Gesetz 6: Starke Seite → S nur, wenn beide Anzeigen-Prüfungen nein; sonst T. Nie Analyse.
            if (seiteName === 'stark') check(`${fall}: starke Seite → ${anzName === 'beide-nein' ? 'S' : 'T'}`, ansatz === (anzName === 'beide-nein' ? 'starke-seite' : 'starke-seite-funnel'), a)
            // Gesetz 7: Seite mit Hebel → Analyse-Kanal (Entwickler: P, schwach: Seite ist das Thema).
            if (seiteName === 'schwach') check(`${fall}: schwache Seite → Analyse-Kanal`, modell === 'projektentwickler' ? ansatz === 'projektentwickler' : ansatz === 'seite-ist-das-thema', a)
            if (seiteName.startsWith('solide')) check(`${fall}: solide Seite mit Hebel → Analyse-Kanal`, ANALYSE_ANSAETZE.has(ansatz), a)
            // Gesetz 8 (übergreifend): Analyse nur, wo die Seite da ist, uns gehört und wir sichtbar besser bauen.
            if (ANALYSE_ANSAETZE.has(ansatz)) check(`${fall}: Analyse nur mit Wow-Potenzial`, ['ja', 'knapp'].includes(String(recherche.wow_potenzial)), a)
            // Gesetz 9: Jeder Ansatz hat einen Kanal.
            check(`${fall}: Ansatz ${ansatz} hat einen Kanal`, Boolean(kanalFuerAnsatz(ansatz)), a)
          }

/* ── 2. Satz-Wache an echten Sätzen ──────────────────────────────────── */

type Satz = { text: string; lage?: Record<string, unknown>; verlauf?: unknown[]; erwartet: string | null; wer: string }
const lageNormal = { kanal: 'analyse', gewicht: 'normal', website_stufe: 'solide', meta_ads_aktiv: 'unbekannt', google_ads_aktiv: 'unbekannt', geschaeftsmodell: 'makler' }
const lageSchwach = { ...lageNormal, website_stufe: 'schwach', zeitgemaess: 'nein', ansatz: 'seite-ist-das-thema' }
const lageGross = { ...lageNormal, kanal: 'frage', gewicht: 'gross', geschaeftsmodell: 'projektentwickler' }
const lageHv = { ...lageNormal, kanal: 'frage', geschaeftsmodell: 'hausverwaltung' }

const MUSS_HAENGEN: Satz[] = [
  // Keine Website behauptet — fünf verbrannte Leads (08.10.2026).
  { wer: 'Ariana / Günes / Beros', text: 'Moin Ariana,\n\nich hab nach eurer Website gesucht und keine gefunden.', erwartet: 'keine-seite' },
  { wer: 'Luis Alt', text: 'Ich hab die Website zu deinen Kapitalanlage-Objekten gesucht und außer Immolegenden auf Instagram nichts gefunden.', erwartet: 'keine-seite' },
  { wer: 'Röper', text: 'Wer euch googelt, landet bei einem anderen Röper Immobilien in Lippstadt.', erwartet: 'keine-seite' },
  // Bewertungstool als Mangel — trotz Regel vom 23.09. achtmal danach gesendet.
  { wer: 'Tobias Jauck', text: 'Die Bewertung liefert aber erst nach dem Formular per Mail einen Wert.', erwartet: 'bewertung-als-mangel' },
  { wer: 'Bastian Zaremba', text: 'Die groß beworbene kostenlose Bewertung ist aber ein Formular mit Rückmeldung erst nach 24 Stunden.', erwartet: 'bewertung-als-mangel' },
  { wer: 'Ricco Klein', text: 'Hinter dem Bewertungs-Button liegt aber nur ein Kontaktformular ohne Ergebnis.', erwartet: 'bewertung-als-mangel' },
  { wer: 'Bilhan Öz', text: 'Der Weg für Eigentümer ist angelegt, hinter der Bewertung liegt aber nur ein Formular ohne Sofort-Ergebnis.', erwartet: 'bewertung-als-mangel' },
  { wer: 'Manuel Ludwig', text: 'Der Bewertungs-Einstieg auf der Startseite bricht aber nach der Auswahl des Immobilientyps mit einem bloßen Weiter ab, ohne dass ein Wert sichtbar wird.', erwartet: 'bewertung-als-mangel' },
  { wer: 'Michaela Beer', text: 'Die Frage "Was ist Ihre Immobilie wert?" führt ins Leere, ohne echtes Bewertungstool dahinter.', erwartet: 'bewertung-als-mangel' },
  // Großer Player (Anzenberger, 05.10.2026).
  { wer: 'Robert Anzenberger', lage: lageGross, text: 'Der einzige Weg zu euch ist danach eine info@-Adresse und eine Zentrale.', erwartet: 'grosser-player-kleinkritik' },
  { wer: 'Robert Anzenberger', lage: lageGross, text: 'Wer euch ein Grundstück anbieten will, landet im selben Postfach wie eine Bewerbung.', erwartet: 'grosser-player-kleinkritik' },
  { wer: 'Robert Anzenberger', lage: lageGross, text: 'Ich hab dir dazu eine kurze Analyse vorbereitet.', erwartet: 'analyse-ohne-freigabe' },
  // Verwaltung bekommt keine Analyse (Beros, 08.10.2026) und keinen Eigentümer-Sprech.
  { wer: 'Cinzia Beros', lage: lageHv, text: 'Ich hab dir dazu eine kurze Analyse vorbereitet. Hast du was dagegen, wenn ich sie dir einmal rüberschicke?', erwartet: 'analyse-ohne-freigabe' },
  { wer: 'Verwaltung', lage: lageHv, text: 'Sie zeigt, was sich daraus für mehr planbare Eigentümer-Anfragen machen lässt.', erwartet: 'eigentuemer-falsche-zielgruppe' },
  // Schwache Seite: Detailkritik statt Seite (Kevin, 09.10.2026).
  { wer: 'schwache Seite', lage: lageSchwach, text: 'Das Kontaktformular fragt aber nur nach Name und Telefonnummer.', erwartet: 'detailkritik-schwache-seite' },
  { wer: 'schwache Seite', lage: lageSchwach, text: 'Für Eigentümer gibt es keinen eigenen Menüpunkt.', erwartet: 'detailkritik-schwache-seite' },
  // Anzeigen ohne Beleg.
  { wer: 'Anzeigen unbekannt', lage: lageNormal, text: 'Was mir aufgefallen ist: Ihr schaltet weder bei Google noch bei Meta Anzeigen.', erwartet: 'keine-anzeigen-ohne-beleg' },
  { wer: 'Anzeigen unbekannt', lage: lageNormal, text: 'Ich hab gesehen, dass ihr bei Google schon Anzeigen schaltet.', erwartet: 'anzeigen-ja-ohne-beleg' },
  // Geld unterstellen (Kremkau, 08.10.2026).
  { wer: 'Danny Kremkau', text: 'Wann wird bei euch wieder Kapital frei?', erwartet: 'kapital-unterstellung' },
  { wer: 'Danny Kremkau', text: 'Meld dich gern, wenn das Kapital wieder frei ist.', erwartet: 'kapital-unterstellung' },
  // Kleinkram.
  { wer: 'Kleinkram', text: 'Im Footer steht noch Copyright 2019.', erwartet: 'kleinkram' },
  { wer: 'Kleinkram', text: 'Auf der Startseite ist ein Tippfehler in der Überschrift.', erwartet: 'kleinkram' },
  { wer: 'Kleinkram', text: 'Die Seite hat eine lange Ladezeit.', erwartet: 'kleinkram' },
  // „fake" (Bellevue Estates, 05.10.2026).
  { wer: 'Bellevue Estates', text: 'Die Kundenstimmen wirken leider fiktiv.', erwartet: 'stimmen-fake' },
  // Geviertstrich.
  { wer: 'Pascal Ryser', text: 'Auf der Startseite fehlt aber ein einziges realisiertes Projekt — kein Foto, kein Beispiel.', erwartet: 'geviertstrich' },
  // Lücken der alten Sperre, alle wirklich verschickt (Audit 09.10.2026).
  { wer: 'Almshhour', text: 'Eine Seite von euch hab ich nicht gefunden.', erwartet: 'keine-seite' },
  { wer: 'Suverato', text: 'Ich hab dein Profil gefunden, eine eigene Website von DK Homes aber nicht.', erwartet: 'keine-seite' },
  { wer: 'Köster', text: 'Ich hab nach einer Website von k2s gesucht und nur Registereinträge gefunden.', erwartet: 'keine-seite' },
  { wer: 'Scheer', text: 'Gefunden hab ich nur dein RE/MAX-Profil, keine eigene Markenpräsenz.', erwartet: 'keine-seite' },
  { wer: 'Simmen', text: 'Im Moment findet man dich nur über dein Engel & Völkers-Profil, eine eigene Seite gibt es noch nicht.', erwartet: 'keine-seite' },
  { wer: 'Scherhag', text: 'Online hat R&R noch keinen Auftritt.', erwartet: 'keine-seite' },
  { wer: 'Varianten', text: 'Eure Website konnte ich leider nicht finden.', erwartet: 'keine-seite' },
  { wer: 'Varianten', text: 'Ich bin auf keine eigene Seite gestoßen.', erwartet: 'keine-seite' },
  // Abwertende Bilder (Postmortem: 5 von 7 Design-Kritiken negativ beantwortet).
  { wer: 'Postmortem', text: 'Die Seite wirkt wie eine Vorlage, in die niemand eingezogen ist.', erwartet: 'abwertend' },
  { wer: 'Postmortem', text: 'Der Hero wirkt ehrlich gesagt etwas schräg.', erwartet: 'abwertend' },
  // Lead siezt, Text duzt.
  { wer: 'Anzenberger (Antwort)', verlauf: [{ sender: 'them', text: 'Sehr geehrter Herr Herrmann, danke für das Angebot, wir sind hier im Moment so zufrieden.' }], text: 'Moin Robert, verstehe. Woran hängt bei dir der nächste Deal?', erwartet: 'du-an-sie-schreiber' },
]

const MUSS_DURCH: Satz[] = [
  // Vorlagen aus schreiben.md, ausgefüllt (sonst blockiert die Wache Kevins eigene Texte).
  { wer: 'Aufbau A', lage: lageNormal, erwartet: null, text: 'Moin Lena,\n\nich hab mir hansen-immo.de angeschaut. Schön, dass eure freien Objekte direkt vorne stehen. Für Eigentümer gibt es aber keinen eigenen Weg, nur die Käufer-Suche. Wer verkaufen will, sucht sich da den nächsten Makler.\n\nIch hab dir dazu eine kurze Analyse vorbereitet. Sie zeigt konkret, wo Potenzial liegen bleibt und was sich daraus für mehr planbare Eigentümer-Anfragen machen lässt.\n\nHast du was dagegen, wenn ich sie dir einmal rüberschicke?' },
  { wer: 'Aufbau A (Seite alt)', lage: lageSchwach, erwartet: null, text: 'Moin Jens,\n\nich hab mir jens-immo.de angeschaut. Schön, dass eure freien Objekte direkt vorne stehen. Ehrlich gesagt wirkt der Rest aber, als hätte die Seite seit zwanzig Jahren niemand angefasst. Wer heute drei Makler vergleicht, fragt da beim nächsten an.\n\nIch hab dir dazu eine kurze Analyse vorbereitet. Sie zeigt konkret, wo Potenzial liegen bleibt und was sich daraus für mehr planbare Eigentümer-Anfragen machen lässt.\n\nHast du was dagegen, wenn ich sie dir einmal rüberschicke?' },
  { wer: 'Aufbau S', lage: { ...lageNormal, kanal: 'frage', website_stufe: 'stark', meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein' }, erwartet: null, text: 'Moin Petra,\n\nich hab mir petra-immo.de angeschaut. Euer Wertrechner mit Sofort-Ergebnis und die eigene Seite für Verkäufer, das ist richtig gut gemacht. Da würde ich ehrlich gesagt nichts anders bauen.\n\nWas mir aufgefallen ist: Ihr schaltet weder bei Google noch bei Meta Anzeigen. Und über die normale Google-Suche findet man euch auch kaum.\n\nEhrliche Frage: Habt ihr das bewusst so gelassen, oder ist es bisher einfach nicht dazu gekommen?' },
  { wer: 'Aufbau T', lage: { ...lageNormal, kanal: 'frage', website_stufe: 'stark', meta_ads_aktiv: 'nein', google_ads_aktiv: 'ja' }, erwartet: null, text: 'Moin Tim,\n\nich hab mir tim-immo.de angeschaut. Der Eigentümer-Bereich mit Ablauf in sechs Schritten ist richtig stark. Da würde ich ehrlich gesagt nichts anders bauen.\n\nIch hab gesehen, dass ihr bei Google schon Anzeigen schaltet.\n\nEhrliche Frage: Wenn darüber ein Eigentümer anfragt, wer meldet sich bei ihm, und wie schnell?' },
  { wer: 'Aufbau H', lage: lageHv, erwartet: null, text: 'Moin Anna,\n\nich hab mir hv-anna.de angeschaut. Eure Objekte in Leipzig und Halle mit Foto und Ansprechpartner, das sieht man bei Verwaltungen selten.\n\nEhrliche Frage: Sucht ihr gerade eher neue Objekte zur Verwaltung, oder seid ihr ohnehin gut ausgelastet?' },
  { wer: 'Aufbau V', lage: { ...lageNormal, kanal: 'frage' }, erwartet: null, text: 'Moin Roger,\n\nEngel & Völkers, und davor zehn Jahre eigene Vermietung am Zürichsee.\n\nEhrliche Frage: Planst du, dich in Zukunft mit einer eigenen Marke selbstständig zu machen?' },
  { wer: 'Aufbau D', lage: { ...lageNormal, kanal: 'frage', website: '' }, erwartet: null, text: 'Moin Erik,\n\nzwölf Jahre bei von Poll und jetzt die eigene Firma in Kiel, Glückwunsch. Eigentümer, die verkaufen wollen, schauen sich online an, mit wem sie es zu tun haben, bevor sie anrufen.\n\nWo finde ich euch?' },
  { wer: 'Aufbau C', lage: { ...lageNormal, kanal: 'frage' }, erwartet: null, text: 'Moin Kiril,\n\nich wollte mir klg-realestate.de anschauen, die Seite lädt bei mir aber nicht. Ein Eigentümer, der dich vor dem Verkauf googelt, landet genau dort.\n\nIst die Seite gerade offline, oder komme nur ich nicht drauf?' },
  { wer: 'Aufbau C (Zertifikat)', lage: { ...lageNormal, kanal: 'frage' }, erwartet: null, text: 'Moin Jan,\n\nich wollte mir haueisen.de anschauen, mein Browser lässt mich wegen eines Sicherheitszertifikats aber nicht auf die Seite. Ein Eigentümer, der euch vorher googelt, landet genau dort.\n\nIst das bei euch bekannt, oder komme nur ich nicht drauf?' },
  { wer: 'Aufbau G', lage: lageGross, erwartet: null, text: 'Guten Tag Robert Anzenberger,\n\nProjektentwicklung, Bauträger und Transaktionsberatung unter einem Dach, das sieht man selten.\n\nEhrliche Frage: Woran hängt bei Ihnen heute eher der nächste Deal: am Zugang zu den richtigen Grundstücken oder an den Investoren dafür?' },
  { wer: 'Aufbau R', lage: { ...lageNormal, kanal: 'frage', ansatz: 'neue-seite' }, erwartet: null, text: 'Moin Phil,\n\nich hab mir phil-immo.de angeschaut, Glückwunsch zur neuen Seite. Verkaufen steht jetzt ganz vorne, mit eurem Team darunter.\n\nIst auch schon eingeplant, wie über die neue Seite Eigentümer reinkommen?' },
  { wer: 'Aufbau R2', lage: { ...lageSchwach, kanal: 'frage', ansatz: 'seite-im-umbau' }, erwartet: null, text: 'Moin Valerius,\n\nich hab mir valerius-immo.de angeschaut und gesehen, dass ihr die Seite gerade überarbeitet. Drei Generationen Makler in Bremen, das hat nicht jeder.\n\nWann geht die neue Seite online?' },
  { wer: 'Regel 27 (neu)', lage: { ...lageNormal, kanal: 'frage' }, erwartet: null, text: 'Hallo Roger, Unternehmer mit Herzblut und eine Marke als Person, das passt zu dir. Im Moment läuft das noch über dein Engel & Völkers-Profil. Lass uns da mal zehn Minuten drüber sprechen.' },
  { wer: 'Aufbau F', erwartet: null, text: 'Moin Leonard,\n\nMarienberg Immobilien ist noch ganz frisch, oder? Glückwunsch zum Start.\n\nGibt es schon eine eigene Seite, oder ist die noch in Planung?' },
  { wer: 'Aufbau N', erwartet: null, text: 'Moin Philipp,\n\nMakler bei Maus, dazu CheckOut, Stulle & Meer und Flippi\'s Hüs. Langweilig wird dir auf Sylt jedenfalls nicht.\n\nWo liegt bei dir gerade der Hauptfokus?' },
  // Stärken, die ein Bewertungstool LOBEN, sind erlaubt.
  { wer: 'Lob Bewertung', erwartet: null, text: 'Euer Wertrechner liefert direkt ein Ergebnis, das haben die wenigsten.' },
  // Antworten aus der Stimme (Regeln 19–28).
  { wer: 'Regel 22', lage: lageGross, verlauf: [{ sender: 'them', text: 'Sehr geehrter Herr Herrmann, danke für das Angebot, wir sind hier im Moment so zufrieden.' }], erwartet: null, text: 'Sehr geehrter Herr Anzenberger, bei dem Volumen glaube ich das sofort. Woran hängt bei Ihnen heute eher der nächste Deal, am Zugang zu den richtigen Grundstücken oder an den Investoren dafür?' },
  { wer: 'Regel 21', erwartet: null, text: 'Hallo Danny, Immobilien und Gastronomie im Ausland nebeneinander, das ist eine spannende Mischung. Was ist bei euren Immobilien gerade das größte Thema?' },
  { wer: 'Regel 26', lage: lageHv, erwartet: null, text: 'Hallo Cinzia, stimmt, jetzt hab ich beros-partner.ch. Könnt ihr aktuell noch neue Mandate aufnehmen, oder seid ihr gut ausgelastet?' },
  { wer: 'Regel 19', erwartet: null, text: 'Hey Hauke, Glückwunsch, erst die 50 und dann über 300 Einheiten durch die Übernahmen, das ist ein ordentlicher Sprung. Was hält einen Eigentümer in den drei bis sechs Monaten noch davon ab, bei euch zu unterschreiben?' },
]

for (const s of MUSS_HAENGEN) {
  const funde = pruefeText(s.text, { lage: s.lage ?? null, verlauf: s.verlauf ?? [] })
  check(`Wache fängt (${s.wer}): ${s.erwartet}`, funde.some((f: { id: string }) => f.id === s.erwartet), { text: s.text, funde: funde.map((f: { id: string }) => f.id) })
}
for (const s of MUSS_DURCH) {
  const funde = pruefeText(s.text, { lage: s.lage ?? null, verlauf: s.verlauf ?? [] })
  check(`Wache lässt durch: ${s.wer}`, funde.length === 0, funde)
}

/* ── 3. Lage ───────────────────────────────────────────────────────────── */

const GROSS = [
  'Über 30 Milliarden begleitetes Transaktionsvolumen und 350 Jahre Erfahrung',
  // ba-rep.de, wie der Browser sie liest (Zähler mit Plus, Einheit in der nächsten Zeile).
  'TEAM \n30+\nMilliarden\nin EUR\nTransaktionsvolumen der handelnden Personen',
  'Mit 650 Mio. € Transaktionsvolumen seit 2010',
  'Assets under Management von 4,2 Mrd. Euro',
  'Wir sind eine Kapitalverwaltungsgesellschaft mit Sitz in Frankfurt',
  'über 120 Mitarbeitende an 3 Standorten',
  '12 Standorte in Bayern und Baden-Württemberg',
  'börsennotierte Wohnungsgesellschaft',
]
const NORMAL = [
  'Wir haben über 1.000 Objekte verkauft.',
  'Seit 1998 in Hamburg, 4 Standorte',
  'Projektvolumen von 80 Mio. Euro',
  'Wir vermitteln an institutionelle Investoren und Family Offices',
  '1 Mrd. Menschen nutzen Immobilienportale',
  'Ihr Makler für Kiel mit 6 Mitarbeitern',
  'Über 25 Jahre Erfahrung, 650 vermittelte Immobilien',
]
for (const t of GROSS) check(`großer Player erkannt: ${t}`, gewichtAus({}, { texte: [t] }).gewicht === 'gross')
for (const t of NORMAL) check(`kein großer Player: ${t}`, gewichtAus({}, { texte: [t] }).gewicht === 'normal')
check('Konzern + AG = groß', gewichtAus({ groesse: 'konzern', firma: 'Muster Immobilien AG' }).gewicht === 'gross')
check('Schweizer Klein-AG ohne Konzern-Urteil bleibt normal', gewichtAus({ groesse: 'klein', firma: 'ImmoPartner-Basel AG' }).gewicht === 'normal')
check('Lage: Antwort-Thread mit 30 Mrd. im Verlauf → Kanal Frage', lageAus({ recherche: {}, texte: ['Bei über 30 Milliarden begleitetem Transaktionsvolumen'] }).kanal === 'frage')
check('Lage: Verwaltung ohne Ansatz → Kanal Frage', lageAus({ recherche: { geschaeftsmodell: 'hausverwaltung' } }).kanal === 'frage')
check('Lage: normaler Makler ohne Befund → keine Einschränkung', lageAus({ recherche: { geschaeftsmodell: 'makler', website_stufe: 'solide', wow_potenzial: 'ja' } }).kanal === '')

/* ── 4. Regelwerk kennt den neuen Ansatz ─────────────────────────────── */
const r = regelwerk()
check('schreiben.md kennt Aufbau G', /Aufbau G/.test(r.schreiben) && /grosser-player/.test(r.schreiben))
check('schreiben.md hat die Kanal-Tabelle', /Analyse, Frage oder Telefonat/.test(r.schreiben))
check('pruefen.md darf auf G umlenken', /"ansatz": "grosser-player"/.test(r.pruefen))

/* ── Ergebnis ──────────────────────────────────────────────────────────── */
/* ── 5. Absage, Frische, Domains ─────────────────────────────────────── */
for (const [t, e] of [
  ['Damit sollten wir es gut sein lassen.', 'hart'],
  ['Bitte keine weiteren Nachrichten.', 'hart'],
  ['danke für das Angebot, wir sind hier im Moment so zufrieden wie wir aufgestellt sind', 'weich'],
  ['Nein, weil nicht benötigt.', 'weich'],
  ['Bei Bedarf melde ich mich.', 'weich'],
  ['Wir haben schon eine Agentur.', 'weich'],
  ['Die Seite wird im Hintergrund gerade überarbeitet.', ''],
  ['Klingt spannend, schick mal rüber.', ''],
  ['Tell me ;)', ''],
] as const) check(`klaresNein „${t}" → ${e || 'kein Nein'}`, klaresNein(t) === e, klaresNein(t))
const h = new Date('2026-10-09T12:00:00Z')
for (const [seit, e] of [['11/2025', true], ['03/2025', false], ['2026', true], ['2025', false], ['Sep 2025', false], ['Okt 2025', true]] as const)
  check(`frisch gegründet „${seit}" → ${e}`, istFrisch(seit, h) === e)
const dv = (f: string) => domainVarianten(f) as string[]
check('Domain-Variante beros-partner.ch', dv('Beros & Partner Immobilien GmbH').includes('beros-partner.ch'))
check('Domain-Variante dk-homes.ch', dv('DK Homes & Investments AG').includes('dk-homes.ch'))
check('Domain-Variante alcema.de', dv('ALCEMA').includes('alcema.de'))
check('Domain-Variante gunes-immobilien.ch', dv('Günes Immobilien GmbH').includes('gunes-immobilien.ch'))
check('Domain-Variante arianarealestate.de', dv('Ariana Real Estate').includes('arianarealestate.de'))

console.log('Ansätze je Zielgruppe (Matrix, je 240 Fälle):')
for (const [modell, je] of Object.entries(zaehler)) console.log(`  ${modell}: ${Object.entries(je).map(([a, n]) => `${a} ${n}`).join(' · ')}`)
for (const z of fehlerListe) console.log(z)
console.log(`\n${geprueft - fehler} von ${geprueft} Prüfungen grün${fehler ? `, ${fehler} rot` : ''}.`)
process.exit(fehler ? 1 : 0)
