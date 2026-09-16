import type { AmbientKennzahl } from '../../../hooks/useAmbientKennzahlen'

/**
 * Der Bestand über dem Tageszähler (10.09.2026).
 *
 * **Wo die Zahlen herkommen und warum sie umgezogen sind.** Sie standen unter
 * dem Monatsblatt, weil dort Platz war — thematisch gehören sie aber neben den
 * Tageszähler: „140 versandfertig" ist der Vorrat, aus dem die Erstnachrichten
 * des Tages kommen, „723 Kontakte / 1064 Einladungen" der Teich, aus dem die
 * Anfragen gehen. Bestand oben, Tagesleistung darunter — das ist eine Spalte
 * mit einer Aussage statt zwei Spalten mit je einer halben.
 *
 * Quer statt untereinander: drei Zahlen in einer Zeile lesen sich als ein
 * Stand, drei Zahlen übereinander als Liste, die man durchgehen muss.
 */
export function BestandZeile({ kennzahlen, basis }: { kennzahlen: AmbientKennzahl[]; basis: string }) {
  if (kennzahlen.length === 0) return <p className="amb-still">—</p>

  return (
    <div className="amb-bestand">
      {kennzahlen.map((k) => (
        <a
          key={k.label}
          className="amb-bestand-zahl"
          href={`${basis}/linkedin`}
          target="_blank"
          rel="noreferrer"
        >
          <b>{k.wert.toLocaleString('de-DE')}</b>
          {/* „Sync offen" statt bloß des Labels: sonst steht diese Zahl neben
              einem Befund, der eine größere nennt, und beide sehen falsch aus.
              So ist klar, dass hier der letzte vollständige Stand steht. */}
          <span className={k.veraltet ? 'amb-bestand-alt' : undefined}>
            {k.veraltet ? `${k.label} · Sync offen` : k.label}
          </span>
        </a>
      ))}
    </div>
  )
}
