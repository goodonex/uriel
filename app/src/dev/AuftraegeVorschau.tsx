import { AuftraegePanel } from '../cockpit/components/AuftraegePanel'
import { NutzungPanel } from '../cockpit/components/NutzungPanel'
import type { Auftrag, AuftraegeStand, AuftragPhase, NutzungsStand } from '../cockpit/lib/auftraegeApi'

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

/** laplace, wie es heute auf dem Mini steht: Kette 4 am 21.09. abgeschlossen. */
const fertig: Auftrag = {
  ...lang,
  zustand: 'fertig',
  letzteAktivitaet: '2026-09-21T16:12:08.000Z',
  phasen: lang.phasen.map((p) => ({ ...p, status: 'fertig', prozent: 100, schritt: null })),
  aktuell: null,
  gesamtProzent: 100,
  fertig: true,
  tokens: { verbraucht: 964 * M, usd: 610, geplant: 964 * M, geplantArt: 'hochrechnung', schnittJePhase: 80 * M },
  waechter: null,
}

const wert = (tokens: number, usd: number) => ({ tokens: tokens * M, usd })
const reset = new Date(Date.now() + 6 * 86_400_000).toISOString()
const NUTZUNG: NutzungsStand = {
  plan: {
    woche: { anteil: 0.18, resetsAt: reset },
    fuenfStunden: { anteil: 0.07, resetsAt: new Date(Date.now() + 3 * 3_600_000).toISOString() },
    gemessen: vor(4),
  },
  // Seit Wochenstart (vor einem Tag) 180 $ → volle Woche ≈ 1.000 $
  stunden: Array.from({ length: 24 }, (_, i) => ({ h: new Date(Date.now() - (i + 1) * 3_600_000).toISOString().slice(0, 13), tokens: 5 * M, usd: 7.5 })),
  rechner: [
    { name: 'Mini', stand: vor(3) },
    { name: 'Air', stand: vor(12) },
  ],
  zeilen: [
    { projekt: 'uriel', programm: true, bauen: wert(532, 402), betrieb: wert(180, 96), arbeit: wert(0, 0), letzte: vor(3) },
    { projekt: 'laplace', programm: true, bauen: wert(1078, 690), betrieb: wert(0, 0), arbeit: wert(0, 0), letzte: vor(60 * 90) },
    { projekt: 'jophiel', programm: true, bauen: wert(203, 150), betrieb: wert(41, 22), arbeit: wert(0, 0), letzte: vor(60 * 48) },
    { projekt: 'gabriel', programm: true, bauen: wert(140, 98), betrieb: wert(6, 3), arbeit: wert(0, 0), letzte: vor(30) },
    { projekt: 'Vault & Sonstiges', programm: false, bauen: wert(0, 0), betrieb: wert(0, 0), arbeit: wert(1652, 980), letzte: vor(1) },
    { projekt: 'Herrmann & Co', programm: false, bauen: wert(0, 0), betrieb: wert(0, 0), arbeit: wert(82, 51), letzte: vor(60 * 30) },
  ],
}

const STAND: AuftraegeStand = {
  stand: vor(1),
  auftraege: [beispiel, lang, brach, fertig],
  hinweise: [],
}

export function AuftraegeVorschau() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ck-bg)', color: 'var(--ck-text-1)', padding: 24 }}>
      <div style={{ maxWidth: 1000 }}>
        <AuftraegePanel vorgabe={STAND} />
        <NutzungPanel vorgabe={NUTZUNG} />
      </div>
    </div>
  )
}
