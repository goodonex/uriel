import type { BusinessModelDoc, ICP, Positioning, WordBankEntry } from '../types/db'

export interface BrandTemplate {
  id: string
  name: string
  industry: string
  description: string
  positioning: Pick<Positioning, 'statement' | 'tone_of_voice'>
  business_model: Pick<
    BusinessModelDoc,
    'who' | 'what' | 'how' | 'for_whom' | 'revenue'
  >
  icps: Array<Pick<ICP, 'name' | 'age_range' | 'location' | 'pain_points' | 'priority' | 'notes'>>
  word_bank: Array<Pick<WordBankEntry, 'word' | 'type' | 'cluster'>>
}

export const BRAND_TEMPLATES: BrandTemplate[] = [
  {
    id: 'real-estate-agent',
    name: 'Immobilienmakler',
    industry: 'Immobilien · Lokal',
    description:
      'Etablierter Makler in DACH-Region. Premium-Positionierung gegen reine Discount-Anbieter, Fokus auf Vertrauen und Beratung.',
    positioning: {
      statement:
        'Für Eigentümer:innen in [Region], die ihre Immobilie ohne Stress und ohne Wertverlust verkaufen wollen — mit einem Makler, der wirklich beratet statt nur online stellt.',
      tone_of_voice:
        '• Ehrlich und direkt, nie übertrieben\n• Erklärend statt belehrend — Eigentümer:innen sind keine Anfänger\n• Persönlich, mit Region und Erfahrung verankert\n• Souverän, nie aggressiv im Akquise-Modus\n• Bildhaft, mit konkreten Zahlen statt Floskeln',
    },
    business_model: {
      who: 'Lokal verankertes Makler-Büro mit Fokus auf Beratung statt Volume. Klassisch ausgebildet, mit echter Marktkenntnis der Region.',
      what: 'Vermarktung von Eigentumswohnungen und Häusern: Wertgutachten, Profi-Fotos, Inserate, Käuferqualifizierung, Notartermin-Begleitung.',
      how: '• Erstgespräch beim Eigentümer vor Ort\n• Wertindikation auf Basis vergleichbarer Verkäufe\n• Vermarktung über Plattformen + eigene Käufer-Liste\n• Persönliche Besichtigungen, kein Massenmarkt',
      for_whom:
        'Privateigentümer:innen 45–70, oft anlässlich Erbe, Umzug oder Lebensphase-Wechsel. Premium-Segment, Region [Stadt/Umland].',
      revenue:
        'Provision (Käufer + Verkäufer), in DACH meist 3,57 % inkl. MwSt. pro Partei. Zusatzleistungen über Bewertung oder Home-Staging optional.',
    },
    icps: [
      {
        name: 'Erbe verkauft Elternhaus',
        age_range: '45–65',
        location: 'Stadt + Umland',
        priority: 1,
        pain_points: [
          'Emotionale Belastung — möchte Sache zügig hinter sich bringen',
          'Hat null Erfahrung mit Immobilienverkauf',
          'Angst vor falschem Preis (zu niedrig = Verlust, zu hoch = ewig Stillstand)',
          'Zeitknappheit durch eigenen Beruf / Familie',
          'Wünscht sich klare Roadmap statt Verkaufs-Geschwafel',
        ],
        notes:
          'Wichtigster Trigger: Vertrauen + Pragmatismus. Termin vor Ort wirkt mehr als jede Online-Bewertung. Frage nach „Notar-Begleitung" macht Differenz.',
      },
      {
        name: 'Umzug aus beruflichen Gründen',
        age_range: '35–55',
        location: 'Aktuell in Region · Umzug binnen 6 Monaten',
        priority: 2,
        pain_points: [
          'Fester Zeitrahmen, will nicht in Doppel-Miete',
          'Will Wert maximieren, aber hat keine Bandbreite für Eigenvermarktung',
          'Pendelt zwischen alter und neuer Stadt, schwer erreichbar',
          'Skepsis gegenüber „Schnellverkauf"-Versprechen',
        ],
        notes:
          'Hauptargument: Verlässlichkeit + Erreichbarkeit. Wir-managen-das-Mentalität ist hier entscheidender als Preis-Maximum.',
      },
      {
        name: 'Anlageobjekt-Verkäufer:in',
        age_range: '55–75',
        location: 'Stadt + Umland · oft Eigentümer mehrerer Objekte',
        priority: 3,
        pain_points: [
          'Steueroptimierung: Verkauf nach Spekulationsfrist',
          'Will diskret verkaufen — keine reißerische Plattform-Anzeige',
          'Sucht qualifizierte Käufer (Investoren, nicht Selbstnutzer)',
          'Bewertet Makler scharf nach Off-Market-Netzwerk',
        ],
        notes:
          'Off-Market-Käufer-Netzwerk und Diskretion sind hier Pflicht. Standard-Plattform-Listing wirkt unprofessionell.',
      },
    ],
    word_bank: [
      { word: 'persönlich beraten', type: 'yes', cluster: 'Verkaufsansatz' },
      { word: 'fairer Verkaufspreis', type: 'yes', cluster: 'Verkaufsansatz' },
      { word: 'klare Zahlen', type: 'yes', cluster: 'Sprache' },
      { word: 'Bewertung vor Ort', type: 'yes', cluster: 'Service' },
      { word: 'diskret', type: 'yes', cluster: 'Service' },
      { word: 'Notar-Begleitung', type: 'yes', cluster: 'Service' },
      { word: 'Käuferqualifizierung', type: 'yes', cluster: 'Service' },
      { word: 'regional verankert', type: 'yes', cluster: 'Marke' },
      { word: 'unschlagbarer Preis', type: 'no', cluster: 'Marketing-Floskeln' },
      { word: 'Premium-Lifestyle', type: 'no', cluster: 'Marketing-Floskeln' },
      { word: 'einmalige Chance', type: 'no', cluster: 'Marketing-Floskeln' },
      { word: 'Discount', type: 'no', cluster: 'Positionierung' },
      { word: 'Massenmakler', type: 'no', cluster: 'Positionierung' },
    ],
  },
]

export function findTemplate(id: string): BrandTemplate | null {
  return BRAND_TEMPLATES.find((t) => t.id === id) ?? null
}
