/**
 * Drift-Wache für Google-Anzeigen, Lead-Profil, Klasse A/B/C und die Runde
 * von 20 Erstnachrichten (22.09.2026).
 *
 * Anlass: Amoreal schaltet seit Mai Google-Anzeigen — die Meta-Bibliothek zeigt
 * das nicht, und geprüft wurde bis dahin nur Meta und nur bei starken Seiten.
 * Eine Nachricht „ihr schaltet keine Anzeigen" wäre falsch gewesen. Dazu
 * Kevins Wunsch, die Follow-ups nach einer Klasse zu ordnen (A = zahlt für
 * Anzeigen, solide Firma, schwache Seite) und die Runde auf 20 zu senken.
 *
 * Alles ohne Netz: Die DataForSEO-Antworten unten sind die echten vom 22.09.
 * (amoreal.de, meissler-co.de), gekürzt.
 *
 * Start: npx tsx scripts/verify-lead-profil.ts
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dataforseoZugang, domainAus, googleAdsAuswerten, pruefeGoogleAds } from '../runner/linkedin/googleAds.mjs'
import {
  baueProfil,
  gruendungAusText,
  handelsregisterAus,
  klasseFuer,
  klassenRang as klassenRangRunner,
  rechtsformAus,
} from '../runner/linkedin/leadProfil.mjs'
import { klassenRang } from '../app/src/cockpit/lib/leadKlasse'
import { ordnePosten, type Posten } from '../app/src/cockpit/lib/prioritaet'
import { followupPosten } from '../app/src/cockpit/lib/arbeitsmodusQuellen'
import { ERSTNACHRICHTEN_RUNDE } from '../app/src/cockpit/lib/tagesFlow'
import type { LinkedinThread } from '../app/src/types/db'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis: unknown = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${typeof hinweis === 'string' ? hinweis : JSON.stringify(hinweis)}` : ''}`)
  }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const JETZT = new Date('2026-09-22T12:00:00Z')

// --- 1. Google-Anzeigen: DataForSEO-Antwort → Felder ----------------------
{
  const amoreal = {
    status_code: 20000,
    tasks: [
      {
        status_code: 20000,
        status_message: 'Ok.',
        result: [
          {
            keyword: 'amoreal.de',
            se_results_count: 1,
            items_count: 1,
            items: [
              {
                type: 'ads_search',
                title: 'Amoreal GmbH',
                verified: true,
                format: 'text',
                first_shown: '2026-05-07 16:59:14 +00:00',
                last_shown: '2026-09-21 17:18:59 +00:00',
              },
            ],
          },
        ],
      },
    ],
  }
  const a = googleAdsAuswerten(amoreal, JETZT)
  check('amoreal.de: läuft', a.google_ads_aktiv === 'ja', a)
  check('amoreal.de: seit 2026-05-07', a.google_ads_seit === '2026-05-07', a)
  check('amoreal.de: 1 Anzeige', a.google_ads_anzahl === 1, a)
  check('amoreal.de: Werbender Amoreal GmbH', a.google_ads_werbender === 'Amoreal GmbH', a)

  const meissler = { tasks: [{ status_code: 40102, status_message: 'No Search Results.', result: [{ items: null, se_results_count: 0 }] }] }
  const m = googleAdsAuswerten(meissler, JETZT)
  check('meissler-co.de (40102): nein, 0', m.google_ads_aktiv === 'nein' && m.google_ads_anzahl === 0, m)

  const alt = JSON.parse(JSON.stringify(amoreal))
  alt.tasks[0].result[0].items[0].last_shown = '2026-03-01 10:00:00 +00:00'
  check('zuletzt vor Monaten gesehen: lief früher, jetzt nicht', googleAdsAuswerten(alt, JETZT).google_ads_aktiv === 'nein')
  check('kaputte Antwort: unbekannt, nie nein', googleAdsAuswerten({ tasks: [{ status_code: 50000 }] }, JETZT).google_ads_aktiv === 'unbekannt')
  check('gar keine Antwort: unbekannt', googleAdsAuswerten(null, JETZT).google_ads_aktiv === 'unbekannt')

  check('Domain: www und Pfad weg', domainAus('https://www.amoreal.de/kontakt') === 'amoreal.de')
  check('Domain: ohne Schema', domainAus('meissler-co.de') === 'meissler-co.de')
  check('Domain: leer bleibt leer', domainAus('') === '')
}

// --- 2. Zugangsdaten: runner/.env zuerst, sonst ~/.seo-skill/.env ---------
{
  const ordner = mkdtempSync(join(tmpdir(), 'verify-lead-profil-'))
  const datei = join(ordner, '.env')
  writeFileSync(datei, 'DATAFORSEO_LOGIN="kevin@example.org"\nDATAFORSEO_PASSWORD=geheim\n')
  check('Zugang aus Prozess-Env', dataforseoZugang({ DATAFORSEO_LOGIN: 'a', DATAFORSEO_PASSWORD: 'b' }, '/gibt/es/nicht')?.login === 'a')
  const z = dataforseoZugang({}, datei)
  check('Zugang aus der Skill-Datei (Anführungszeichen weg)', z?.login === 'kevin@example.org' && z?.passwort === 'geheim', z)
  check('ohne Zugang: null', dataforseoZugang({}, '/gibt/es/nicht') === null)
}

// --- 3. Ohne Zugang wird nicht abgefragt, und das Ergebnis ist „unbekannt" --
{
  let gerufen = 0
  const r = await pruefeGoogleAds('https://amoreal.de', {
    zugang: null,
    fetchFn: (async () => {
      gerufen++
      return new Response('{}')
    }) as typeof fetch,
  })
  check('ohne Zugang: kein Abruf, unbekannt', gerufen === 0 && r.google_ads_aktiv === 'unbekannt', r)
  const mitNetz = await pruefeGoogleAds('https://www.amoreal.de/', {
    zugang: { login: 'x', passwort: 'y' },
    fetchFn: (async (_url: string, init: RequestInit) => {
      gerufen++
      const body = JSON.parse(String(init.body))
      check('Abfrage: Domain ohne www, DE, alle Plattformen, Tiefe 40', body[0].target === 'amoreal.de' && body[0].location_code === 2276 && body[0].platform === 'all' && body[0].depth === 40, body)
      return new Response(JSON.stringify({ tasks: [{ status_code: 40102 }] }), { status: 200 })
    }) as unknown as typeof fetch,
  })
  check('mit Zugang: genau ein Abruf, 40102 → nein', gerufen === 1 && mitNetz.google_ads_aktiv === 'nein', mitNetz)
}

// --- 4. Die Recherche prüft BEIDE Quellen für jeden Lead mit Website ------
{
  const r = lies('runner/linkedin/leadRecherche.mjs')
  check('Meta nicht mehr nur bei „stark"', !/stufe === 'stark' \? await pruefeMetaAds/.test(r))
  check('pruefeWerbung ruft Meta UND Google parallel', /Promise\.all\(\[\s*firma \? pruefeMetaAds[\s\S]{0,200}pruefeGoogleAds\(website\)/.test(r))
  check('auch eine offline-Seite wird auf Anzeigen geprüft', /const werbung = await pruefeWerbung\(browser, ersterKaputt\.url, firma\)/.test(r))
  check('passende Seite: Werbung für jede Stufe', /const werbung = passt\s*\n?\s*\? await pruefeWerbung\(browser, s\.endUrl/.test(r))
  check('Profil + Klasse hängen an jedem Destillat', (r.match(/mitProfil\(/g) ?? []).length >= 4)
  const i = lies('runner/index.mjs')
  check('Runner speichert Profile nach der Recherche', /speichereProfile\(\{ supabaseUrl: SUPABASE_URL/.test(i))
  check('Profil geht nicht in den Schreib-Agenten', /\['profil', 'klasse', 'klasse_grund'\]\.includes\(k\)/.test(i))
  check('Runner-Runde = App-Runde = 20', /const ERSTNACHRICHTEN_RUNDE = 20\n/.test(i) && ERSTNACHRICHTEN_RUNDE === 20)
  check('„noch 20" kommt über /runde/start an', /anzahl: Number\.isInteger\(koerper\?\.anzahl\)/.test(i))
  const m = lies('supabase/migrations/0092_lead_profil.sql')
  check('Migration 0092: profil, klasse, klasse_grund, profil_at', /add column if not exists profil jsonb/.test(m) && /klasse text check \(klasse in \('A', 'B', 'C'\)\)/.test(m) && /klasse_grund text/.test(m) && /profil_at timestamptz/.test(m))
}

// --- 5. Rechtsform, Register, Gründung ------------------------------------
{
  check('Rechtsform aus dem Firmennamen', rechtsformAus('Amoreal GmbH') === 'GmbH')
  check('GmbH & Co. KG vor GmbH', rechtsformAus('Muster Immobilien GmbH & Co. KG') === 'GmbH & Co. KG')
  check('UG (haftungsbeschränkt)', rechtsformAus('Neu Makler UG (haftungsbeschränkt)') === 'UG')
  check('e.K. aus dem Impressum-Kopf', rechtsformAus('Probe Immobilien', 'Impressum\nProbe Immobilien e.K.\nInhaberin: Petra Probe') === 'e.K.')
  check('Hoster weiter unten stellt nicht die Rechtsform', rechtsformAus('Tim Test Immobilien', 'Impressum\nTim Test Immobilien\nInhaber: Tim Test\n' + 'x '.repeat(600) + 'Hosting: Strato AG') === 'Einzelunternehmen')
  check('„ag" im Fließtext ist keine AG', rechtsformAus('Beispiel', 'Impressum\nwir sind jeden tag für sie da') === '')
  check('HRB aus dem Impressum', handelsregisterAus('Registergericht: Amtsgericht Hamburg\nRegisternummer: HRB 123456') === 'HRB 123456')

  const g1 = gruendungAusText(['Wir sind Ihr Makler seit 1998 in Hamburg. Seit 2019 Mitglied im IVD.'], JETZT)
  check('„seit": das früheste Jahr zählt', g1.jahr === 1998 && g1.quelle === 'seit', g1)
  const g2 = gruendungAusText(['Gegründet 2005 von Mara Beispiel. Seit 1998 in der Branche.'], JETZT)
  check('„gegründet" sticht „seit"', g2.jahr === 2005 && g2.quelle === 'gegruendet', g2)
  const g3 = gruendungAusText(['Über 25 Jahre Erfahrung im Immobilienmarkt'], JETZT)
  check('„über 25 Jahre" → 2001', g3.jahr === 2001 && g3.quelle === 'jahre-erfahrung', g3)
  const g4 = gruendungAusText(['© 2012–2026 Beispiel Immobilien'], JETZT)
  check('Copyright-Spanne als letzte Quelle', g4.jahr === 2012 && g4.quelle === 'copyright', g4)
  check('Zukunftsjahr zählt nicht', gruendungAusText(['seit 2031'], JETZT).jahr === null)
  check('nichts gefunden: null', gruendungAusText(['Willkommen'], JETZT).jahr === null)
}

// --- 6. Profil: Modell-Gründungsjahr nur mit wörtlichem Beleg -------------
{
  const d = { firma: 'Amoreal GmbH', website: 'https://amoreal.de/', rolle_impressum: 'gf', website_stufe: 'schwach', meta_ads_aktiv: 'nein', google_ads_aktiv: 'ja', google_ads_seit: '2026-05-07', google_ads_anzahl: 1, groesse: 'klein' }
  const ohneBeleg = baueProfil(d, { texte: ['Willkommen'], modellGruendung: { jahr: 2010, beleg: 'gegründet 2010' }, sichtbarerText: 'Willkommen' }, JETZT)
  check('Modell-Jahr ohne Beleg im Text fliegt raus', ohneBeleg.gruendungsjahr === null, ohneBeleg)
  const mitBeleg = baueProfil(d, { texte: ['Willkommen'], modellGruendung: { jahr: 2010, beleg: 'Unser Büro, eröffnet 2010' }, sichtbarerText: 'Willkommen. Unser Büro, eröffnet 2010, liegt …', teamPersonen: 6 }, JETZT)
  check('Modell-Jahr mit wörtlichem Beleg zählt', mitBeleg.gruendungsjahr === 2010 && mitBeleg.gruendung_quelle === 'befund' && mitBeleg.jahre_am_markt === 16, mitBeleg)
  check('Profil trägt alle Felder', mitBeleg.rechtsform === 'GmbH' && mitBeleg.gf === 'gf' && mitBeleg.google_ads_aktiv === 'ja' && mitBeleg.team_personen === 6 && mitBeleg.bilanz_hinweis === '', mitBeleg)
}

// --- 7. Klasse A/B/C (Kevins Vorgabe vom 17.09.) ---------------------------
{
  const basis = { gf: 'gf', rechtsform: 'GmbH', jahre_am_markt: 12, gruendungsjahr: 2014, team_personen: 6, groesse: 'klein', meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein', google_ads_seit: '' }
  const a = klasseFuer({ ...basis, google_ads_aktiv: 'ja', google_ads_seit: '2026-05-07', website_stufe: 'schwach' })
  check('A: Google-Anzeigen + GmbH + Jahre + Team + schwache Seite', a.klasse === 'A', a)
  check('A-Grund nennt die Anzeigen mit Monat', /Google-Ads seit 05\/2026/.test(a.grund) && /Seite schwach/.test(a.grund), a.grund)
  check('A auch mit Meta statt Google', klasseFuer({ ...basis, meta_ads_aktiv: 'ja', website_stufe: 'schwach' }).klasse === 'A')
  check('B: Anzeigen + ordentliche Seite', klasseFuer({ ...basis, google_ads_aktiv: 'ja', website_stufe: 'solide' }).klasse === 'B')
  check('B: solide Firma ohne Anzeigen', klasseFuer({ ...basis, website_stufe: 'schwach' }).klasse === 'B')
  check('A-Firma, aber Kontakt angestellt → B', klasseFuer({ ...basis, gf: 'angestellt', google_ads_aktiv: 'ja', website_stufe: 'schwach' }).klasse === 'B')
  const c1 = klasseFuer({ gf: 'gf', rechtsform: 'e.K.', jahre_am_markt: 8, team_personen: 1, meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein', website_stufe: 'schwach' })
  check('C: Einzelkämpfer ohne Anzeigen', c1.klasse === 'C' && /Einzelkämpfer/.test(c1.grund), c1)
  const c2 = klasseFuer({ gf: 'gf', rechtsform: 'GmbH', jahre_am_markt: 1, team_personen: 4, meta_ads_aktiv: 'nein', google_ads_aktiv: 'nein', website_stufe: 'solide' })
  check('C: neu am Markt, auch als GmbH mit Team', c2.klasse === 'C' && /Neu am Markt/.test(c2.grund), c2)
  check('C: nichts bekannt → unklar', klasseFuer({}).klasse === 'C' && klasseFuer({}).grund === 'Unklar')
  check('„unbekannt" bei Anzeigen zählt nicht als Anzeigen', klasseFuer({ ...basis, rechtsform: '', team_personen: null, google_ads_aktiv: 'unbekannt', website_stufe: 'schwach' }).klasse === 'C')
}

// --- 8. Reihenfolge: A, B, ungeprüft, C — in Runner und App gleich ---------
{
  for (const k of ['A', 'B', 'C', undefined] as const) {
    check(`klassenRang(${k}) gleich in Runner und App`, klassenRang(k) === klassenRangRunner(k))
  }
  const p = (id: string, klasse: Posten['klasse'], ts: string): Posten => ({ id, spur: 'followup', name: id, text: '', timestamp: ts, ...(klasse ? { klasse } : {}) })
  const geordnet = ordnePosten(
    { followup: [p('c-alt', 'C', '2026-09-01'), p('ohne', undefined, '2026-09-02'), p('b', 'B', '2026-09-03'), p('a-neu', 'A', '2026-09-20'), p('a-alt', 'A', '2026-09-05')] },
    JETZT,
  ).map((x) => x.id)
  check('ordnePosten: A (älteste zuerst), B, ungeprüft, C', JSON.stringify(geordnet) === JSON.stringify(['a-alt', 'a-neu', 'b', 'ohne', 'c-alt']), geordnet)

  const vor = (tage: number) => new Date(JETZT.getTime() - tage * 86_400_000).toISOString()
  const thread = (id: string, leadId: string | null): LinkedinThread =>
    ({
      id,
      brand_id: 'b',
      thread_key: id,
      contact_id: null,
      name: `Lead ${id}`,
      company: 'Makler',
      profile_url: '',
      preview: '',
      last_message_at: vor(5),
      last_from: 'me',
      unread: false,
      starred: false,
      followup_stage: 0,
      snoozed_until: null,
      status: 'active',
      first_seen_at: vor(30),
      last_synced_at: vor(0),
      loom_status: null,
      loom_erledigt_at: null,
      lead_id: leadId,
    }) as unknown as LinkedinThread
  const klassen = new Map([
    ['L-a', { klasse: 'A' as const, grund: 'Zahlt für Anzeigen …' }],
    ['L-c', { klasse: 'C' as const, grund: 'Einzelkämpfer' }],
  ])
  const quelle = followupPosten([thread('t1', 'L-c'), thread('t2', null), thread('t3', 'L-a')], JETZT, [], new Set(), klassen)
  check('followupPosten: A vorn, C hinten, Quelle schon sortiert (die Sales-Liste schneidet dort)', JSON.stringify(quelle.map((x) => x.id)) === JSON.stringify(['thread:t3', 'thread:t2', 'thread:t1']), quelle.map((x) => x.id))
  check('followupPosten: Grund reist mit', quelle[0]?.klasseGrund === 'Zahlt für Anzeigen …')
  const ohneKlassen = followupPosten([thread('t1', 'L-c'), thread('t2', null), thread('t3', 'L-a')], JETZT)
  check('ohne Klassen bleibt die alte Reihenfolge', JSON.stringify(ohneKlassen.map((x) => x.id)) === JSON.stringify(['thread:t1', 'thread:t2', 'thread:t3']), ohneKlassen.map((x) => x.id))
}

console.log(`\nverify-lead-profil: ${pass} ok, ${fail} fehlgeschlagen`)
if (fail) process.exit(1)
