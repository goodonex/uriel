import { useEffect, useState } from 'react'
import { RUNNER_BASE_URL } from './useRunnerStatus'

/**
 * Social-Content (Cockpit /content): die wöchentlichen Content-Batches der
 * Content-Engine (Montags-Lauf). Quelle = 04_social/content-engine/weekly/<KW>/
 * woche-<KW>.html (self-contained), gelesen über den lokalen Runner.
 */
export interface SocialWeek {
  week: string // "2026-W29"
  title: string
  htmlPath: string // rel zu SOCIAL_ROOT (für /files/social/)
  mtime: number
  postsCount: number
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${RUNNER_BASE_URL}${path}`, { cache: 'no-store' })
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Runner-Fehler ${res.status}`)
  return body
}

export async function fetchSocialWeeks(): Promise<SocialWeek[]> {
  const { weeks } = await req<{ weeks: SocialWeek[] }>('/social/weeks')
  return weeks
}

/** Runner-URL der self-contained Wochen-HTML (segmentweise encoden). */
export function socialFileUrl(htmlPath: string): string {
  const encoded = htmlPath.split('/').map(encodeURIComponent).join('/')
  return `${RUNNER_BASE_URL}/files/social/${encoded}`
}

// ---------- „Gesehen"-Status (neu-Badge + Nav-Punkt), lokal ----------
const SEEN_KEY = 'cockpit.socialSeenWeeks'
const SEEN_EVENT = 'social-seen-changed'

export function getSeenWeeks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export function markWeekSeen(week: string): void {
  try {
    const seen = getSeenWeeks()
    if (seen.has(week)) return
    seen.add(week)
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
    window.dispatchEvent(new Event(SEEN_EVENT))
  } catch {
    /* ohne localStorage kein Persist — unkritisch */
  }
}

/** Anzahl noch nicht gesichteter Wochen — für den Nav-Badge („Meldung oben"). */
export function useSocialUnread(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const load = () =>
      fetchSocialWeeks()
        .then((weeks) => {
          if (!alive) return
          const seen = getSeenWeeks()
          setCount(weeks.filter((w) => !seen.has(w.week)).length)
        })
        .catch(() => {
          if (alive) setCount(0) // Runner aus → kein Badge, kein Lärm
        })
    load()
    const onSeen = () => load()
    window.addEventListener(SEEN_EVENT, onSeen)
    const iv = window.setInterval(load, 60_000)
    return () => {
      alive = false
      window.removeEventListener(SEEN_EVENT, onSeen)
      clearInterval(iv)
    }
  }, [])
  return count
}
