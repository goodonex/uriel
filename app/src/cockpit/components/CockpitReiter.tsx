import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AufgabenArea } from '../pages/AufgabenArea'
import { FreigabenArea } from '../pages/FreigabenArea'
import { TermineArea } from '../pages/TermineArea'
import { istReiter, type CockpitReiterId } from '../lib/cockpitReiter'

/**
 * „Heute" und Agenten als Reiter im Cockpit (25.09.2026).
 *
 * Kevin: *„Die Heute-Seite benutze ich fast gar nicht. Ich glaube, das könnte
 * viel eher ins Cockpit rein … Agenten und Heute einfach ins Cockpit
 * reinholen."* Die Reiter-Wahl steht in der Adresse (`/cockpit?heute=termine`),
 * damit die alten Adressen `/aufgaben`, `/termine`, `/freigaben` und
 * `/agenten` — Push-Links, Kacheln, Lesezeichen — genau hier landen.
 */

const REITER: { id: CockpitReiterId; label: string }[] = [
  { id: 'aufgaben', label: 'Aufgaben' },
  { id: 'termine', label: 'Termine' },
  { id: 'freigaben', label: 'Freigaben' },
  { id: 'agenten', label: 'Agenten' },
]

export function CockpitReiter({ agenten }: { agenten: ReactNode }) {
  const [params, setParams] = useSearchParams()
  const roh = params.get('heute')
  const aktiv: CockpitReiterId = istReiter(roh) ? roh : 'aufgaben'

  return (
    <section aria-label="Heute" style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div className="ck-segmente" role="tablist" aria-label="Heute">
        {REITER.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            className="ck-segment"
            aria-selected={r.id === aktiv}
            onClick={() => {
              const neu = new URLSearchParams(params)
              neu.set('heute', r.id)
              setParams(neu, { replace: true })
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ minWidth: 0 }}>
        {aktiv === 'aufgaben' ? <AufgabenArea /> : null}
        {aktiv === 'termine' ? <TermineArea /> : null}
        {aktiv === 'freigaben' ? <FreigabenArea /> : null}
        {aktiv === 'agenten' ? agenten : null}
      </div>
    </section>
  )
}

/** Alte Adresse → passender Reiter im Cockpit. Suchparameter reisen mit. */
export function ZumCockpitReiter({ reiter }: { reiter: CockpitReiterId }) {
  const loc = useLocation()
  const params = new URLSearchParams(loc.search)
  params.set('heute', reiter)
  return <Navigate to={`/cockpit?${params.toString()}${loc.hash}`} replace />
}
