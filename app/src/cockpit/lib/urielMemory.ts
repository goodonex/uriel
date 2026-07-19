import { generateId } from '../../lib/storage'

/**
 * Uriels „remember"-Gedächtnis (Jarvis Phase C, v1 localStorage): kurze Fakten
 * über Kevin/seine Arbeit, die Uriel selbst über das `remember`-Werkzeug ablegt
 * und die pro Zug in den System-Kontext eingespeist werden. Inspizierbar &
 * löschbar (Transparenz). Supabase-Sync = v2.
 */

const KEY = 'uriel.memory'
const MAX_FACTS = 60

export interface UrielFact {
  id: string
  text: string
  createdAt: number
}

export function loadMemory(): UrielFact[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as UrielFact[]) : []
  } catch {
    return []
  }
}

function write(facts: UrielFact[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(facts.slice(-MAX_FACTS)))
  } catch {
    /* ignore */
  }
}

/** Fakt merken; Duplikate (gleicher Text) werden ignoriert. */
export function addMemory(text: string): UrielFact[] {
  const t = text.trim()
  const facts = loadMemory()
  if (!t || facts.some((f) => f.text.toLowerCase() === t.toLowerCase())) return facts
  const next = [...facts, { id: generateId(), text: t, createdAt: Date.now() }]
  write(next)
  return next
}

export function removeMemory(id: string): UrielFact[] {
  const next = loadMemory().filter((f) => f.id !== id)
  write(next)
  return next
}

export function memoryTexts(): string[] {
  return loadMemory().map((f) => f.text)
}
