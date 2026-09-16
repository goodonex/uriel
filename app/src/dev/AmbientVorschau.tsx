import { useState } from 'react'
import { AmbientAnsicht } from '../cockpit/pages/AmbientPage'
import { kurzerHandgriff, type AmbientZeile } from '../cockpit/lib/ambient'
import type { AmbientZaehler } from '../cockpit/components/ambient/ZaehlerSpalte'

/**
 * Dev-Vorschau der Ambient-Fläche (10.09.2026) — wie die übrigen `/dev/*`-Seiten:
 * feste Daten statt Supabase, damit Raster, Scrim und Bedienelemente ohne Login
 * beurteilt werden können. Genau dafür trennt `AmbientPage` Darstellung und
 * Datenbeschaffung.
 *
 * Die Inhalte sind Kevins echte Befunde und Zählfelder vom 10.09., nicht
 * Blindtext — die Fläche muss mit echten Satzlängen bestehen. Wer sie hier
 * kürzt, prüft eine Fläche, die es nicht gibt.
 */
const BEFUNDE: AmbientZeile[] = [
  {
    id: 'w-1',
    titel: '2 Erstnachrichten gelten als offen, obwohl die Person schon einen Thread im Postfach hat',
    tun: 'Als verschickt verbuchen',
    ziel: '/linkedin',
    dringend: true,
    abhakbar: false,
  },
  {
    id: 'w-2',
    titel: 'kontakte: Der letzte Lauf brach bei 30 von 723 ab',
    tun: 'Sync wiederholen; bleibt es dabei, steht das Sync-Chrome-Fenster still (Fokus-Emulation prüfen)',
    ziel: '/linkedin',
    dringend: true,
    abhakbar: false,
  },
  {
    id: 'w-3',
    titel: 'einladungen: Der letzte Lauf brach bei 40 von 1064 ab',
    tun: 'Sync wiederholen; bleibt es dabei, steht das Sync-Chrome-Fenster still (Fokus-Emulation prüfen)',
    ziel: '/linkedin',
    dringend: true,
    abhakbar: false,
  },
  {
    id: 'w-4',
    titel: '1 Kontakt gilt als „Einladung offen", obwohl mit ihm geschrieben wird',
    tun: 'Netzwerk-Sync nachziehen',
    ziel: '/linkedin',
    dringend: false,
    abhakbar: false,
  },
  { id: 't-1', titel: 'Reichentrog: Feedback zur Startseite einarbeiten', dringend: false, abhakbar: true },
]

/**
 * Zählen oder öffnen — dieselbe Aufteilung wie auf der echten Fläche
 * (`ARBEITSORT` in `AmbientPage`). Wer sie hier vereinheitlicht, prüft eine
 * Spalte, die es nicht gibt.
 */
const ZAEHLER: AmbientZaehler[] = [
  { field: 'li_anfragen', label: 'Vernetzungsanfragen', stand: 40, tagesziel: 40, art: 'zaehlen' },
  { field: 'li_nachrichten', label: 'Erstnachrichten', stand: 0, art: 'oeffnen', ziel: '/sales?kachel=erstnachrichten', offen: 140 },
  { field: 'antworten_erledigt', label: 'Antworten', stand: 0, art: 'oeffnen', ziel: '/sales?kachel=antworten', offen: 43 },
  { field: 'li_followups', label: 'Follow-ups', stand: 0, art: 'oeffnen', ziel: '/sales?kachel=followups', offen: 177 },
  { field: 'inmails', label: 'Reaktivierung · InMails', stand: 0, tagesziel: 5, art: 'zaehlen' },
]

export function AmbientVorschau() {
  // Wie auf der echten Fläche: der Wächter-Satz wird am ersten Semikolon
  // gekappt. Ohne das prüfte die Vorschau eine Spalte, die es nicht gibt.
  const [zeilen, setZeilen] = useState(() =>
    BEFUNDE.map((z) => ({ ...z, tun: kurzerHandgriff(z.tun) })),
  )
  const [zaehler, setZaehler] = useState(ZAEHLER)
  const [alsWallpaper, setAlsWallpaper] = useState(false)
  // Tageswechsel und Aufwachzeit sind hier echter State, nicht fest verdrahtet:
  // beides ist Bedienung, und Bedienung muss sich in der Vorschau prüfen lassen.
  const [tagVersatz, setTagVersatz] = useState(0)
  const [aufwachStunde, setAufwachStunde] = useState(7)
  const [detail, setDetail] = useState(false)
  const jetzt = new Date()
  const tagDatum = new Date(jetzt)
  tagDatum.setDate(tagDatum.getDate() + tagVersatz)

  return (
    <>
      <AmbientAnsicht
        gruss="Guten Tag."
        datum="Donnerstag, 10. September"
        zeilen={zeilen}
        rest={0}
        gesamt={zeilen.length}
        /* Echte Größenordnung: Kevins Septemberziel und ein Stand, der hinter
           der Kurve liegt — nur so ist der Warn-Zustand überhaupt zu sehen. */
        monat={{ ist: 12500, ziel: 50000, sollHeute: 15000 }}
        /* Bewusst gemischte Längen: 30 Minuten, eine Stunde, zwei Stunden.
           Genau daran zeigt sich, ob die Achse maßstäblich ist — bei lauter
           Ein-Stunden-Terminen sähe auch eine falsche Achse richtig aus. */
        termine={[
          { id: 'e0', zeit: '08:00', titel: 'Aufstehen & fertig', naechster: false, dauerMin: 60 },
          { id: 'e1', zeit: '08:30', titel: 'Sport', naechster: false, dauerMin: 120 },
          { id: 'e2', zeit: '10:30', titel: 'Looms raus', naechster: false, dauerMin: 90 },
          { id: 'e3', zeit: '12:00', titel: 'Paket weg bringen + Chicken holen', naechster: false, dauerMin: 60 },
          { id: 'e4', zeit: '13:00', titel: 'Anfragen raus', naechster: true, dauerMin: 45 },
          { id: 'e5', zeit: '13:45', titel: 'Erstnachrichten raus', naechster: false, dauerMin: 120 },
          { id: 'e6', zeit: '16:00', titel: 'Closing-Call · Hausverwaltung Nord', naechster: false, dauerMin: 60 },
          { id: 'e7', zeit: '17:00', titel: 'Wohnung & Essen', naechster: false, dauerMin: 120 },
        ]}
        tagVersatz={tagVersatz}
        tagDatum={tagDatum}
        aufwachStunde={aufwachStunde}
        detail={detail}
        termineLaden={false}
        termineFehler={null}
        tageMitTerminen={new Set([2, 4, 8, jetzt.getDate(), 12, 15, 18, 23, 26])}
        zaehler={zaehler}
        kennzahlen={[
          { wert: 140, label: 'versandfertig' },
          { wert: 723, label: 'Kontakte' },
          // Genau Kevins Bild vom 11.09.: der Spiegel steht auf 1.061, während
          // der abgebrochene Lauf 1.094 auf der Seite sah.
          { wert: 1061, label: 'Einladungen', veraltet: true },
        ]}
        jetzt={jetzt}
        jetztHhmm={`${String(jetzt.getHours()).padStart(2, '0')}:${String(jetzt.getMinutes()).padStart(2, '0')}`}
        laedt={false}
        alsWallpaper={alsWallpaper}
        basis="http://localhost:5173"
        onErledigt={(id) => setZeilen((prev) => prev.filter((z) => z.id !== id))}
        onZaehl={(field) =>
          setZaehler((prev) => prev.map((z) => (z.field === field ? { ...z, stand: z.stand + 1 } : z)))
        }
        onTag={setTagVersatz}
        onAufwach={setAufwachStunde}
        onDetail={setDetail}
      />
      {/* Nur in der Vorschau: der Plash-Zustand lässt sich sonst nicht prüfen,
          ohne die Seite tatsächlich als Wallpaper zu setzen. */}
      <button
        type="button"
        onClick={() => setAlsWallpaper((v) => !v)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 10,
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid rgba(214,235,205,0.18)',
          background: 'rgba(8,13,9,0.72)',
          color: '#a7b3a2',
          font: '500 12px Inter, system-ui, sans-serif',
          cursor: 'pointer',
        }}
      >
        {alsWallpaper ? 'Wallpaper-Ruhezustand: an' : 'Wallpaper-Ruhezustand: aus'}
      </button>
    </>
  )
}

export default AmbientVorschau
