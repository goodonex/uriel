import { ANFRAGEN_PAUSE, anfragenPauseAktiv, type AnfragenPause } from './tagesFlow'
import { useMetrikTag } from './useMetrikTag'
import { useUiSetting } from './uiSettings'

/**
 * Kevins Knopf „Wochenlimit aufgebraucht" (02.10.2026): LinkedIn lässt in der
 * Woche rund 200 Anfragen zu. Ist das Limit durch, soll Uriel für den Rest der
 * Woche keine neuen Anfragen mehr verlangen oder vorschlagen — auch wenn der
 * Tageszähler erst bei 35 von 40 steht. Ab Montag ist die Pause von selbst
 * vorbei. Liegt in `ui_settings`, damit sie Handy und Rechner teilen.
 */
export function useAnfragenPause(): { pausiert: boolean; pausieren: () => void; aufheben: () => void } {
  const heute = useMetrikTag()
  const { wert, setzen } = useUiSetting<AnfragenPause | null>(ANFRAGEN_PAUSE, null)
  return {
    pausiert: anfragenPauseAktiv(wert, heute),
    pausieren: () => setzen({ ab: heute }),
    aufheben: () => setzen(null),
  }
}
