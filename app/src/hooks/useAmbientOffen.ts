import { useMemo } from 'react'
import { useActiveBrand } from '../cockpit/lib/activeBrand'
import { antwortPosten, followupPosten } from '../cockpit/lib/arbeitsmodusQuellen'
import { useContacts } from './useContacts'
import { useLinkedinThreads } from './useLinkedinThreads'

/**
 * Wie viele Antworten und Follow-ups warten (11.09.2026).
 *
 * **Warum nicht selbst gezählt.** Die naheliegende Abkürzung wäre eine schlanke
 * `count`-Abfrage auf `linkedin_threads` gewesen. Sie hätte eine andere Zahl
 * ergeben als der Sales-Flow: dort fallen Off-ICP-Kontakte, laufende Kunden,
 * zugesagte Looms und alles vor dem Akquise-Stichtag heraus, und diese Regeln
 * stehen im Code, nicht in der Datenbank. Zwei Wahrheiten für eine Zahl waren
 * der 78-Erstnachrichten-Fehler vom 17.08.; deshalb laufen hier buchstäblich
 * dieselben Funktionen wie in `useTagesFlow` — `antwortPosten` und
 * `followupPosten`, mit denselben Kontakten.
 *
 * **Was das kostet und warum es vertretbar ist.** Die Threads kommen über
 * `useLinkedinThreads`, das alle Spalten lädt. Das ist für ein Wallpaper viel,
 * passiert aber genau **einmal je Aufbau** der Seite — kein Takt, kein
 * Nachladen im Minutenrhythmus. Wer die Zahlen frisch will, drückt
 * Aktualisieren; das lädt die Fläche ohnehin neu.
 *
 * **Kein `useTagesFlow`.** Der rechnet dieselben Zahlen, schreibt dabei aber
 * die Tagesportion fest (Migration 0074). Ein Wallpaper, das um 00:01 lädt,
 * würde damit das Tages-Soll einfrieren, bevor der nächtliche Sync gelaufen
 * ist. Die Fläche liest, sie schreibt nicht.
 */
export function useAmbientOffen(): { antworten: number; followups: number; laedt: boolean } {
  const { activeBrand } = useActiveBrand()
  const threads = useLinkedinThreads(activeBrand?.slug)
  // Kunden gehören in keine Akquise-Spur (18.08.2026, Fall Reichentrog).
  const contacts = useContacts(activeBrand?.slug)

  return useMemo(() => {
    // Der Mount-Zeitpunkt genügt: die Follow-up-Schwellen sind Tage (3/7/14).
    const jetzt = new Date()
    return {
      antworten: antwortPosten(threads.items, jetzt, contacts.items).length,
      followups: followupPosten(threads.items, jetzt, contacts.items).length,
      laedt: threads.loading,
    }
  }, [threads.items, threads.loading, contacts.items])
}
