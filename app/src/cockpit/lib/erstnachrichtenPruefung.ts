import type { Erstnachricht } from '../../hooks/useErstnachrichten'

/**
 * Die Prüf-Stufe vor den Erstnachrichten (01.10.2026).
 *
 * Kevin: manche Erstnachrichten tragen einen PRÜFEN-Hinweis (Seite nicht
 * gefunden, Zuordnung unklar, Rolle fraglich, Seite im Umbau) und standen
 * trotzdem in der Erstnachrichten-Stufe — dort geht ein Text blind raus.
 * Seitdem gilt: Ein Fall mit Hinweis oder ohne Website gehört zuerst in die
 * Stufe „Prüfen". Kevin schaut selbst nach, setzt den Haken (`geprueft_at`),
 * und erst dann erscheint der Text bei den Erstnachrichten.
 *
 * Der Hinweis lebt weiter im Textfeld `firma` („Firma · PRÜFEN: Grund"), so wie
 * der Runner ihn schreibt (`erstnachrichtenEntwuerfe.mjs`). Reine Funktionen,
 * keine React-Importe.
 */

const MARKE = /\s*·\s*PRÜFEN:\s*/

type PruefFelder = Pick<Erstnachricht, 'status' | 'firma' | 'website'> & { geprueft_at?: string | null }

/** Firma und Hinweis getrennt: „A GmbH · PRÜFEN: Seite im Umbau" → { firma, hinweis }. */
export function trennePruefHinweis(firma: string | null | undefined): { firma: string; hinweis: string } {
  const roh = String(firma ?? '')
  const teile = roh.split(MARKE)
  if (teile.length < 2) return { firma: roh.trim(), hinweis: '' }
  return { firma: teile[0].trim(), hinweis: teile.slice(1).join(' · ').trim() }
}

/**
 * Muss Kevin diesen Fall zuerst ansehen? Offen, noch nicht abgehakt, und
 * entweder mit Hinweis des Schreib-Agenten oder ohne Website (dann hat die
 * Recherche nichts gefunden, und Kevin sieht selbst nach).
 */
export function brauchtPruefung(e: PruefFelder): boolean {
  if (e.status !== 'offen' || e.geprueft_at) return false
  return MARKE.test(String(e.firma ?? '')) || !String(e.website ?? '').trim()
}

/** Heute abgehakt — für die Zahl „n von m" der Prüf-Stufe. */
export function heuteGeprueft(e: Pick<Erstnachricht, 'status'> & { geprueft_at?: string | null }, jetzt: Date): boolean {
  if (!e.geprueft_at) return false
  const t = new Date(e.geprueft_at)
  return (
    t.getFullYear() === jetzt.getFullYear() && t.getMonth() === jetzt.getMonth() && t.getDate() === jetzt.getDate()
  )
}

/**
 * Wo Kevin nachsieht: die Website, sonst eine Google-Suche nach Firma und Name.
 * Der Link ist immer da — „nicht auffindbar" ist genau der Fall, den er prüft.
 */
export function pruefLink(e: Pick<Erstnachricht, 'name' | 'firma' | 'website'>): { href: string; label: string } {
  const seite = String(e.website ?? '').trim().split(' ')[0]
  if (seite) return { href: `https://${seite.replace(/^https?:\/\//, '')}`, label: 'Website öffnen' }
  const firma = trennePruefHinweis(e.firma).firma
  return { href: `https://www.google.com/search?q=${encodeURIComponent(`${firma} ${e.name}`.trim())}`, label: 'Bei Google suchen' }
}
