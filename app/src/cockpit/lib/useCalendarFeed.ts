import { useEffect, useState } from 'react'
import { fetchCalendar } from './runnerApi'
import { parseIcal, type CalendarEvent } from './icalParse'

export const CALENDAR_ICAL_KEY = 'ck.calendar.ical'

/**
 * Kalender-Feed für /termine: lädt die konfigurierte iCal-URL über den Runner
 * und parst sie. Leerer URL → keine Events, kein Fehler.
 */
export function useCalendarFeed(icalUrl: string | null): {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
} {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!icalUrl) {
      setEvents([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCalendar(icalUrl)
      .then((text) => {
        if (!cancelled) setEvents(parseIcal(text))
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kalender nicht erreichbar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [icalUrl])

  return { events, loading, error }
}
