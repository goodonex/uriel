import { AuftraegePanel } from '../cockpit/components/AuftraegePanel'
import type { Auftrag, AuftraegeStand, AuftragPhase } from '../cockpit/lib/auftraegeApi'

/**
 * Dev-Vorschau (nur DEV, ohne Login): die Auftrags-Übersicht unter /agenten.
 *
 * Echte Daten gibt es nur vom Runner auf dem Mini; hier stehen die Zustände,
 * auf die es ankommt, nebeneinander — Kevins Beispiel (Phase 3 von 5 bei
 * 46 %), eine lange Kette mit Wächter, ein Auftrag, der brach liegt, und die
 * Arbeit ohne Phasenplan. Gleiches Muster wie `RechnungVorschau`.
 */
const M = 1_000_000
const vor = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

function phasen(titel: string[], fertig: number, laeuft?: { prozent: number | null; geschaetzt?: boolean; schritt?: string }): AuftragPhase[] {
  return titel.map((t, i) => ({
    id: `${t.split(' ')[0]}`,
    titel: t.split(' ').slice(1).join(' '),
    status: i < fertig ? 'fertig' : i === fertig && laeuft ? 'laeuft' : 'offen',
    prozent: i < fertig ? 100 : i === fertig && laeuft ? laeuft.prozent : 0,
    geschaetzt: i === fertig ? Boolean(laeuft?.geschaetzt) : false,
    tokens: 0,
    schritt: i === fertig ? (laeuft?.schritt ?? null) : null,
  }))
}

const beispiel: Auftrag = {
  projekt: 'laplace',
  titel: 'KETTE 5 — Arbeitsplatz fertig',
  quelle: 'STAND.md',
  gestartet: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  notiz: null,
  zustand: 'laeuft',
  letzteAktivitaet: vor(2),
  seitStunden: 0,
  phasen: phasen(['P1 Order-Leitung', 'P2 Orderbuch-Sammler', 'P3 Arbeitsfläche', 'P4 Heatmap-Kachel', 'P5 Abnahme'], 2, {
    prozent: 46,
    geschaetzt: true,
  }),
  aktuell: 2,
  gesamtProzent: 49,
  fertig: false,
  tokens: { verbraucht: 25.6 * M, usd: 19.8, geplant: 51 * M, geplantArt: 'hochrechnung', schnittJePhase: 10 * M },
  waechter: { jobs: 23, maxJobs: 150, stichtag: '2026-10-05T23:59:00+02:00', beendet: null, fehlschlaege: 0, ruheBis: null, letzterTitel: 'laplace P3' },
}

const lang: Auftrag = {
  ...beispiel,
  titel: 'KETTE 4 — vom Beobachtungsstand zum Arbeitsplatz',
  zustand: 'pausiert',
  letzteAktivitaet: vor(190),
  phasen: phasen(
    ['A1 Der Knopf muss buchen', 'A2 Orderbuch-Sammler anwerfen', 'A3 Hebel gedeckelt freigeben', 'A4 Zeichnen mit der Maus', 'A5 Die Arbeitsfläche', 'A6 Heatmap-Kachel', 'A7 Die Warum-Ansicht', 'A8 Anlaufstellen', 'A9 Mängelliste', 'A10 Lernen führt in die Anwendung', 'A11 Thesen-Prüfstand', 'A12 Abnahme'],
    7,
    { prozent: 60, schritt: 'Schritt 3 von 5: Quellenliste mit Kevins Favoriten' },
  ),
  aktuell: 7,
  gesamtProzent: 63,
  tokens: { verbraucht: 212 * M, usd: 148, geplant: 180 * M, geplantArt: 'vorgabe', schnittJePhase: 26 * M },
  waechter: { ...beispiel.waechter!, jobs: 96, fehlschlaege: 1, ruheBis: new Date(Date.now() + 18 * 60_000).toISOString() },
}

const brach: Auftrag = {
  projekt: 'uriel',
  titel: 'Lead-Bewertung',
  quelle: 'FORTSCHRITT.json',
  gestartet: '2026-09-23',
  notiz: null,
  zustand: 'brach',
  letzteAktivitaet: vor(60 * 50),
  seitStunden: 50,
  phasen: phasen(['S1 Grundprofil und Topf', 'S2 Tiefenprofil vor der Erstnachricht', 'S3 Sortierung in allen Listen'], 1, { prozent: null }),
  aktuell: 1,
  gesamtProzent: 33,
  fertig: false,
  tokens: { verbraucht: 8.4 * M, usd: 6.1, geplant: null, geplantArt: null, schnittJePhase: null },
  waechter: null,
}

const STAND: AuftraegeStand = {
  stand: vor(1),
  auftraege: [beispiel, lang, brach],
  weitere: [
    { projekt: 'gabriel', tokens7Tage: 115.5 * M, usd7Tage: 51, letzteAktivitaet: vor(3), laeuft: true },
    { projekt: 'jophiel', tokens7Tage: 1.4 * M, usd7Tage: 1.2, letzteAktivitaet: vor(60 * 24 * 7), laeuft: false },
  ],
}

export function AuftraegeVorschau() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ck-bg)', color: 'var(--ck-text-1)', padding: 24 }}>
      <div style={{ maxWidth: 1000 }}>
        <AuftraegePanel vorgabe={STAND} />
      </div>
    </div>
  )
}
