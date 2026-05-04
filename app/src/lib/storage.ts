const NAMESPACE = 'brand-os'

function fullKey(parts: string[]): string {
  return [NAMESPACE, ...parts].join(':')
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadList<T>(parts: string[]): T[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(fullKey(parts))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function saveList<T>(parts: string[], items: T[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(fullKey(parts), JSON.stringify(items))
  } catch {
    // Storage quota or privacy mode — swallow, caller sees no-op.
  }
}

export function loadOne<T>(parts: string[]): T | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(fullKey(parts))
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveOne<T>(parts: string[], item: T | null): void {
  if (!isBrowser()) return
  try {
    if (item === null) {
      window.localStorage.removeItem(fullKey(parts))
    } else {
      window.localStorage.setItem(fullKey(parts), JSON.stringify(item))
    }
  } catch {
    // no-op
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
