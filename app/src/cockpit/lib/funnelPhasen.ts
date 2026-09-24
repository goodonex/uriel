/**
 * Der Phasen-Ring (20.09.2026, Kevins Wort: „ich will einfach sehen, wie viele
 * Leute wo in welcher Stage sind").
 *
 * **Hier wird nichts gezählt.** Die Phase ist eine reine Zusammenfassung der
 * Karten aus `funnelKarten.ts` — sie summiert deren `bestand` und erfindet
 * keinen zweiten Weg zu derselben Zahl. Das ist die Bedingung, unter der ein
 * zweites Bild derselben Daten überhaupt danebenstehen darf: Weil jeder Lead
 * auf genau einer Karte liegt (die Invariante von `funnelZuordnung`) und jede
 * Karte in genau einer Phase, liegt jeder Lead auch in genau einer Phase — und
 * die Summe der Ringstücke IST der Bestand. Wer hier anfängt, Leads erneut
 * durchzugehen, baut den 78-Erstnachrichten-Fehler vom 17.08. ein zweites Mal
 * nach, nur runder.
 *
 * **Die Reihenfolge ist geerbt, nicht erfunden.** Die Phasen laufen in der
 * Reihenfolge von `FUNNEL_BAUPLAN`; dessen Ordnung ist Kevins Diktat vom
 * 18.08. und wird hier nicht umsortiert, nur weil ein Kreis anders aussähe.
 *
 * **„Aussortiert" ist kein Funnel-Schritt**, sondern die Gegenprobe zum Filter
 * (die Lehre vom 19.08.: lieber sichtbar als stiller Abzug). Die Phase trägt
 * deshalb `imFunnel: false`, steht grau statt in der Salbei-Rampe und am Ende
 * des Rings — und der Ring kann sie ausblenden, ohne dass eine Zahl verschwindet.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-funnel-phasen.ts`.
 */
import type { FunnelKarte, FunnelKartenId } from './funnelKarten'

export type PhasenId =
  | 'anbahnung'
  | 'im_gespraech'
  | 'nachfassen'
  | 'andere_wege'
  | 'ruht'
  | 'kunde'
  | 'aussortiert'

interface PhasenPlan {
  id: PhasenId
  titel: string
  /** Ein Halbsatz für den Tooltip — was diese Phase über die Leute sagt. */
  bedeutung: string
  karten: readonly FunnelKartenId[]
  /**
   * Gehört die Phase in den Funnel? `false` nur bei „Aussortiert" — die Leute
   * darin sind keine Stufe, sondern der Rest, der durch den Filter fiel.
   */
  imFunnel: boolean
  /**
   * Die Farbe aus der Salbei-Rampe. Eine Hue, monoton heller Richtung Kunde —
   * die Stufen sind geordnet, nicht verschieden, und verdienen deshalb keine
   * sechs Farben. Geprüft mit dem Palette-Validator (ordinal, dark, Fläche
   * `--ck-panel`): monotone Helligkeit, Abstände ≥ 0.06, Hue-Spanne 5°, dunkelstes
   * Stück 3.7:1 gegen die Fläche.
   */
  farbe: string
}

/**
 * Die sieben Phasen. Jede Karten-Kennung aus `FUNNEL_BAUPLAN` steht hier genau
 * einmal — `verify-funnel-phasen.ts` hält das fest, damit eine neue Karte nicht
 * lautlos aus dem Ring fällt.
 */
export const PHASEN_PLAN: readonly PhasenPlan[] = [
  {
    id: 'anbahnung',
    titel: 'Anbahnung',
    bedeutung: 'Anfrage läuft oder Erstnachricht steht aus',
    karten: ['anfrage_offen', 'erstnachricht_faellig'],
    imFunnel: true,
    farbe: '#5d7f51',
  },
  {
    id: 'im_gespraech',
    titel: 'Im Gespräch',
    bedeutung: 'Die Person hat geantwortet — du bist am Zug',
    karten: ['antwort_da', 'loom_offen'],
    imFunnel: true,
    farbe: '#749468',
  },
  {
    id: 'nachfassen',
    titel: 'Nachfassen',
    bedeutung: 'Geschrieben, noch keine Antwort — die Follow-ups laufen',
    karten: ['followup_0', 'followup_1', 'followup_2', 'wartet_auf_antwort'],
    imFunnel: true,
    farbe: '#8caa7e',
  },
  {
    id: 'andere_wege',
    titel: 'Andere Wege',
    bedeutung: 'LinkedIn ist durch — Instagram, Analyse, E-Mail, Postkarte, Anruf',
    karten: [
      'instagram_faellig',
      'pdf_faellig',
      'postkarte_laut',
      'anruf_laut',
      'email_faellig',
      'postkarte_still',
      'anruf_still',
    ],
    imFunnel: true,
    farbe: '#a3bf94',
  },
  {
    id: 'ruht',
    titel: 'Ruht',
    bedeutung: 'Wiedervorlage gesetzt oder die Kadenz ist durch',
    karten: ['wiedervorlage', 'ruht'],
    imFunnel: true,
    farbe: '#bad5aa',
  },
  {
    id: 'kunde',
    titel: 'Kunde',
    bedeutung: 'Geschlossen',
    karten: ['kunde'],
    imFunnel: true,
    farbe: '#d1eac0',
  },
  {
    id: 'aussortiert',
    titel: 'Aussortiert',
    bedeutung: 'Nicht in der Zielgruppe oder von dir disqualifiziert',
    karten: ['disqualifiziert', 'ausserhalb'],
    imFunnel: false,
    farbe: '#78857f',
  },
]

export interface Phase {
  id: PhasenId
  titel: string
  bedeutung: string
  imFunnel: boolean
  farbe: string
  /** Wie viele Menschen stecken in dieser Phase. Summe der Karten darin. */
  bestand: number
  /** Wie viele davon sind heute dran. Summe der `heuteFaellig` darin. */
  heuteFaellig: number
  /** Die Karten dahinter, in Bauplan-Reihenfolge — für das Aufklappen. */
  karten: FunnelKarte[]
}

/**
 * Die Karten zu Phasen zusammenfassen. Vollständig, auch die leeren: Was der
 * Ring weglässt, entscheidet die Oberfläche — eine Phase, die je nach Datenlage
 * im Ergebnis fehlt, würde beim Prüfen jedes Mal anders aussehen.
 */
export function funnelPhasen(karten: readonly FunnelKarte[]): Phase[] {
  const jeId = new Map<FunnelKartenId, FunnelKarte>()
  for (const k of karten) jeId.set(k.id, k)

  return PHASEN_PLAN.map((plan) => {
    const drin = plan.karten.map((id) => jeId.get(id)).filter((k): k is FunnelKarte => k != null)
    return {
      id: plan.id,
      titel: plan.titel,
      bedeutung: plan.bedeutung,
      imFunnel: plan.imFunnel,
      farbe: plan.farbe,
      bestand: drin.reduce((s, k) => s + k.bestand, 0),
      heuteFaellig: drin.reduce((s, k) => s + k.heuteFaellig, 0),
      karten: drin,
    }
  })
}

/** Die Summe über eine Phasen-Auswahl — die Zahl in der Mitte des Rings. */
export function phasenSumme(phasen: readonly Phase[]): number {
  return phasen.reduce((s, p) => s + p.bestand, 0)
}
