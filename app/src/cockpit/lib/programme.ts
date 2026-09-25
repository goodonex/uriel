import type { BereichIconName } from '../components/BereichIcon'

/**
 * Die Schwester-Programme — ein Klick, neuer Tab (25.09.2026).
 *
 * Kevin: *„dass wir da alle Programme drin haben … Jophiel, Gabriel und auch
 * Laplace. Dass man da einen Klick hat und zack, wird ein neuer Tab
 * aufgemacht."* Gabriel ersetzt in der Leiste Content und Ads; die beiden
 * Seiten bleiben erreichbar (Suche, „Mehr"), bis Ads nach Gabriel umgezogen ist.
 *
 * Adressen an EINER Stelle. Laplace hat keine öffentliche Adresse — es läuft
 * nur auf dem Rechner, auf dem sein Dev-Server gestartet ist (Port 5174).
 */
export interface Programm {
  id: 'gabriel' | 'jophiel' | 'laplace'
  label: string
  url: string
  icon: BereichIconName
  /** Wofür es da ist — Tooltip und Vorlesetext. */
  zweck: string
}

export const PROGRAMME: Programm[] = [
  { id: 'gabriel', label: 'Gabriel', url: 'https://gabriel.frameworkos.de', icon: 'bild', zweck: 'Content & Ads' },
  { id: 'jophiel', label: 'Jophiel', url: 'https://jophiel.frameworkos.de', icon: 'fenster', zweck: 'Websites bauen' },
  { id: 'laplace', label: 'Laplace', url: 'http://127.0.0.1:5174', icon: 'kurve', zweck: 'Trading (nur lokal)' },
]
