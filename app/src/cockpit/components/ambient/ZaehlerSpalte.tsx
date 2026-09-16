import { oeffneAlsFenster } from '../../lib/ambientMenue'

/** Ein Zählfeld auf der Fläche: Stand, optionales Tagesziel, ein Handgriff. */
export interface AmbientZaehler {
  field: string
  label: string
  stand: number
  tagesziel?: number
  /**
   * Was diese Zeile kann.
   *
   * - `zaehlen` — ein Tipp auf `+` schreibt sofort in `daily_metrics`.
   * - `oeffnen` — die Zeile führt in Uriel hinein, in ein eigenes Fenster.
   *
   * **Die Unterscheidung ist Kevins, nicht die des Datenmodells** (10.09.2026).
   * Am Wallpaper zählt er, was ein Handgriff ist: eine Vernetzungsanfrage geht
   * raus, Daumen aufs Plus, fertig. Erstnachrichten, Antworten und Follow-ups
   * gehen anders — die Nachricht muss erst gelesen und herauskopiert werden.
   * Ein `+` daneben ist dort ein Knopf, den niemand drückt, und ein Zähler,
   * den niemand drückt, ist eine Zahl, die lügt.
   */
  art: 'zaehlen' | 'oeffnen'
  /** Nur bei `oeffnen`: der Pfad im Cockpit, an dem gearbeitet wird. */
  ziel?: string
  /**
   * Wie viele warten — die Zahl, die aus der „0" erst eine Aussage macht
   * (11.09.2026).
   *
   * Kevins Satz: *„mit der Null kann ich halt einfach nichts anfangen."* Eine
   * Zeile „Erstnachrichten 0" heißt entweder „nichts zu tun" oder „140 liegen
   * bereit und du hast noch nicht angefangen" — und das sind die beiden
   * gegensätzlichsten Nachrichten, die ein Schreibtisch senden kann. Steht die
   * Zahl daneben, ist die Frage beantwortet, ohne irgendwo hineinzuklicken.
   */
  offen?: number
}

/**
 * Der Tageszähler der Ambient-Fläche (10.09.2026).
 *
 * **Das ist die Spalte, wegen der die Fläche kein Poster ist.** Ein Tipp auf
 * `+` schreibt sofort in `daily_metrics` — dieselbe Mechanik wie im Zähl-Modus
 * unter `/tracking/zaehlen`, nur ohne den Weg dorthin. Der Klick bleibt in der
 * Fläche: Wegnavigieren würde das Wallpaper ersetzen.
 *
 * Die Zeilen zum Abarbeiten öffnen stattdessen ein eigenes Browserfenster mit
 * der zuständigen Liste (`?kachel=…` im Sales-Dashboard). Auch das ersetzt das
 * Wallpaper nicht — es stellt ein Fenster daneben.
 *
 * Der Balken zeigt das Tagesziel, wo es eines gibt. Erstnachrichten und
 * Follow-ups stehen bewusst ohne Ziel (siehe `zaehlFelder.ts`) — sie zeigen
 * ihren Stand, statt eine Wunschzahl zu behaupten.
 */
export function ZaehlerSpalte({
  zaehler,
  basis,
  alsWallpaper,
  onZaehl,
}: {
  zaehler: AmbientZaehler[]
  /** Ursprung des Cockpits, damit das Fenster die richtige Uriel-Seite lädt. */
  basis: string
  /** In Plash wird kein eigenes Fenster versucht — siehe `oeffneAlsFenster`. */
  alsWallpaper: boolean
  onZaehl: (field: string) => void
}) {
  if (zaehler.length === 0) return <p className="amb-still">—</p>

  return (
    <div className="amb-zaehler">
      {zaehler.map((z) => {
        const anteil = z.tagesziel ? Math.min(1, z.stand / z.tagesziel) : null
        return (
          <div key={z.field} className="amb-zaehler-zeile">
            <div className="amb-zaehler-kopf">
              <span className="amb-zaehler-label">{z.label}</span>
              <span className="amb-zaehler-stand">
                <b>{z.stand}</b>
                {z.tagesziel ? <span className="amb-zaehler-ziel">/{z.tagesziel}</span> : null}
              </span>

              {z.art === 'zaehlen' ? (
                <button
                  type="button"
                  className="amb-plus"
                  onClick={() => onZaehl(z.field)}
                  aria-label={`${z.label} um eins hochzählen`}
                >
                  +
                </button>
              ) : (
                <a
                  className="amb-oeffnen"
                  href={`${basis}${z.ziel ?? '/sales'}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    // Gelingt das Fenster, bleibt der Link ungenutzt; gelingt
                    // es nicht, öffnet er einen Tab. Die Fläche navigiert in
                    // keinem der beiden Fälle.
                    if (oeffneAlsFenster(z.field, `${basis}${z.ziel ?? '/sales'}`, alsWallpaper)) {
                      e.preventDefault()
                    }
                  }}
                  aria-label={`${z.label} in Uriel öffnen`}
                  title={`${z.label} öffnen`}
                >
                  {/* Ein Pfeil nach rechts oben: derselbe Handgriff wie „öffnet
                      woanders" in der Spalte Offen, nur als Knopf. */}
                  <svg viewBox="0 0 14 14" aria-hidden>
                    <path d="M4.5 9.5 9.5 4.5M5.5 4.5h4v4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
            </div>
            {/* Die Offen-Zahl steht unter dem Namen, nicht dahinter: im Namen
                wurde sie von der Spaltenbreite abgeschnitten, und eine Zahl,
                die als „(1…" endet, ist schlimmer als keine. */}
            {typeof z.offen === 'number' && z.offen > 0 ? (
              <span className="amb-zaehler-offen">{z.offen.toLocaleString('de-DE')} warten</span>
            ) : null}
            {anteil !== null ? (
              <div className="amb-balken" aria-hidden>
                <span style={{ width: `${Math.round(anteil * 100)}%` }} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
