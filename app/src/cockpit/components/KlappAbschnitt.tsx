import type { ReactNode } from 'react'
import { useUiSetting } from '../lib/uiSettings'

/**
 * Ein Abschnitt mit Kopfzeile, der sich auf- und zuklappen lässt (25.09.2026).
 *
 * Kevin: *„Die gebauten Seiten würde ich ganz gerne einklappen können."* —
 * und dasselbe Muster trägt seitdem die OS-Karte und die Agenten im Cockpit.
 * Der Zustand liegt in `ui_settings`, damit er Geräte und das Neu-Hinzufügen
 * der PWA überlebt. **`=== true` statt Truthiness:** Der Wert kommt aus einer
 * Key-Value-Tabelle und war dort schon alles Mögliche.
 */
export function KlappAbschnitt({
  schluessel,
  titel,
  zusatz,
  standardOffen = false,
  rechts,
  children,
}: {
  /** Schlüssel in `ui_settings` — je Abschnitt eindeutig. */
  schluessel: string
  titel: string
  /** Kleine Angabe hinter dem Titel, z. B. eine Anzahl. */
  zusatz?: ReactNode
  standardOffen?: boolean
  /** Bedienelement rechts in der Kopfzeile (bleibt auch zugeklappt sichtbar). */
  rechts?: ReactNode
  children: ReactNode
}) {
  const { wert, setzen } = useUiSetting<boolean>(schluessel, standardOffen)
  const offen = wert === true
  const id = `ck-klapp-${schluessel.replace(/[^a-z0-9]+/gi, '-')}`

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}>
        <button
          type="button"
          className="ck-klapp-kopf"
          aria-expanded={offen}
          aria-controls={id}
          onClick={() => setzen(!offen)}
        >
          <span aria-hidden className="ck-klapp-pfeil" data-offen={offen ? 'true' : undefined}>
            ›
          </span>
          <span className="ck-label" style={{ color: 'var(--ck-text-2)' }}>
            {titel}
          </span>
          {zusatz != null ? (
            <span className="ck-zahl" style={{ fontSize: 11.5, color: 'var(--ck-text-3)' }}>
              {zusatz}
            </span>
          ) : null}
        </button>
        {rechts ? <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{rechts}</span> : null}
      </div>
      {offen ? (
        <div id={id} style={{ marginTop: 6 }}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
