import type { AmbientZeile } from '../../lib/ambient'

/**
 * Spalte 1 der Ambient-Fläche: was offen ist (10.09.2026).
 *
 * Zwei Arten von Zeilen, mit Absicht unterschiedlich bedienbar:
 *
 * - **Aufgaben** tragen ein Kästchen und werden hier abgehakt. Der Klick
 *   bleibt in der Fläche — das Wallpaper darf beim Abhaken nicht wegnavigieren.
 * - **Widersprüche** tragen keinen Haken, sondern führen an den Ort, an dem
 *   der Handgriff getan wird. Sie verschwinden, wenn die Ursache weg ist; sie
 *   wegzuklicken hieße, den Befund zu verstecken statt ihn zu beheben.
 *
 * **Warum `target="_blank"`:** Ein Klick auf einen normalen Link würde die
 * Plash-Fläche selbst navigieren — dann steht statt des Wallpapers das Cockpit
 * auf dem Schreibtisch und das Dashboard ist weg. Links gehen deshalb in den
 * Browser, die Fläche bleibt stehen.
 */
export function LageSpalte({
  zeilen,
  rest,
  laedt,
  basis,
  onErledigt,
}: {
  zeilen: AmbientZeile[]
  rest: number
  laedt: boolean
  /** Ursprung des Cockpits, damit Links im Browser landen statt im Wallpaper. */
  basis: string
  onErledigt: (id: string) => void
}) {
  if (laedt) return <p className="amb-still">…</p>
  if (zeilen.length === 0) return <p className="amb-still">Nichts offen. Der Tag gehört dir.</p>

  return (
    <>
      <ul className="amb-liste">
        {zeilen.map((zeile) => (
          <li key={zeile.id} className={`amb-zeile${zeile.dringend ? ' amb-zeile-dringend' : ''}`}>
            {zeile.abhakbar ? (
              <button
                type="button"
                className="amb-haken"
                onClick={() => onErledigt(zeile.id)}
                aria-label={`„${zeile.titel}" als erledigt markieren`}
              >
                <span className="amb-kaestchen" aria-hidden />
              </button>
            ) : (
              <span className="amb-marke" aria-hidden />
            )}

            <div className="amb-inhalt">
              <span className="amb-titel">{zeile.titel}</span>
              {zeile.tun ? (
                <a
                  className="amb-tun"
                  href={`${basis}${zeile.ziel ?? '/cockpit'}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {zeile.tun}
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {rest > 0 ? (
        <a className="amb-mehr" href={`${basis}/aufgaben`} target="_blank" rel="noreferrer">
          und {rest} weitere
        </a>
      ) : null}
    </>
  )
}
