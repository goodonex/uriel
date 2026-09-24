/**
 * Die Regeln am Angebot (20.09.2026, Blaupause
 * `docs/wargames/angebot-unterschrift.md`).
 *
 * **Wo die Wahrheit über den Übergang wohnt.** Ob ein Angebot signiert werden
 * darf, entscheidet die Datenbank: Die Edge Function schreibt mit der Bedingung
 * `where status = 'versendet'`, und ein Trigger sperrt jede Änderung an einem
 * signierten Angebot. Diese Datei baut das **nicht nach** — sie beantwortet die
 * Frage, die die Oberfläche hat: Was darf Kevin hier gerade anfassen, und was
 * steht auf dem Knopf. Zwei Wege zu derselben Regel sind der Fehler, den dieses
 * Projekt schon zweimal bezahlt hat; deshalb ist der eine Weg die Datenbank und
 * dieser hier ausdrücklich nur die Anzeige.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-angebot.ts`.
 */
import type { Angebot, AngebotStatus } from '../../types/db'

export const ANGEBOT_STATUS_TITEL: Record<AngebotStatus, string> = {
  entwurf: 'Entwurf',
  versendet: 'Verschickt',
  signiert: 'Unterschrieben',
  abgelehnt: 'Abgelehnt',
  abgelaufen: 'Abgelaufen',
}

/**
 * Die Übergänge, die die Oberfläche anbieten darf. Sie sind eine Teilmenge
 * dessen, was die Datenbank zulässt — nie mehr.
 */
const UEBERGAENGE: Record<AngebotStatus, readonly AngebotStatus[]> = {
  entwurf: ['versendet', 'abgelehnt'],
  versendet: ['signiert', 'abgelehnt', 'abgelaufen'],
  signiert: [],
  abgelehnt: [],
  abgelaufen: ['versendet'],
}

export function darfWechseln(von: AngebotStatus, nach: AngebotStatus): boolean {
  return UEBERGAENGE[von].includes(nach)
}

/** Endstation: nichts geht mehr, und das ist der Sinn der Sache. */
export function istEndstation(status: AngebotStatus): boolean {
  return UEBERGAENGE[status].length === 0
}

/**
 * Ist das Angebot über seine Gültigkeit hinaus?
 *
 * Gerechnet wird auf **Tagesgrenze**, nicht auf die Sekunde: `gueltig_bis` ist
 * ein Datum, und ein Angebot, das „bis zum 30." gilt, gilt den 30. über. Wer
 * hier `new Date(gueltig_bis) < jetzt` schreibt, lässt es um Mitternacht des
 * Vortags verfallen.
 */
export function istAbgelaufen(angebot: Pick<Angebot, 'gueltig_bis' | 'status'>, jetzt: Date): boolean {
  if (angebot.status === 'signiert' || angebot.status === 'abgelehnt') return false
  const heute = jetzt.toISOString().slice(0, 10)
  return angebot.gueltig_bis < heute
}

/**
 * Der Status, den die Oberfläche zeigt — inklusive des Ablaufs, der in der
 * Datenbank erst steht, wenn jemand ihn setzt. Ein Angebot, das seit gestern
 * abgelaufen ist, soll nicht als „Verschickt" durchgehen, nur weil niemand
 * einen Zeitgeber gebaut hat.
 */
export function angezeigterStatus(angebot: Angebot, jetzt: Date): AngebotStatus {
  return istAbgelaufen(angebot, jetzt) ? 'abgelaufen' : angebot.status
}

/** Läuft es noch, wartet also auf eine Unterschrift? */
export function istOffen(angebot: Angebot, jetzt: Date): boolean {
  const s = angezeigterStatus(angebot, jetzt)
  return s === 'entwurf' || s === 'versendet'
}

/**
 * Die Summe, die auf dem Angebot steht — und zwar als zwei Zahlen, nicht als
 * eine. Der Festpreis ist einmalig, der Retainer läuft monatlich; sie zu
 * addieren wäre eine dritte Zahl, die es nicht gibt.
 */
export interface AngebotsSumme {
  einmalig: number
  monatlich: number | null
}

export function angebotsSumme(angebot: Pick<Angebot, 'betrag' | 'retainer_betrag'>): AngebotsSumme {
  return {
    einmalig: angebot.betrag,
    monatlich: angebot.retainer_betrag ?? null,
  }
}

export function formatEuro(betrag: number): string {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Ein Satz, der den Stand beschreibt — für die Zeile im Panel und für den
 * Halbsatz an der Karte. Kein Fachwort, weil ihn auch Kevin liest, wenn er
 * gerade telefoniert.
 */
export function angebotHalbsatz(angebot: Angebot, jetzt: Date): string {
  const status = angezeigterStatus(angebot, jetzt)
  switch (status) {
    case 'entwurf':
      return 'Angelegt, noch nicht verschickt'
    case 'versendet':
      return `Verschickt, gültig bis ${datumDeutsch(angebot.gueltig_bis)}`
    case 'signiert':
      return angebot.signiert_am
        ? `Unterschrieben am ${datumDeutsch(angebot.signiert_am.slice(0, 10))}`
        : 'Unterschrieben'
    case 'abgelehnt':
      return 'Abgelehnt'
    case 'abgelaufen':
      return `Abgelaufen am ${datumDeutsch(angebot.gueltig_bis)}`
  }
}

export function datumDeutsch(iso: string): string {
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

/**
 * Darf ein zweites Angebot an denselben Lead? Ja — aber nicht, ohne dass Kevin
 * es weiß. Dieselbe Haltung wie die Dublettensperre bei der Rechnung:
 * zurückfragen, nicht blocken. Zwei offene Angebote heißen zwei Links, und der
 * Makler unterschreibt den falschen.
 */
export function offeneAngebote(angebote: Angebot[], jetzt: Date): Angebot[] {
  return angebote.filter((a) => istOffen(a, jetzt))
}

/**
 * Das Angebot, an dem die Rechnung hängt: das zuletzt unterschriebene. Ältere
 * bleiben stehen — ein Kunde kann nachbuchen, und dann ist das jüngste die
 * Wahrheit für die nächste Rechnung.
 */
export function letztesSigniertes(angebote: Angebot[]): Angebot | null {
  const signiert = angebote
    .filter((a) => a.status === 'signiert' && a.signiert_am != null)
    .sort((a, b) => (a.signiert_am! < b.signiert_am! ? 1 : -1))
  return signiert[0] ?? null
}
