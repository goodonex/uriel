/**
 * scripts/verify-erstnachrichten-ablauf.ts — der A-bis-Z-Ablauf der
 * Erstnachrichten (23.09.2026) an Kevins eigenen Fällen.
 *
 * Kevin am 23.09. nach sieben Nachrichten, von denen fünf nicht rausgehen
 * konnten: *„Wenn wir eine Änderung da drinnen nehmen, dass alles, was danach
 * folgt, immer diese Änderung mit drin hat."* Diese Prüfung hält fest, was der
 * Code (nicht das Modell) entscheidet: welcher Ansatz, wer gar keine Nachricht
 * bekommt, und dass das Regelwerk keine abgeschafften Sätze mehr erlaubt.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/verify-erstnachrichten-ablauf.ts
 */
// @ts-expect-error — .mjs ohne Typen
import { ansatzFuer, ansatzStarkeSeite, ohneVerbund, verbundAbgelehnt } from '../runner/linkedin/erstnachrichtenAblauf.mjs'
import { segmentUrteil } from '../runner/linkedin/erstnachrichtenEntwuerfe.mjs'
// @ts-expect-error — .mjs ohne Typen
import { landFuerDomain } from '../runner/linkedin/googleAds.mjs'
// @ts-expect-error — .mjs ohne Typen
import { seoAuswerten } from '../runner/linkedin/seo.mjs'
// @ts-expect-error — .mjs ohne Typen
import { istVeraltet, regelwerk, QUELLE_PRAEFIX } from '../runner/regeln/fassung.mjs'
// @ts-expect-error — .mjs ohne Typen
import { GESCHAEFTSMODELL_REGEL, immobilienInhaberMitMaklerHerkunft } from '../runner/regeln/zielgruppe.mjs'

let fehler = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) fehler++
}

const heute = new Date('2026-09-23T12:00:00Z')
const lead = (recherche: Record<string, unknown>) => ({ name: 'X', profil_key: 'x', recherche })

/* ── Kevins Fälle vom 23.09. ─────────────────────────────────────────── */
{
  // Amoreal / Assetnow: „Die Seite ist zu gut" — keine Analyse, aber seit 02.10.2026 auch nicht „keine Nachricht".
  // Amoreal schaltet Google-Anzeigen → kein „ihr schaltet keine Werbung"-Aufhänger, sondern Aufbau T.
  const kraus = ansatzFuer(lead({ website: 'https://amoreal.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'nein', rolle: 'inhaber', meta_ads_aktiv: 'nein', google_ads_aktiv: 'ja' }), heute)
  check('Kraus (Amoreal): gute Seite mit Google-Anzeigen → Aufbau T statt Streichung (02.10.2026)', 'ansatz' in kraus && kraus.ansatz === 'starke-seite-funnel', kraus)
  const ohneWerbung = { website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'stark', wow_potenzial: 'ja', meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein' }
  const stark = ansatzFuer(lead(ohneWerbung), heute)
  check('starke Seite, beide Werbe-Prüfungen „nein" → Aufbau S (25.09.2026)', 'ansatz' in stark && stark.ansatz === 'starke-seite', stark)
  const halb = ansatzFuer(lead({ ...ohneWerbung, meta_ads_aktiv: 'unbekannt' }), heute)
  check('starke Seite, Meta ungeprüft → Aufbau T, kein „keine Werbung"-Satz', 'ansatz' in halb && halb.ansatz === 'starke-seite-funnel', halb)
  check('Investor mit benannter Tätigkeit → übersprungen', segmentUrteil({ geschaeftsmodell: 'investor', taetigkeit: 'kauft Mehrfamilienhäuser im Bestand', website: 'https://x.de' }).aktion === 'ueberspringen')
  check('„sonstiges" ohne Tätigkeit und Firma → nicht aussortieren (Ekaterina Blum)', segmentUrteil({ geschaeftsmodell: 'sonstiges', website: 'https://x.de' }).aktion === 'schreiben')
  check('ansatzStarkeSeite: beide nein → S', ansatzStarkeSeite({ meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein' }) === 'starke-seite')
  check('ansatzStarkeSeite: Google ja → T', ansatzStarkeSeite({ meta_ads_aktiv: 'nein', google_ads_aktiv: 'ja' }) === 'starke-seite-funnel')
  check('ansatzStarkeSeite: nichts bekannt → T', ansatzStarkeSeite({}) === 'starke-seite-funnel')
  const regeln = regelwerk()
  check('schreiben.md kennt Aufbau T', /Aufbau T/.test(regeln.schreiben) && /starke-seite-funnel/.test(regeln.schreiben))
  check('Prüfer streicht nie wegen „zu gut für eine Analyse"', /Nie wegen „Seite zu gut für eine Analyse"/.test(regeln.pruefen))
  const knapp = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'knapp' }), heute)
  const hv = ansatzFuer(lead({ website: 'https://hv.de/', erreichbar: 'ja', geschaeftsmodell: 'hausverwaltung', website_stufe: 'stark', wow_potenzial: 'nein' }), heute)
  check('Hausverwaltung → Aufbau H, auch bei starker Seite', 'ansatz' in hv && hv.ansatz === 'hausverwaltung', hv)
  const ev = ansatzFuer({ ...lead({ firma: 'Evernest', website: 'https://evernest.de/', erreichbar: 'ja', rolle: 'angestellt', website_stufe: 'stark', wow_potenzial: 'nein' }), headline: 'Immobilienmakler bei Evernest' }, heute)
  check('Evernest-Makler → Aufbau V, kein Seiten-Ansatz (07.10.2026)', 'ansatz' in ev && ev.ansatz === 'verbund', ev)
  const zentrale = ansatzFuer({ ...lead({ firma: 'Evernest', website: 'https://evernest.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'ja' }), headline: 'CEO & Co-Founder Evernest' }, heute)
  check('Gründer der Dachmarke bekommt Aufbau V nicht', !('ansatz' in zentrale && zentrale.ansatz === 'verbund'), zentrale)
  const vm = ansatzFuer(lead({ firma: 'Müller Immobilien', website: 'https://x.de/', erreichbar: 'ja', verbund: 'RE/MAX', verbund_beleg: 'Franchisepartner bei RE/MAX', website_stufe: 'solide', wow_potenzial: 'ja' }), heute)
  check('Modell-Feld `verbund` mit Partner-Beleg reicht (seit 07.10.2026 nur mit Beleg)', 'ansatz' in vm && vm.ansatz === 'verbund', vm)
  // Blumhagen (07.10.2026): GF seiner eigenen „PMI ProMak - Blumhagen Immobilien GmbH" — kein Verbund.
  const blumhagenR = { firma: 'PMI ProMak - Blumhagen Immobilien GmbH (Promak Immobilien)', website: 'https://promak-immobilien.de/', erreichbar: 'ja', rolle_impressum: 'gf', impressum_gf: ['Markus Blumhagen'], website_stufe: 'solide', wow_potenzial: 'ja' }
  const blumhagen = (r: Record<string, unknown>) => ansatzFuer({ name: 'Markus Blumhagen', profil_key: 'mb', headline: 'Geschäftsführer bei ProMak Immobilien', recherche: { ...blumhagenR, ...r } }, heute)
  const bl1 = blumhagen({})
  check('Blumhagen: eigene Firma mit „PMI ProMak" im Namen → kein Verbund', 'ansatz' in bl1 && bl1.ansatz !== 'verbund', bl1)
  const bl2 = blumhagen({ verbund: 'ProMak', verbund_beleg: 'Franchise-Partner Karlstadt' })
  check('Blumhagen: Modell nennt den eigenen Firmennamen als Dachmarke, Impressum nennt ihn → kein Verbund', 'ansatz' in bl2 && bl2.ansatz !== 'verbund', bl2)
  // Neziri (07.10.2026): eigene LEAN Immobilien, RE/MAX nur frühere Station — kein Verbund.
  const neziri = (r: Record<string, unknown>) => ansatzFuer({ name: 'Mergim Neziri', profil_key: 'mn', headline: 'Geschäftsführer', recherche: { firma: 'LEAN Immobilien', taetigkeit: 'selbstständiger Makler, vorher RE/MAX', stationen: [{ firma: 'LEAN Immobilien', rolle: 'Geschäftsführer', seit: '2023', selbststaendig: true }], website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'ja', ...r } }, heute)
  const nz1 = neziri({})
  check('Neziri: RE/MAX nur in der Tätigkeit (früher) → kein Verbund', 'ansatz' in nz1 && nz1.ansatz !== 'verbund', nz1)
  const nz2 = neziri({ verbund: 'RE/MAX', verbund_beleg: 'RE/MAX ist eine frühere Station' })
  check('Neziri: Modell nennt RE/MAX mit Früher-Beleg → kein Verbund', 'ansatz' in nz2 && nz2.ansatz !== 'verbund', nz2)
  const nz3 = neziri({ verbund: 'RE/MAX', verbund_beleg: 'Makler bei RE/MAX' })
  check('Neziri: bekannte Marke ohne Rolle und nicht in aktueller Station → kein Verbund', 'ansatz' in nz3 && nz3.ansatz !== 'verbund', nz3)
  const ohneBeleg = ansatzFuer(lead({ firma: 'Müller Immobilien', website: 'https://x.de/', erreichbar: 'ja', verbund: 'Irgendwas Netz', website_stufe: 'solide', wow_potenzial: 'ja' }), heute)
  check('Unbekannte Dachmarke ohne Beleg → kein Verbund', 'ansatz' in ohneBeleg && ohneBeleg.ansatz !== 'verbund', ohneBeleg)
  const mitBeleg = ansatzFuer(lead({ firma: 'Müller Immobilien', website: 'https://x.de/', erreichbar: 'ja', verbund: 'Catasto', verbund_beleg: 'Lizenzpartner bei Catasto', website_stufe: 'solide', wow_potenzial: 'ja' }), heute)
  check('Unbekannte Dachmarke mit Lizenz-Beleg → Verbund', 'ansatz' in mitBeleg && mitBeleg.ansatz === 'verbund', mitBeleg)
  const evFranchise = ansatzFuer({ name: 'Anna Beispiel', profil_key: 'ab', headline: 'Lizenzpartnerin', recherche: { firma: 'Engel & Völkers Hamburg-Blankenese', website: 'https://x.de/', erreichbar: 'ja', rolle_impressum: 'gf', impressum_gf: ['Anna Beispiel'], website_stufe: 'solide', wow_potenzial: 'ja' } }, heute)
  check('E&V-Franchisenehmerin im eigenen Impressum bleibt Verbund', 'ansatz' in evFranchise && evFranchise.ansatz === 'verbund', evFranchise)
  const vLead = { name: 'X', profil_key: 'x', ansatz: 'verbund', recherche: { ...blumhagenR, firma: 'Evernest', rolle_impressum: 'unklar', impressum_gf: [] } }
  check('Rückfall: Schreiber lehnt Verbund ab → erkannt', verbundAbgelehnt(vLead, "kein Verbund und keine Dachmarke; Ansatz 'verbund' passt nicht"))
  check('Rückfall: anderer Skip-Grund → kein Rückfall', !verbundAbgelehnt(vLead, 'Finanzberater, kein Makler'))
  const rf = ohneVerbund(vLead, heute)
  check('Rückfall: normaler Ansatz statt Verbund', 'lead' in rf && rf.lead.ansatz === 'analyse' && rf.dachmarke === 'Evernest', rf)
  check('schreiben.md kennt Aufbau V mit festem Schlusssatz', /Aufbau V/.test(regeln.schreiben) && /Planst du, dich in Zukunft mit einer eigenen Marke/.test(regeln.schreiben))
  check('„knapp" bekommt die Analyse (25.09.2026)', 'ansatz' in knapp && knapp.ansatz === 'analyse', knapp)
  const alt = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide' }), heute)
  check('landFuerDomain: .ch → Schweiz, .at → Österreich, sonst Deutschland', landFuerDomain('x.ch') === 2756 && landFuerDomain('x.at') === 2040 && landFuerDomain('x.de') === 2276)
  const seoOk = (organic: unknown) => seoAuswerten({ tasks: [{ status_code: 20000, result: [{ items: organic ? [{ metrics: { organic } }] : [] }] }] })
  check('SEO: nichts gerankt → gering', seoOk(null).seo_sichtbarkeit === 'gering')
  check('SEO: Amoreal (27 Top-10, 538 Besuche) → mittel', seoOk({ pos_1: 2, pos_2_3: 1, pos_4_10: 24, etv: 537.5 }).seo_sichtbarkeit === 'mittel')
  check('SEO: kaputter Abruf → unbekannt, nie gering', seoAuswerten({ tasks: [{ status_code: 40000 }] }).seo_sichtbarkeit === 'unbekannt')
  check('Recherche ohne Wow-Urteil (vor dem 23.09.) → prüfen statt raten', 'zurueck' in alt && /prüfen/.test(alt.zurueck), alt)

  // Hilgeland: laut Impressum nicht Entscheider, eigene Firmen nebenher → Rapport.
  const hilgeland = ansatzFuer(
    lead({
      firma: 'MAUS Immobilien GmbH',
      website: 'https://maus-sylt.de/',
      erreichbar: 'ja',
      rolle: 'angestellt',
      rolle_impressum: 'angestellt',
      website_stufe: 'solide',
      wow_potenzial: 'ja',
      stationen: [
        { firma: 'MAUS Immobilien GmbH', rolle: 'Makler', seit: '2019', selbststaendig: false },
        { firma: 'CheckOut Sylt', rolle: 'Inhaber', seit: '2021', selbststaendig: true },
      ],
    }),
    heute,
  )
  check('Hilgeland (Maus Sylt): Nebenfirma → Rapport, keine Kritik an der Maus-Seite', (hilgeland as any).ansatz === 'nebenfirma', hilgeland)

  // Geschwendtas / Krupka: schwache Seite mit echtem Potenzial → Nachricht.
  const schwach = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'schwach', wow_potenzial: 'ja', rolle: 'inhaber' }), heute)
  check('Schwache Seite mit Wow-Potenzial → die Seite ist das Thema', (schwach as any).ansatz === 'seite-ist-das-thema', schwach)
  const ordentlich = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', zeitgemaess: 'ja', wow_potenzial: 'ja', rolle: 'inhaber' }), heute)
  check('Solide Seite mit echtem Potenzial → Analyse', (ordentlich as any).ansatz === 'analyse', ordentlich)
}

/* ── die übrigen Ansätze ─────────────────────────────────────────────── */
{
  const pe = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'ja', website_stufe: 'solide', wow_potenzial: 'ja', geschaeftsmodell: 'projektentwickler' }), heute)
  check('Projektentwickler bekommt den eigenen Winkel', (pe as any).ansatz === 'projektentwickler', pe)
  const offline = ansatzFuer(lead({ website: 'https://x.de/', erreichbar: 'offline' }), heute)
  check('Seite offline → eigener Aufbau', (offline as any).ansatz === 'seite-offline', offline)
  const geraten = ansatzFuer(lead({ website: 'https://vonbuelow-cie.de/', erreichbar: 'offline', sicher: false }), heute)
  check('Tote, nur geratene Domain → keine Offline-Nachricht, Kevin prüft (v. Bülow, 02.10.2026)', 'ansatz' in (geraten as any) && (geraten as any).ansatz === 'keine-seite' && /googeln/.test((geraten as any).pruefen), geraten)
  const frisch = ansatzFuer(lead({ website: '', stationen: [{ firma: 'R&R Projektentwicklung', seit: 'Aug. 2026', selbststaendig: true }] }), heute)
  check('Frisch gegründet ohne Seite → erst Rapport', (frisch as any).ansatz === 'frisch-ohne-seite', frisch)
  const ohne = ansatzFuer(lead({ website: '', stationen: [{ firma: 'Alt GmbH', seit: '2012', selbststaendig: true }] }), heute)
  check('Keine Seite, lange am Markt → „Wo finde ich euch?"', (ohne as any).ansatz === 'keine-seite', ohne)
}

/* ── Regelwerk und Fassung ───────────────────────────────────────────── */
{
  const r = regelwerk()
  check('Fassung ist ein stabiler Hash', /^[0-9a-f]{10}$/.test(r.fassung) && regelwerk().fassung === r.fassung, r.fassung)
  check('Quelle trägt die Fassung', r.quelle === `${QUELLE_PRAEFIX}@${r.fassung}`, r.quelle)
  // Die abgeschafften Sätze dürfen nur noch unter „Abgeschafft" stehen, nie als erlaubter Schluss.
  const erlaubt = r.schreiben.split('**Abgeschafft')[0]
  check('Mandate-Frage ist kein erlaubter Schluss mehr', !erlaubt.includes('Wie kommen die Mandate aktuell rein?'))
  check('GF-Zuständigkeitsfrage ist kein erlaubter Schluss mehr', !erlaubt.includes('oder liegt das bei der Geschäftsführung?'))
  check('Wertrechner ist ausdrücklich nie der Aufhänger', /Wertrechner oder das Bewertungstool/.test(r.schreiben))
  check('Prüfer kennt Kevins Fälle vom 23.09.', ['MEISSLER', 'Amoreal', 'Assetnow', 'MAUS'].every((f) => r.pruefen.includes(f)))
}

/* ── veraltet oder nicht ─────────────────────────────────────────────── */
{
  const q = regelwerk().quelle
  check('offen, alte Fassung → veraltet', istVeraltet({ status: 'offen', quelle_datei: QUELLE_PRAEFIX }, q))
  check('offen, aktuelle Fassung → nicht veraltet', !istVeraltet({ status: 'offen', quelle_datei: q }, q))
  check('gesendet bleibt immer unberührt', !istVeraltet({ status: 'gesendet', quelle_datei: QUELLE_PRAEFIX }, q))
  check('von Hand angelegt bleibt unberührt', !istVeraltet({ status: 'offen', quelle_datei: 'LinkedIn-Leads Erstnachrichten (Juli 2026).md' }, q))
}

/* ── Bekiri Djelal (06.10.2026): Inhaber einer Immobilienfirma mit Makler-Vergangenheit ── */
{
  // Wörtlich der Grund, mit dem er am 06.10. aussortiert wurde (`linkedin_erstnachrichten`).
  const djelal = {
    geschaeftsmodell: 'sonstiges',
    firma: 'B.I.G. Swiss Immo',
    taetigkeit: 'Inhaber/CEO zweier eigener Firmen (Immo und Finance) seit 03/2024; vorher Teamleiter bei Betterhomes, davor langjährig M',
    website: 'https://raumvisionen.de/',
  }
  check('Djelal: als Inhaber mit Makler-Vergangenheit erkannt', immobilienInhaberMitMaklerHerkunft(djelal))
  check('Djelal: wird geschrieben statt übersprungen', segmentUrteil(djelal).aktion === 'schreiben', segmentUrteil(djelal))
  check(
    'Djelal als „investor" eingestuft: ebenfalls geschrieben',
    segmentUrteil({ ...djelal, geschaeftsmodell: 'investor' }).aktion === 'schreiben',
  )
  check(
    'Aus der Station gelesen (selbstständig, Immo-Firma, vorher Engel & Völkers)',
    immobilienInhaberMitMaklerHerkunft({ taetigkeit: 'führt zwei Firmen', firma: '', stationen: [{ firma: 'Nordlicht Immobilien', rolle: 'Gründer', selbststaendig: true }, { firma: 'Engel & Völkers', rolle: 'Immobilienberater', selbststaendig: false }] }),
  )
  // Die Gegenprobe: was vorher zu Recht rausfiel, fällt weiter raus.
  check('reiner Bestandshalter bleibt übersprungen', segmentUrteil({ geschaeftsmodell: 'investor', taetigkeit: 'Inhaber, kauft Mehrfamilienhäuser im Bestand', firma: 'Nord Capital', website: 'https://x.de' }).aktion === 'ueberspringen')
  check('Finanzierungsvermittler ohne Makler-Vergangenheit bleibt übersprungen', segmentUrteil({ geschaeftsmodell: 'sonstiges', taetigkeit: 'Inhaber einer Baufinanzierungs-Vermittlung für Immobilienkäufer', firma: 'Y Finanz', website: 'https://y.de' }).aktion === 'ueberspringen')
  check('angestellter Makler ohne eigene Firma: nicht als Inhaber gezählt', !immobilienInhaberMitMaklerHerkunft({ rolle: 'angestellt', taetigkeit: 'Makler im Team', firma: 'Engel & Völkers' }))
  check('Recherche-Prompt nennt die Regel (Inhaber mit Makler-Vergangenheit → makler)', /Inhaber, Gründer oder CEO einer eigenen Immobilienfirma/.test(GESCHAEFTSMODELL_REGEL) && /Betterhomes/.test(GESCHAEFTSMODELL_REGEL))
}

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nAlles grün.')
process.exit(fehler ? 1 : 0)
