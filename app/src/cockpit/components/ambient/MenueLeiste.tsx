import { MENUE_DRAUSSEN, MENUE_URIEL, oeffneAlsFenster, zielUrl, type MenueZiel } from '../../lib/ambientMenue'

/**
 * Die Menüleiste am linken Rand der Ambient-Fläche (10.09.2026).
 *
 * **Warum es sie gibt.** Bis hierher war die Fläche eine Einbahnstraße: sie
 * zeigte, was ansteht, aber es gab keinen Weg *hinein*. Wer die Erstnachrichten
 * abarbeiten wollte, musste den Browser suchen, Uriel finden, sich durchklicken
 * — auf einem Schreibtisch, der genau diesen Weg abkürzen soll.
 *
 * **Zugeklappt ist der Normalzustand.** Sichtbar sind nur die Kürzel, 52 px
 * breit; die Namen kommen beim Darüberfahren. Ein Wallpaper mit einer
 * dauerhaft ausgeklappten Navigationsleiste ist keine Fläche mehr, sondern
 * eine App im Vollbild — und die Leiste läge über dem Bild, das der Grund für
 * das Ganze ist. Sie klappt nach rechts auf, *über* die Spalten: würde das
 * Raster mitwandern, ruckte bei jeder Mausbewegung die ganze Fläche.
 *
 * **Jeder Eintrag ist ein echter Link mit `target="_blank"`.** Das ist die
 * Klick-Regel der Fläche und keine Formsache: ein Klick, der im selben Fenster
 * navigiert, ersetzt das Wallpaper durch das Cockpit. Wo ein eigenes Fenster
 * sinnvoll ist (die Arbeitslisten), versucht `oeffneAlsFenster` es zusätzlich
 * — gelingt es, wird der Link abgebrochen; gelingt es nicht, bleibt der Tab.
 */
export function MenueLeiste({
  basis,
  alsWallpaper,
  onSpaltenGleich,
}: {
  basis: string
  alsWallpaper: boolean
  /** Alle vier Spalten gleich breit — der Weg zurück aus einer verzogenen
   *  Aufteilung. Er steht hier unten, weil die Leiste der Ort ist, an dem auf
   *  dieser Fläche etwas *bedient* wird. */
  onSpaltenGleich: () => void
}) {
  const eintrag = (ziel: MenueZiel) => {
    const url = zielUrl(ziel, basis)
    return (
      <a
        key={ziel.id}
        className="amb-menue-knopf"
        href={url}
        target="_blank"
        rel="noreferrer"
        title={ziel.label}
        onClick={(e) => {
          if (ziel.art !== 'fenster') return
          if (oeffneAlsFenster(ziel.id, url, alsWallpaper)) e.preventDefault()
        }}
      >
        <span className="amb-menue-kuerzel" aria-hidden>
          {ziel.kuerzel}
        </span>
        <span className="amb-menue-label">{ziel.label}</span>
      </a>
    )
  }

  return (
    <nav className="amb-menue" aria-label="Uriel und Arbeitsorte">
      {/*
       * Das Panel trägt den Grund der offenen Leiste — und ist genau so hoch
       * wie seine Einträge.
       *
       * Die erste Fassung legte stattdessen einen weichen Verlauf über die
       * volle Spaltenhöhe. Der schnitt die Zeilen der Spalte „Offen" mitten im
       * Wort an: halb verblasster Text neben den Menünamen, beides schlecht
       * lesbar. Ein Grund, der deckt und eine eigene Kante hat, verdeckt sauber,
       * statt aufzulösen.
       */}
      <div className="amb-menue-panel">
        <div className="amb-menue-gruppe">{MENUE_URIEL.map(eintrag)}</div>
        <div className="amb-menue-trenner" aria-hidden />
        <div className="amb-menue-gruppe">{MENUE_DRAUSSEN.map(eintrag)}</div>
        <div className="amb-menue-trenner" aria-hidden />
        <div className="amb-menue-gruppe">
          {/*
           * Aktualisieren heißt hier wirklich neu laden, nicht „einen Hook
           * nachziehen": die Fläche hängt an fünf Quellen (Widersprüche,
           * Aufgaben, Kalender, Tageszähler, Runner-Spiegel), die alle ihren
           * eigenen Takt haben. Ein Knopf, der nur eine davon erwischt, wäre
           * schlimmer als keiner — man drückt ihn und glaubt, es sei frisch.
           * Der Neuaufbau dauert unter einer Sekunde und behält die Adresse,
           * also auch `?plash=1`.
           */}
          <button
            type="button"
            className="amb-menue-knopf"
            onClick={() => window.location.reload()}
            title="Alles neu laden"
          >
            <span className="amb-menue-kuerzel" aria-hidden>
              <svg viewBox="0 0 16 16" width="15" height="15">
                <g fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.75" />
                  <path d="M13.4 2.6v3.1h-3.1" />
                </g>
              </svg>
            </span>
            <span className="amb-menue-label">Aktualisieren</span>
          </button>

          <button
            type="button"
            className="amb-menue-knopf"
            onClick={onSpaltenGleich}
            title="Alle Spalten gleich breit"
          >
            <span className="amb-menue-kuerzel" aria-hidden>
              {/* Vier gleich breite Felder — das Ergebnis als Bild, statt es
                  mit einem Buchstaben zu umschreiben. */}
              <svg viewBox="0 0 16 16" width="15" height="15">
                <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  <path d="M2 3.5v9M6 3.5v9M10 3.5v9M14 3.5v9" />
                </g>
              </svg>
            </span>
            <span className="amb-menue-label">Spalten gleich</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
