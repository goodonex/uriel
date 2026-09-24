/**
 * scripts/verify-lead-bewertung.ts — Lead-Bewertung Stufe 1 (24.09.2026) an
 * den Fällen aus dem ersten Probelauf.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/verify-lead-bewertung.ts
 */
// @ts-expect-error — .mjs ohne Typen
import { firmaAusHeadline, kandidatenAus, ortAus, marktFuer, impressumLink } from '../runner/linkedin/grundprofil.mjs'
// @ts-expect-error — .mjs ohne Typen
import { bewerte } from '../runner/linkedin/leadProfil.mjs'
// @ts-expect-error — .mjs ohne Typen
import { brauchtNeueFassung, naechsteKontakte } from '../runner/linkedin/bewertungLauf.mjs'

let fehler = 0
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) fehler++
}
const jetzt = new Date('2026-09-24T12:00:00Z')

/* ── Firma aus der Headline ─────────────────────────────────────────── */
check('„Geschäftsführer bei GED Wohnbau"', firmaAusHeadline('Geschäftsführer bei GED Wohnbau') === 'GED Wohnbau', firmaAusHeadline('Geschäftsführer bei GED Wohnbau'))
check('„… bei HAKO Immobilien GmbH // Co-Founder …" endet vor den Strichen', firmaAusHeadline('Geschäftsführender Gesellschafter bei HAKO Immobilien GmbH // Co-Founder XY') === 'HAKO Immobilien GmbH')
check('Segment mit Firmenzeichen, Rolle entfernt', firmaAusHeadline('Geschäftsführer VANDERBERG Immobilien | Gründer FollowerX') === 'VANDERBERG Immobilien', firmaAusHeadline('Geschäftsführer VANDERBERG Immobilien | Gründer FollowerX'))
check('Spruch ohne Firma bleibt leer', firmaAusHeadline('be great at what you do') === '')
check('Werbesatz ist keine Firma (Wackwitz, 24.09.)', firmaAusHeadline('Interessierst du dich für Immobilien? Gerne tausche ich mich mit dir darüber aus!') === '')
check('Satzfetzen ist keine Firma (Botti)', firmaAusHeadline('Berater für Eigentümer-Leadgenerierung | Mehr exklusive Verkaufsaufträge durch Meta Ads als Immobilienmakler') === '')
check('Titel ist keine Firma (Körting)', firmaAusHeadline('Diplom-Immobilienökonom (ADI) Vermittlung von Residential Real Estate und Commercial Real Estate, gerne auch Off-Market.') === '')
check('„CEO Wang Immobilien (gegr. 1996)" → Wang Immobilien', firmaAusHeadline('CEO Wang Immobilien (gegr. 1996) | Geprüfte Immobilienmaklerin § 34c GewO') === 'Wang Immobilien', firmaAusHeadline('CEO Wang Immobilien (gegr. 1996) | Geprüfte Immobilienmaklerin § 34c GewO'))

/* ── Kandidaten ──────────────────────────────────────────────────────── */
{
  const k = kandidatenAus(
    [
      { url: 'https://www.linkedin.com/in/x', domain: 'linkedin.com', titel: '', text: '' },
      { url: 'https://www.immobilienscout24.de/x', domain: 'immobilienscout24.de', titel: '', text: '' },
      { url: 'https://hako-immobilien.de/', domain: 'hako-immobilien.de', titel: 'HAKO', text: '' },
      { url: 'https://andere.de/', domain: 'andere.de', titel: '', text: '' },
    ],
    { name: 'Kilian Hanika', firma: 'HAKO Immobilien GmbH' },
  )
  check('Portale fallen raus', !k.some((x: any) => /linkedin|immobilienscout/.test(x.domain)), k)
  check('Firmen-Domain passt stark', k.find((x: any) => x.domain === 'hako-immobilien.de')?.passt >= 2)
  check('fremde Domain passt nicht', k.find((x: any) => x.domain === 'andere.de')?.passt === 0)
}

/* ── Impressum, Ort, Markt ───────────────────────────────────────────── */
check('Impressum-Link gefunden', impressumLink('<a href="/impressum">Impressum</a>', 'https://x.de/') === 'https://x.de/impressum')
check('„80331 München"', ortAus('Musterstr. 1\n80331 München\nTel').ort === 'München', ortAus('Musterstr. 1\n80331 München\nTel'))
check('Haar bei München zählt über die PLZ zur Metropole', marktFuer('Haar', '85540') === 'metropole')
check('Leipzig ist Großstadt, keine Metropole', marktFuer('Leipzig', '04109') === 'grossstadt')
check('Kleinstadt', marktFuer('Wittlich', '54516') === 'klein-mittel')
check('ohne Ort unbekannt', marktFuer('', '') === 'unbekannt')

/* ── Punkte und Topf ─────────────────────────────────────────────────── */
{
  const pecuria = bewerte({ website: 'https://pecuria.de/', erreichbar: 'ja', rechtsform: 'GmbH', handelsregister: 'HRB 226461', markt: 'metropole', gf: 'gf', meta_ads_aktiv: 'ja', google_ads_aktiv: 'nein' }, jetzt)
  check('Pecuria: Meta, GmbH, Hamburg, selbst GF → jetzt angehen', pecuria.topf === 'jetzt' && pecuria.punkte >= 55, pecuria)
  const ged = bewerte({ website: 'https://ged-wohnbau.at/', erreichbar: 'ja', rechtsform: 'GmbH', markt: 'metropole', gf: 'unklar', google_ads_aktiv: 'ja', google_ads_seit: '2026-03-01', meta_ads_aktiv: 'nein' }, jetzt)
  check('GED Wohnbau: Google seit März → jetzt', ged.topf === 'jetzt', ged)
  const lang = bewerte({ google_ads_aktiv: 'ja', google_ads_seit: '2025-01-01', google_ads_anzahl: 40, website: 'x', erreichbar: 'ja' }, jetzt)
  const kurz = bewerte({ google_ads_aktiv: 'ja', google_ads_seit: '2026-09-01', google_ads_anzahl: 2, website: 'x', erreichbar: 'ja' }, jetzt)
  check('lange und viele Google-Anzeigen zählen mehr', lang.punkte > kurz.punkte, [lang.punkte, kurz.punkte])
  const stark = bewerte({ website: 'x', erreichbar: 'ja', wow_potenzial: 'nein', google_ads_aktiv: 'ja', meta_ads_aktiv: 'ja', rechtsform: 'GmbH', markt: 'metropole', gf: 'gf' }, jetzt)
  check('Starke Seite bleibt eigener Topf, auch mit vielen Punkten (Amoreal)', stark.topf === 'starke-seite', stark)
  const schwachMitAds = bewerte({ website: 'x', erreichbar: 'ja', wow_potenzial: 'ja', website_stufe: 'schwach', google_ads_aktiv: 'ja', rechtsform: 'GmbH', gf: 'gf', markt: 'grossstadt' }, jetzt)
  check('Anzeigen + schwache Seite → jetzt angehen, weit oben (Kevins Wunschkunde)', schwachMitAds.topf === 'jetzt' && schwachMitAds.punkte >= 65, schwachMitAds)
  const nichtGefunden = bewerte({ website: '', google_ads_aktiv: 'nein', meta_ads_aktiv: 'nein', linkedin_status: 'offen', eingeladen_at: '2026-09-20' }, jetzt)
  check('Nicht gefunden ist nicht inaktiv (HAKO-Lehre)', nichtGefunden.topf !== 'vermutlich-inaktiv', nichtGefunden)
  const alt = bewerte({ website: '', google_ads_aktiv: 'nein', meta_ads_aktiv: 'nein', linkedin_status: 'offen', eingeladen_at: '2026-06-01' }, jetzt)
  check('Nie angenommen, nichts zu finden, lange her → vermutlich inaktiv', alt.topf === 'vermutlich-inaktiv' && alt.klasse === 'C', alt)
  const tot = bewerte({ website: 'https://x.de/', erreichbar: 'offline', google_ads_aktiv: 'nein', meta_ads_aktiv: 'nein' }, jetzt)
  check('Seite lädt nicht, keine Anzeigen, keine Firma → vermutlich inaktiv', tot.topf === 'vermutlich-inaktiv', tot)
  const totAberWerbung = bewerte({ website: 'https://x.de/', erreichbar: 'offline', google_ads_aktiv: 'ja' }, jetzt)
  check('Seite kaputt, aber Anzeigen laufen → NICHT inaktiv (teuerster Befund)', totAberWerbung.topf !== 'vermutlich-inaktiv', totAberWerbung)
  check('Punkte bleiben zwischen 0 und 100', [pecuria, ged, lang, stark, schwachMitAds, alt].every((b: any) => b.punkte >= 0 && b.punkte <= 100))
}

/* ── Wer ist dran ────────────────────────────────────────────────────── */
{
  const netz = [
    { lead_id: 'a', status: 'offen', eingeladen_at: '2026-09-22' },
    { lead_id: 'b', status: 'angenommen', angenommen_at: '2026-09-01' },
    { lead_id: 'c', status: 'angenommen', angenommen_at: '2026-09-20' },
    { lead_id: 'd', status: 'angenommen', angenommen_at: '2026-09-23' },
    { lead_id: null, status: 'offen' },
  ]
  const dran = naechsteKontakte(netz, ['d'], 10).map((n: any) => n.lead_id)
  check('Angenommene zuerst, die Jüngsten vorn, Bewertete und Leads ohne Zeile raus', JSON.stringify(dran) === JSON.stringify(['c', 'b', 'a']), dran)
}

check('alte Fassung ohne Seite wird neu bewertet', brauchtNeueFassung({ fassung: null, website: '', stufe2: null }))
check('alte Fassung MIT Seite bleibt', !brauchtNeueFassung({ fassung: null, website: 'https://x.de/', stufe2: null }))
check('Stufe 2 wird nie überschrieben', !brauchtNeueFassung({ fassung: 1, website: '', stufe2: '2026-09-24' }))
check('ältere Recherche-Profile (nur „stand") werden nie überschrieben', !brauchtNeueFassung({ fassung: null, website: '', stufe2: null, stand: '2026-09-23' }))

console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen` : '\nAlles grün.')
process.exit(fehler ? 1 : 0)
