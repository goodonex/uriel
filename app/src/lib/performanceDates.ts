/** Shared date helpers for performance / scorecard tracking. */

export function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfTodayMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function startOfWeekMondayMs(ref = new Date()): number {
  const d = new Date(ref)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfWeekIsoDate(ref = new Date()): string {
  const d = new Date(ref)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function startOfMonthIsoDate(ref = new Date()): string {
  const y = ref.getFullYear()
  const m = String(ref.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function isSameLocalDay(iso: string, refMs = startOfTodayMs()): boolean {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const end = refMs + 86400000 - 1
  return t >= refMs && t <= end
}

export function isInWeek(iso: string, weekStartMs = startOfWeekMondayMs()): boolean {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  return t >= weekStartMs && t < weekStartMs + 7 * 86400000
}

export function isInMonth(iso: string, monthStartIso: string): boolean {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return false
  const start = new Date(monthStartIso).getTime()
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return t >= start && t < end.getTime()
}

export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function isFriday(ref = new Date()): boolean {
  return ref.getDay() === 5
}

export function isAfterHour(hour: number, ref = new Date()): boolean {
  return ref.getHours() >= hour
}
