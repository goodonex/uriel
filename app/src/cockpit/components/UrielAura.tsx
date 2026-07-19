import { useUrielBus } from '../../store/urielBus'

/**
 * UrielAura — die sichtbare Präsenz von Uriel. Sobald der Uriel-Modus aktiv ist,
 * legt sich ein pulsierender Nebel-Schein über das Cockpit (ruhig im Leerlauf,
 * stärker beim Zuhören/Arbeiten) — der „Jarvis wacht auf"-Effekt. Rein
 * atmosphärisch: pointer-events none, respektiert prefers-reduced-motion.
 */
export function UrielAura() {
  const open = useUrielBus((s) => s.open)
  const phase = useUrielBus((s) => s.phase)
  return (
    <div
      className={`ck-uriel-aura${open ? ' is-open' : ''}`}
      data-phase={phase}
      aria-hidden="true"
    />
  )
}
