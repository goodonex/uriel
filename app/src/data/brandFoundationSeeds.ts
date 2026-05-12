/**
 * Brand Foundation Seeds — pro Kunden-Brand der vollständige Building-Mode-Stand
 * (Business Model, Positioning, ICPs, Word Bank). Quelle:
 *  - Wertavio: Live-Seite https://wertavio.de + `2. Wertavio` Repo (Partner / FAQ / Founder)
 *  - Culturefit: Live-Seite https://culturefit.to + `4. Culture Fit/02_branding`
 *    Brand Guidelines v1.0 (April 2026)
 *
 * Diese Datei ist der „Single Source of Truth" für den Seed.
 * Wer Inhalte ändern will, fasst ausschließlich diese Datei an und erhöht die jeweilige `version`.
 */
import type { ICPPriority, Positioning } from '../types/db'

export interface BrandFoundationBusinessModel {
  who: string
  what: string
  how: string
  for_whom: string
  revenue: string
}

export interface BrandFoundationICP {
  name: string
  age_range: string
  location: string
  pain_points: string[]
  word_clusters: string[]
  priority: ICPPriority
  notes: string
}

export interface BrandFoundationWordBank {
  yes: { word: string; cluster?: string }[]
  no: { word: string; cluster?: string }[]
}

export interface BrandFoundationSeed {
  slug: string
  /** localStorage-Sentinel-Version. Hochzählen → Seed wird neu geschrieben. */
  version: number
  /** Default-Cluster für Word-Bank-Einträge ohne eigenen Cluster. */
  defaultWordCluster: string
  positioning_statement: string
  tone_of_voice: string
  business_model: BrandFoundationBusinessModel
  icps: BrandFoundationICP[]
  word_bank: BrandFoundationWordBank
}

/** Re-Export für `usePositioning`-Konsumenten (Positioning.business_model JSON). */
export function toPositioningBusinessModel(
  bm: BrandFoundationBusinessModel,
): NonNullable<Positioning['business_model']> {
  return { ...bm }
}

/* ───────────────────────────── WERTAVIO ───────────────────────────── */

export const WERTAVIO_SEED: BrandFoundationSeed = {
  slug: 'wertavio',
  version: 3,
  defaultWordCluster: 'Wertavio',
  positioning_statement:
    'Wertavio matcht Immobilieneigentümer in 48h mit genau einem geprüften Spezialisten aus einem kuratierten Makler-Netzwerk — ohne Portal, ohne Streuung, ohne Kosten für den Eigentümer. Eine klare Zuordnung statt Vergleichsmarathon.',
  tone_of_voice:
    'Vertrauensvoll, klar, persönlich. Kein Immobilien-Slang, keine Buzzwords. Kurze Sätze, konkrete Aussagen. Wir nehmen dem Eigentümer die Unsicherheit. Sprache aus Sicht eines Maklers, der weiß, was Eigentümer wirklich brauchen.',
  business_model: {
    who:
      'Wertavio. Gegründet von Kevin Herrmann (zuvor selbst aktiver Immobilienmakler). Schlankes Setup, kuratiertes Makler-Netzwerk in Deutschland. Aufnahme nur nach Prüfung (IHK §34c, IVD, DEKRA, TÜV) + jährliche Re-Bewertung. 15+ Jahre Markterfahrung im Team.',
    what:
      'Kostenloses Makler-Matching für Immobilieneigentümer (Haus, Wohnung, Grundstück). Ein geprüfter Spezialist statt Streuung an viele Büros über Portale. Eigentümer beschreiben Immobilie + Ziel → ein Match in 48 h. Für Makler-Partner: 1 Lead = 1 Empfänger, keine Parallelvergabe.',
    how:
      '3-Schritt-Anfrage (Immobilientyp + PLZ + Ziel, < 3 Min.). Algorithmischer Match plus persönliche Kuration. Genau ein Makler meldet sich direkt — kein Postfach-Spam. Netzwerk-Aufnahme ausschließlich nach persönlicher Prüfung (Sachkundenachweis §34c GewO als Mindestvoraussetzung). Aus Maklerperspektive gebaut.',
    for_whom:
      'Eigentümer: Verkäufer von Haus / ETW / Grundstück, 45–70, Schwerpunkt urbane Ballungsräume (Hamburg, München, Berlin, Köln), die das eigene Heim oder die ETW verkaufen wollen und nach einem vertrauenswürdigen Makler suchen. \nMakler-Partner: regional spezialisierte Makler (30–52), die eine planbare, exklusive Lead-Quelle wollen statt Portal-Konkurrenz.',
    revenue:
      'Eigentümer: 0 € — kein Honorar, weder vor noch nach Vermittlung. Makler-Partner: 750 € / 30 Tage Abo + einmalig 500–1.000 € Setup. Keine umsatzabhängige Provision, keine zweite Abschlussrechnung außerhalb des Abos.',
  },
  icps: [
    {
      name: 'Urban Eigentümer',
      age_range: '45–70',
      location: 'Deutschland · Schwerpunkt Ballungsräume (Hamburg, München, Berlin, Köln)',
      pain_points: [
        'Welchem Makler kann ich mein wichtigstes Asset wirklich anvertrauen?',
        'Portale streuen die Anfrage an 5–10 Makler — kein Überblick, kein klarer nächster Schritt',
        'Druck statt klarer Zeitplan: schneller Verkauf vor Zielpreis-Klarheit',
        'Sorge, durch falschen Makler Geld unter Marktwert liegen zu lassen',
      ],
      word_clusters: ['Vertrauen', 'Spezialist', 'persönlich'],
      priority: 1,
      notes:
        'Verkauft typischerweise das Eigenheim oder die ETW als ersten Verkauf — emotional aufgeladen, sucht Sicherheit und einen Ansprechpartner, keinen Algorithmus. Reagiert auf Trust-Siegel (IVD, DEKRA, IHK §34c) und auf die Founder-Story (Makler-Gründer).',
    },
    {
      name: 'Wachstums-Makler',
      age_range: '30–52',
      location: 'Deutschland · regional spezialisiert auf 1–2 PLZ-Cluster',
      pain_points: [
        'Keine verlässliche, exklusive Lead-Quelle — Portal-Leads gehen an 5+ Konkurrenten gleichzeitig',
        'Lead-Qualität schwankt stark — keine planbare Pipeline',
        'Kein planbares Akquise-Budget für Wachstum',
        'Vergleich mit Portalen wirkt überteuert ohne Exklusivität',
      ],
      word_clusters: ['exklusiv', 'planbar', 'Pipeline'],
      priority: 2,
      notes:
        'Hat IHK §34c, Marktkenntnis, aber kein Inhouse-Sales-Team. Zahlt lieber planbar (750 € Abo) als prozentual auf Abschluss. Reagiert stark auf „1 Lead = 1 Makler" und „keine Erfolgsprovision an Wertavio".',
    },
  ],
  word_bank: {
    yes: [
      { word: 'Vertrauen' },
      { word: 'passend' },
      { word: 'geprüft' },
      { word: 'kostenlos' },
      { word: 'Spezialist' },
      { word: 'kuratiert' },
      { word: 'exklusiv' },
      { word: 'persönlich' },
      { word: '48h Rückmeldung' },
      { word: 'Ein Makler' },
      { word: 'Match' },
      { word: 'IVD-Mitglied' },
      { word: 'DEKRA-geprüft' },
      { word: 'IHK §34c' },
      { word: 'planbar' },
      { word: 'Pipeline' },
      { word: 'Anforderungsprofil' },
      { word: 'klare Zuordnung' },
    ],
    no: [
      { word: 'Masse' },
      { word: 'Portal' },
      { word: 'Datenbank' },
      { word: 'irgendein Makler' },
      { word: 'günstig' },
      { word: 'revolutionär' },
      { word: 'Spam' },
      { word: 'Schaufenster' },
      { word: 'Vergleichsmarathon' },
      { word: 'schnell-schnell' },
      { word: 'Lead-Generator' },
      { word: 'Algorithmus-Magie' },
      { word: 'Provisions-Battle' },
    ],
  },
}

/* ───────────────────────────── CULTUREFIT ───────────────────────────── */

export const CULTUREFIT_SEED: BrandFoundationSeed = {
  slug: 'culturefit',
  version: 1,
  defaultWordCluster: 'Culturefit',
  positioning_statement:
    'CultureFit ist kein ATS, keine Jobbörse, kein klassisches Assessment. Predictive Culture Fit Infrastructure — das einzige System, das in 20 Minuten vorhersagt, wer wirklich passt, bevor er eingestellt wird. CV zeigt Vergangenheit, CultureFit zeigt Zukunft.',
  tone_of_voice:
    'Der präzise Analyst. Faktenbasiert, direkt, ohne Consulting-Sprache. Zahlen statt Adjektive — „46% scheitern", nicht „viele scheitern". Aktiv, Du-Ansprache, max. 12 Wörter pro Satz. Problem vor Lösung. Keine leeren Adjektive, keine Buzzwords. Vier Markenwerte: präzise, direkt, vorhersagend, menschlich.',
  business_model: {
    who:
      'CultureFit. Predictive Culture Fit Infrastructure aus dem Hause Herrmann & Co. Gegründet von Kevin Herrmann (April 2026, DACH). Solo-Setup mit Pilotkunden. DSGVO-nativ, Server in Deutschland, AVV für jeden Unternehmenskunden. Score ist Entscheidungshilfe, keine automatisierte Entscheidung (Art. 22 DSGVO).',
    what:
      'Bespoke Kultur-Assessments für Hiring. 12-Fragen-Kulturdefinition → KI generiert verhaltensbasierten Test → 15-Min-Link an Kandidaten (kein Login) → Match-Score pro Kulturdimension mit automatischer Red-Flag-Erkennung. Kein Persönlichkeitstest (kein Myers-Briggs / DISC), sondern Verhalten in konkreten Situationen.',
    how:
      'Self-Service in 20 Minuten ohne Setup-Call. KI baut den Test bespoke pro Unternehmenskultur — nicht aus einem generischen Standard-Pool. Kandidat: 15 Min. Bearbeitung, 70 %+ Completion Rate. Recruiter-Workflow als White-Label-Option. Pilot-Daten (Stand 04/2026): erste Wiederverlängerung bei Pilotkunden.',
    for_whom:
      'Primär (Multiplikator): Recruiting-Agenturen / Head of Delivery — DACH. \nSekundär: Head of Talent / People & Culture Leads (DACH-Mittelstand & Scale-ups, 50–500 MA). \nTertiär: Startup-Gründer Pre-Seed bis Series A für die ersten 10 Hires.',
    revenue:
      'SaaS-Abo, monatlich kündbar. Vier Tiers: Starter (100 Assessments, 1 Seat, E-Mail-Support), Growth (500 Assessments, 3 Seats, Chat, Export), Scale (2.000 Assessments, 10 Seats, ATS-Integration, White-Label), Enterprise (unbegrenzte Assessments + Seats, dedizierter Support, On-site Workshops). Für Recruiter zusätzlich Revenue Share oder Flat Fee möglich.',
  },
  icps: [
    {
      name: 'Recruiting-Agentur · Head of Delivery',
      age_range: '32–48',
      location: 'DACH',
      pain_points: [
        'Placements floppen nach 3–6 Monaten → Rückläufer kosten Garantie-Ersatz und Reputation',
        'Kulturpassung lässt sich aus dem Bauch nicht messen — also auch nicht verkaufen',
        'Kunden-Beschwerde „passt nicht ins Team" ohne Datengrundlage gegen-argumentierbar',
        'Kein klares Differenzierungsmerkmal gegenüber anderen Personalberatungen',
      ],
      word_clusters: ['Match-Score', 'White-Label', 'Folgeauftrag'],
      priority: 1,
      notes:
        'Multiplikator-ICP. Will White-Label-Lösung mit eigenem Branding. Revenue Share oder Flat Fee, KPIs: Folgeaufträge & Churn-Rate. Kauft, wenn Score in den Pitch passt und Kunden-Beschwerden datenbasiert kontert werden.',
    },
    {
      name: 'Head of Talent / People & Culture',
      age_range: '30–45',
      location: 'DACH-Mittelstand & Scale-ups (50–500 MA)',
      pain_points: [
        '46 % Fehlbesetzungsquote — kein Werkzeug, das vor dem Hire entscheidet',
        '≈ 50.000 € Kosten pro Fehlbesetzung — kein C-Level-Pitch ohne Zahlen',
        'Persönlichkeitstests (Myers-Briggs / DISC) messen Typen, nicht Verhalten',
        'Hiring Manager treffen Bauchentscheidungen, HR kann nicht widersprechen',
      ],
      word_clusters: ['46%', 'Score', 'DSGVO', 'Verhalten'],
      priority: 2,
      notes:
        'Sucht harte Daten, um Hiring Manager und C-Level zu überzeugen. DSGVO ist Pflicht, Server in Deutschland ein KO-Kriterium. Wert auf Self-Service ohne Sales-Call — entscheidet selbst.',
    },
    {
      name: 'Startup-Gründer · Pre-Seed bis Series A',
      age_range: '26–38',
      location: 'DACH-Tech-Hubs (Berlin, München, Hamburg, Zürich)',
      pain_points: [
        'Erste 10 Hires entscheiden die nächsten 5 Jahre Kultur',
        'Keine Zeit, kein Budget für Recruiting-Beratung',
        'Kein People-Lead, Gründer machen Hiring nebenbei',
        'Speed-Druck trifft auf Angst vor Wrong-Hire-Kosten',
      ],
      word_clusters: ['Speed', 'Self-Service', 'erste 10 Hires'],
      priority: 3,
      notes:
        'Liebt Self-Service, will sofort starten. Kein Setup-Call akzeptabel. Zahlt monatlich, kündbar. Reagiert auf „Stop guessing, start predicting" und „CV zeigt Vergangenheit, CultureFit zeigt Zukunft".',
    },
  ],
  word_bank: {
    yes: [
      { word: 'Predictive', cluster: 'Brand' },
      { word: 'Culture Fit', cluster: 'Brand' },
      { word: 'Match-Score', cluster: 'Brand' },
      { word: 'vorhersagen', cluster: 'Brand' },
      { word: 'verhaltensbasiert', cluster: 'Method' },
      { word: 'Red Flag', cluster: 'Method' },
      { word: 'Score', cluster: 'Method' },
      { word: 'bespoke', cluster: 'Method' },
      { word: 'Verhalten', cluster: 'Method' },
      { word: 'präzise', cluster: 'Values' },
      { word: 'direkt', cluster: 'Values' },
      { word: 'vorhersagend', cluster: 'Values' },
      { word: 'menschlich', cluster: 'Values' },
      { word: 'Daten', cluster: 'Proof' },
      { word: 'DSGVO-nativ', cluster: 'Proof' },
      { word: '46%', cluster: 'Proof' },
      { word: '50.000 €', cluster: 'Proof' },
      { word: '18 Monate', cluster: 'Proof' },
      { word: 'Stop guessing', cluster: 'Hook' },
      { word: 'Start predicting', cluster: 'Hook' },
    ],
    no: [
      { word: 'Persönlichkeitstest', cluster: 'Anti' },
      { word: 'Myers-Briggs', cluster: 'Anti' },
      { word: 'DISC', cluster: 'Anti' },
      { word: 'Big Five', cluster: 'Anti' },
      { word: 'ganzheitlich', cluster: 'Buzzword' },
      { word: 'innovativ', cluster: 'Buzzword' },
      { word: 'KI-gestützt', cluster: 'Buzzword' },
      { word: 'revolutionär', cluster: 'Buzzword' },
      { word: 'Synergien', cluster: 'Buzzword' },
      { word: 'Hiring-Journey', cluster: 'Buzzword' },
      { word: 'holistisch', cluster: 'Buzzword' },
      { word: 'Lösung', cluster: 'Buzzword' },
      { word: 'optimal', cluster: 'Buzzword' },
      { word: 'modernes Recruiting', cluster: 'Buzzword' },
      { word: 'Bauchgefühl', cluster: 'Anti' },
      { word: 'Setup-Call', cluster: 'Anti' },
    ],
  },
}

/** Reihenfolge bestimmt den Seed-Loop in `useBrands`. */
export const BRAND_FOUNDATION_SEEDS: readonly BrandFoundationSeed[] = [
  WERTAVIO_SEED,
  CULTUREFIT_SEED,
]
