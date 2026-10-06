import { personenSchluessel } from './erstnachrichtenOffen'
import { heutigesMetrikDatum } from './metricsDates'

/**
 * „Anfragen an dich" — wer Kevin von sich aus auf LinkedIn angefragt hat
 * (06.10.2026, Migration 0098).
 *
 * Kevin: *„Ich will noch einen Reiter für wenn einer meiner Zielgruppe mich
 * anfragt."* Der Runner liest die Eingangsliste, prüft die Zielgruppe und legt
 * einen Text bereit (`runner/linkedin/anfragen.mjs`). Diese Datei entscheidet
 * nur, wer in der Liste steht und was die Zeile sagt.
 *
 * **Reine Funktionen, keine React-Importe** — geprüft per
 * `npx tsx scripts/verify-anfragen-an-dich.ts`.
 */

export type AnfrageStatus = 'offen' | 'gesendet' | 'verworfen'

export interface Anfrage {
  id: string
  profil_key: string
  name: string
  headline: string
  profile_url: string
  notiz: string
  gemeinsame: string
  eingegangen_at: string
  nicht_mehr_da_at: string | null
  icp_urteil: 'kern' | 'rand' | 'unklar' | 'off'
  icp_grund: string | null
  ausgeblendet_grund: string | null
  firma: string
  website: string
  entwurf: string | null
  entwurf_at: string | null
  entwurf_versuche: number
  status: AnfrageStatus
  status_at: string | null
}

/** Eine Anfrage, wie die Liste sie zeigt — mit dem, was das Netzwerk über sie weiß. */
export interface AnfrageZeile extends Anfrage {
  /** Kevin hat auf LinkedIn schon angenommen (Kontaktliste), der Text ist aber noch nicht raus. */
  angenommen: boolean
}

export interface AnfragenAufteilung {
  /** Zielgruppe, wartet auf Kevin — mit oder ohne fertigen Text. */
  offen: AnfrageZeile[]
  /** Nicht Zielgruppe (Profil oder Schreiber) — eingeklappt, mit Grund. */
  ausgeblendet: AnfrageZeile[]
  /** Heute von Kevin erledigt (gesendet oder verworfen) — die erste Zahl der Zeile. */
  heuteErledigt: number
}

/**
 * Wer steht in der Liste?
 *
 * - `gesendet`/`verworfen`: weg (heute erledigte zählen in `heuteErledigt`).
 * - Es gibt schon ein Gespräch mit der Person: weg. Dann hat Kevin geschrieben
 *   (oder die Person), und alles Weitere läuft in „Antworten" und den
 *   Follow-ups. Sonst stünde sie an zwei Stellen.
 * - Nicht mehr auf der Eingangsliste und kein Kontakt: Kevin hat auf LinkedIn
 *   ignoriert — weg, ohne Zutun.
 * - Nicht Zielgruppe: eingeklappt mit Grund, wie bei den Antworten.
 */
export function teileAnfragen(
  zeilen: readonly Anfrage[],
  {
    threads,
    netzwerk,
    jetzt = new Date(),
  }: {
    threads: ReadonlyArray<{ name: string | null }>
    netzwerk: ReadonlyArray<{ profil_key: string; status: string }>
    jetzt?: Date
  },
): AnfragenAufteilung {
  const heute = heutigesMetrikDatum(jetzt)
  const imGespraech = new Set(threads.map((t) => personenSchluessel(t.name)).filter(Boolean))
  const angenommen = new Set(netzwerk.filter((n) => n.status === 'angenommen').map((n) => n.profil_key))

  const offen: AnfrageZeile[] = []
  const ausgeblendet: AnfrageZeile[] = []
  let heuteErledigt = 0

  for (const z of zeilen) {
    if (z.status !== 'offen') {
      if (z.status_at && heutigesMetrikDatum(new Date(z.status_at)) === heute) heuteErledigt++
      continue
    }
    if (imGespraech.has(personenSchluessel(z.name))) continue
    const istKontakt = angenommen.has(z.profil_key)
    if (z.nicht_mehr_da_at && !istKontakt) continue
    const zeile: AnfrageZeile = { ...z, angenommen: istKontakt }
    if (z.icp_urteil === 'off' || z.ausgeblendet_grund) ausgeblendet.push(zeile)
    else offen.push(zeile)
  }

  // Die frischeste Anfrage zuerst — dort ist das Interesse am wärmsten.
  const neueste = (a: AnfrageZeile, b: AnfrageZeile) => String(b.eingegangen_at).localeCompare(String(a.eingegangen_at))
  return { offen: offen.sort(neueste), ausgeblendet: ausgeblendet.sort(neueste), heuteErledigt }
}

export interface AnfragenZeilenText {
  kennzahl: string
  unterzeile: string
  zustand: 'aktiv' | 'erledigt' | 'offen'
  /** Gold nur, wenn etwas nicht stimmt (Ladefehler) — nie Rot. */
  warnung: boolean
}

/**
 * Was die Zeile in der Tagesliste sagt.
 *
 * **Ein Ladefehler ist nie „0 von 0 ✓".** Das ist die Lehre vom 31.08.
 * („ERSTNACHRICHTEN · LINKEDIN — 0 von 0 ✓", während Hunderte warteten): Eine
 * leere Liste aus einem Fehler sieht sonst genau aus wie eine erledigte.
 * Deshalb hat jeder der drei Nicht-Zustände (lädt, Tabelle fehlt, Fehler)
 * eigene Worte und nie den Haken.
 */
export function anfragenZeilenText({
  laedt,
  tabelleFehlt,
  fehler,
  aufteilung,
}: {
  laedt: boolean
  tabelleFehlt: boolean
  fehler: string | null
  aufteilung: AnfragenAufteilung | null
}): AnfragenZeilenText {
  if (tabelleFehlt) {
    return { kennzahl: 'Migration 0098 ausstehend', unterzeile: 'Noch nicht eingerichtet.', zustand: 'offen', warnung: true }
  }
  if (fehler) {
    return { kennzahl: 'nicht geladen', unterzeile: 'Die Anfragen konnten nicht geladen werden.', zustand: 'offen', warnung: true }
  }
  if (laedt || !aufteilung) {
    return { kennzahl: '…', unterzeile: 'Wer dich angefragt hat.', zustand: 'offen', warnung: false }
  }
  const { offen, ausgeblendet, heuteErledigt } = aufteilung
  const ohneText = offen.filter((a) => !a.entwurf).length
  const teile: string[] = []
  if (offen.length > 0) {
    teile.push(
      ohneText === 0
        ? `${offen.length === 1 ? 'Text liegt' : 'Texte liegen'} bereit`
        : ohneText === offen.length
          ? 'Text wird vorbereitet'
          : `${ohneText} ohne Text, der Mini schreibt nach`,
    )
  }
  if (ausgeblendet.length > 0) teile.push(`${ausgeblendet.length} ausgeblendet`)

  if (offen.length === 0 && heuteErledigt === 0) {
    return {
      kennzahl: 'Keine offen',
      unterzeile: teile.length ? teile.join(' · ') : 'Wer aus deiner Zielgruppe dich anfragt, steht hier mit Text.',
      zustand: 'erledigt',
      warnung: false,
    }
  }
  return {
    kennzahl: `${heuteErledigt} von ${heuteErledigt + offen.length}`,
    unterzeile: teile.length ? teile.join(' · ') : 'Alle beantwortet.',
    zustand: offen.length > 0 ? 'aktiv' : 'erledigt',
    warnung: false,
  }
}

