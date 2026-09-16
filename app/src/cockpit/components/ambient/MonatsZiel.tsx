import { formatEuro } from '../../lib/goals'

/**
 * Das Monatsziel am Fuß der ersten Spalte (11.09.2026).
 *
 * **Warum es die Fläche vorher nicht hatte und jetzt haben muss.** Der
 * Schreibtisch zeigte, was heute zu tun ist, und wie viele Kontakte im Netz
 * hängen — aber nicht, wofür das alles geschieht. Kevins Monatsziel ist die
 * einzige Zahl, an der am Monatsende gemessen wird; sie stand auf einer Fläche,
 * die den ganzen Tag vor ihm steht, nirgends.
 *
 * **Unten links, gegenüber der Tageszahl.** Die Riesenziffer sitzt am Fuß der
 * dritten Spalte; ein zweiter Anker am Fuß der ersten gibt der Fläche unten
 * zwei Gewichte statt eines. Darüber hört die Befundliste auf, dort ist Platz —
 * und im Foto steht an dieser Stelle der dunkle Hang, der Schrift trägt.
 *
 * **Der Soll-Vergleich entscheidet die Farbe, nicht der Absolutwert.** „18.000
 * von 50.000" allein sagt am 11. nichts; erst „du müsstest bei 15.000 sein"
 * macht daraus eine Lage. Liegt der Ist-Wert darunter, wird der Balken
 * gedämpftes Gold — die Tokens kennen dafür `--ck-warn`. **Nie Rot**, auch
 * hier nicht: das ist eine eingefrorene Design-Entscheidung
 * (`docs/phase2/DESIGN-TOKENS.md`).
 */
export function MonatsZiel({
  ist,
  ziel,
  sollHeute,
  basis,
}: {
  ist: number
  ziel: number
  /** Was laut Monatskurve bis heute stehen sollte. */
  sollHeute: number
  basis: string
}) {
  if (ziel <= 0) return null

  const anteil = Math.min(1, Math.max(0, ist / ziel))
  const sollAnteil = Math.min(1, Math.max(0, sollHeute / ziel))
  const hinten = ist < sollHeute

  return (
    <a
      className={`amb-monat${hinten ? ' amb-monat-hinten' : ''}`}
      href={`${basis}/tracking`}
      target="_blank"
      rel="noreferrer"
    >
      <span className="amb-monat-zahl">{formatEuro(ist)}</span>
      <span className="amb-monat-von">von {formatEuro(ziel)}</span>

      <span className="amb-monat-balken" aria-hidden>
        <span className="amb-monat-fuellung" style={{ width: `${anteil * 100}%` }} />
        {/* Die Soll-Marke steht IM Balken, nicht daneben: so liest man in einem
            Blick, ob man davor oder dahinter ist, ohne zwei Zahlen zu
            vergleichen. */}
        <span className="amb-monat-soll" style={{ left: `${sollAnteil * 100}%` }} />
      </span>

      <span className="amb-monat-lage">
        {hinten
          ? `${formatEuro(sollHeute - ist)} hinter Plan`
          : `${formatEuro(ist - sollHeute)} vor Plan`}
      </span>
    </a>
  )
}
