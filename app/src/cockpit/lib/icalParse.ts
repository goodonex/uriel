/**
 * Minimaler iCal-Parser (RFC 5545, das Nötige) für die Kalender-Sync im /termine.
 * Holt der Runner als Rohtext (CORS-Proxy); hier wird geparst — pure & testbar.
 * Bewusst NICHT unterstützt in v1: RRULE-Expansion (wiederkehrende Termine
 * erscheinen nur zu ihrem ersten Datum) und echte TZID-Umrechnung (TZID-Zeiten
 * werden als Wandzeit übernommen; nur explizite UTC-„Z"-Zeiten werden lokalisiert).
 */

export interface CalendarEvent {
  id: string
  title: string
  /** YYYY-MM-DD */
  date: string
  /** HH:MM, fehlt bei Ganztags-Terminen */
  time?: string
  allDay: boolean
}

/** RFC-5545-Line-Folding auflösen: Fortsetzungszeilen beginnen mit Space/Tab. */
function unfold(text: string): string[] {
  const raw = text.split(/\r?\n/)
  const lines: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** DTSTART-Zeile (inkl. Parameter) → date/time/allDay. */
function parseDtStart(line: string): { date: string; time?: string; allDay: boolean } | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const params = line.slice(0, colon)
  const val = line.slice(colon + 1).trim()
  const m = val.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/)
  if (!m) return null
  const [, y, mo, d, hh, mi, , z] = m
  const isDate = /VALUE=DATE\b/i.test(params) || !hh
  if (isDate) return { date: `${y}-${mo}-${d}`, allDay: true }
  if (z) {
    // UTC → lokale Zeit
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, 0))
    const p2 = (n: number) => String(n).padStart(2, '0')
    return {
      date: `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`,
      time: `${p2(dt.getHours())}:${p2(dt.getMinutes())}`,
      allDay: false,
    }
  }
  // Floating / TZID: als Wandzeit übernehmen (keine TZ-Bibliothek in v1)
  return { date: `${y}-${mo}-${d}`, time: `${hh}:${mi}`, allDay: false }
}

export function parseIcal(text: string): CalendarEvent[] {
  if (!text) return []
  const lines = unfold(text)
  const events: CalendarEvent[] = []
  let inEvent = false
  let summary = ''
  let uid = ''
  let dtStartLine = ''

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      summary = ''
      uid = ''
      dtStartLine = ''
      continue
    }
    if (line === 'END:VEVENT') {
      if (inEvent && dtStartLine) {
        const dt = parseDtStart(dtStartLine)
        if (dt) {
          events.push({
            id: uid || `${dt.date}-${summary}`,
            title: unescapeText(summary) || '(ohne Titel)',
            date: dt.date,
            time: dt.time,
            allDay: dt.allDay,
          })
        }
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const name = line.slice(0, colon).split(';')[0].toUpperCase()
    if (name === 'DTSTART') dtStartLine = line
    else if (name === 'SUMMARY') summary = line.slice(colon + 1)
    else if (name === 'UID') uid = line.slice(colon + 1)
  }
  return events
}
