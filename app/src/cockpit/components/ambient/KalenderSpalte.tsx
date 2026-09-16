/**
 * Spalte 3 der Ambient-Fläche: das Monatsblatt (10.09.2026).
 *
 * Der Mini-Kalender ist bewusst stumm — er zeigt, wo im Monat wir stehen, und
 * markiert Tage mit Terminen. Ein voller Monat mit Titeln wäre der Tagesverlauf
 * noch einmal, nur kleiner.
 *
 * **Die Tageszahl steht seit dem 10.09. in dieser Spalte** — vorher lag sie
 * frei über der ganzen Fläche, rechts unten. Sie bleibt, was sie war: eine
 * Riesenziffer als Grafik, kein Datum zum Ablesen. Nur der *Ort* hat sich
 * geändert, nicht die Größe; sie sitzt jetzt am unteren Ende des Monatsblatts,
 * zu dem sie gehört. Ihre Größe ist zusätzlich an die Spaltenbreite gekoppelt
 * (`cqw`), weil die Spalte ziehbar ist und eine feste Ziffer sonst beim
 * Schmalerziehen abgeschnitten würde.
 *
 * Die Bestandszahlen (versandfertig, Kontakte, Einladungen) sind im Gegenzug
 * zum Tageszähler gewandert (`BestandZeile`), wo sie thematisch hingehören.
 *
 * Die Woche beginnt montags: deutsche Konvention, und Kevins Wochenziele
 * laufen Mo–So (`goals.ts`).
 */
export function KalenderSpalte({
  jetzt,
  tageMitTerminen,
  basis,
}: {
  jetzt: Date
  /** Tagesnummern des laufenden Monats, an denen etwas ansteht. */
  tageMitTerminen: Set<number>
  basis: string
}) {
  const jahr = jetzt.getFullYear()
  const monat = jetzt.getMonth()
  const heute = jetzt.getDate()

  const ersterWochentag = (new Date(jahr, monat, 1).getDay() + 6) % 7 // Mo = 0
  const tageImMonat = new Date(jahr, monat + 1, 0).getDate()
  const zellen: (number | null)[] = [
    ...Array.from({ length: ersterWochentag }, () => null),
    ...Array.from({ length: tageImMonat }, (_, i) => i + 1),
  ]

  return (
    <div className="amb-kalenderblock">
      <a className="amb-kalender" href={`${basis}/termine`} target="_blank" rel="noreferrer">
        <div className="amb-kal-kopf" aria-hidden>
          {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((t, i) => (
            <span key={`${t}-${i}`}>{t}</span>
          ))}
        </div>
        <div className="amb-kal-raster">
          {zellen.map((tag, i) => {
            if (tag === null) return <span key={`leer-${i}`} />
            const klassen = [
              'amb-kal-tag',
              tag === heute ? 'amb-kal-heute' : '',
              tageMitTerminen.has(tag) ? 'amb-kal-punkt' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <span key={tag} className={klassen}>
                {tag}
              </span>
            )
          })}
        </div>
      </a>

      <span className="amb-tageszahl" aria-hidden>
        {heute}
      </span>
    </div>
  )
}
