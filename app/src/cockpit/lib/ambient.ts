import type { Widerspruch } from '../../hooks/useWidersprueche'
import type { Task } from '../../types/db'

/**
 * Die Rechenteile der Ambient-Fläche (10.09.2026).
 *
 * Sie liegen hier und nicht in `AmbientPage.tsx`, weil die Lint-Regel
 * `react-refresh/only-export-components` im Repo als *error* läuft: eine Datei
 * mit Komponenten darf nichts anderes exportieren. Nebeneffekt, den wir
 * mitnehmen: die Zeilen-Logik ist ohne React testbar.
 */

/** Der Gruß richtet sich nach der Tageszeit, nicht nach dem Datum. */
export function grussFuer(stunde: number): string {
  if (stunde < 5) return 'Noch wach.'
  if (stunde < 11) return 'Guten Morgen.'
  if (stunde < 18) return 'Guten Tag.'
  return 'Guten Abend.'
}

export function datumsZeile(jetzt: Date): string {
  return jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Wie viele Zeilen die Fläche verträgt, ohne unruhig zu werden. Alles darüber
 * wird zur Restzahl zusammengefasst — ein Wallpaper ist kein Aufgabenmanager.
 */
export const MAX_ZEILEN = 5

/** Eine Zeile der Fläche. */
export interface AmbientZeile {
  id: string
  titel: string
  /** Der Handgriff, der es behebt — nur Widersprüche bringen einen mit. */
  tun?: string
  /** Wohin der Handgriff führt, als Pfad im Cockpit. */
  ziel?: string
  /** Dringend: hohe Schwere beim Widerspruch, überfällig bei der Aufgabe. */
  dringend: boolean
  /**
   * Abhaken geht nur bei echten Aufgaben. Ein Widerspruch verschwindet, wenn
   * der Handgriff getan ist — ihn wegzuklicken hieße, die Ursache zu verstecken
   * statt sie zu beheben. Genau dafür ist der Wächter nicht gebaut.
   */
  abhakbar: boolean
}

/**
 * Wo der Handgriff eines Befunds getan wird.
 *
 * Der Wächter liefert den Satz („Als verschickt verbuchen"), aber keinen Ort.
 * Die Zuordnung hängt am Schlüssel, nicht am Text — Texte werden umformuliert,
 * Schlüssel nicht. Was hier nicht steht, führt auf die Home; das ist besser,
 * als eine Vermutung zu verlinken.
 */
/**
 * Der Handgriff auf eine Zeile gekürzt (11.09.2026).
 *
 * Der Wächter schreibt vollständige Anweisungen: *„Sync wiederholen; bleibt es
 * dabei, steht das Sync-Chrome-Fenster still (Fokus-Emulation prüfen)"*. Im
 * Cockpit ist das genau richtig — dort liest man sie, wenn man den Fehler
 * behebt. Auf einem Wallpaper liest sie niemand: dort beantwortet der Handgriff
 * nur „was mache ich damit", und drei solcher Sätze untereinander machen aus
 * der Spalte eine Textwand.
 *
 * Geschnitten wird am ersten Semikolon oder an der ersten Klammer, also genau
 * da, wo der Wächter selbst vom Auftrag zur Erläuterung wechselt. Die volle
 * Fassung steht unverändert an ihrem Ort — der Link führt hin.
 */
export function kurzerHandgriff(tun: string | undefined): string | undefined {
  if (!tun) return tun
  const kurz = tun.split(/[;(]/)[0].trim()
  return kurz.length > 0 ? kurz : tun
}

export function zielFuerBefund(schluessel: string): string {
  if (schluessel.startsWith('erstnachricht')) return '/linkedin'
  if (schluessel.startsWith('netzwerk')) return '/linkedin'
  if (schluessel.startsWith('sync')) return '/linkedin'
  if (schluessel.startsWith('followup')) return '/sales'
  return '/cockpit'
}

/**
 * Was auf die Fläche gehört, in der Reihenfolge, in der Kevin zugreift:
 * erst was Uriel an sich selbst bemängelt, dann Liegengebliebenes, dann Heutiges.
 *
 * **Warum Widersprüche zuerst und überhaupt:** Die erste Fassung zeigte nur
 * `foundation_tasks` — und meldete „Nichts offen", während vier Befunde offen
 * standen. Kevins offene Punkte entstehen nicht als Aufgaben, sie entstehen als
 * Widersprüche zwischen zwei Datenständen (`runner/widersprueche.mjs`).
 */
export function ambientZeilen(
  befunde: Widerspruch[],
  overdue: Task[],
  today: Task[],
): { sichtbar: AmbientZeile[]; rest: number; gesamt: number } {
  const offen: AmbientZeile[] = [
    ...befunde.map((b) => ({
      id: `w-${b.schluessel}`,
      titel: b.text,
      tun: kurzerHandgriff(b.tun),
      ziel: zielFuerBefund(b.schluessel),
      dringend: b.schwere === 'hoch',
      abhakbar: false,
    })),
    ...overdue.map((t) => ({ id: t.id, titel: t.title, dringend: true, abhakbar: true })),
    ...today.map((t) => ({ id: t.id, titel: t.title, dringend: false, abhakbar: true })),
  ]
  return {
    sichtbar: offen.slice(0, MAX_ZEILEN),
    rest: Math.max(0, offen.length - MAX_ZEILEN),
    gesamt: offen.length,
  }
}

/**
 * Ein Termin, so wie die Fläche ihn braucht.
 *
 * Stand bis zum 10.09.2026 in `HeuteSpalte.tsx`. Die Spalte ist entfallen —
 * Termine standen dort ein zweites Mal, obwohl der Tagesverlauf rechts sie
 * schon zeigt —, der Typ blieb. Er liegt jetzt hier, weil eine Datei mit
 * Komponenten wegen `react-refresh/only-export-components` nichts anderes
 * exportieren darf.
 */
export interface AmbientTermin {
  id: string
  /** `09:30`, oder undefined bei ganztägig. */
  zeit?: string
  titel: string
  /** true = läuft gerade oder ist der nächste. */
  naechster: boolean
  /**
   * Länge in Minuten, wo der Kalender sie hergibt. Der Tagesverlauf zeichnet
   * Termine maßstäblich; ohne diese Zahl setzt er eine Standardlänge, statt
   * eine zu erfinden.
   */
  dauerMin?: number
}
