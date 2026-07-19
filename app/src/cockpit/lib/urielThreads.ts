import { generateId } from '../../lib/storage'
import type { UrielAction, UrielMessage } from './urielAgent'

/**
 * Persistente Uriel-Chats (IDEAS-2026 Jarvis Phase C, v1 localStorage).
 * Threads überleben das Schließen des Docks + Reloads (pro Gerät). Wir speichern
 * beides: die rohe Agenten-History (`messages`, um das Gespräch fortzusetzen) und
 * die Anzeige-Turns (`turns`, zum Rendern). Supabase-Sync über Geräte = v2.
 */

const KEY = 'uriel.threads'
const MAX_THREADS = 40

export interface UrielStoredTurn {
  role: 'user' | 'uriel'
  text: string
  actions?: UrielAction[]
}

export interface UrielThread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: UrielMessage[]
  turns: UrielStoredTurn[]
}

function read(): UrielThread[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as UrielThread[]) : []
  } catch {
    return []
  }
}

function write(threads: UrielThread[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(threads.slice(0, MAX_THREADS)))
  } catch {
    /* ohne localStorage nur diese Session */
  }
}

/** Threads, neueste zuerst. */
export function loadThreads(): UrielThread[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadThread(id: string): UrielThread | null {
  return read().find((t) => t.id === id) ?? null
}

export function createThread(): UrielThread {
  const now = Date.now()
  const thread: UrielThread = {
    id: generateId(),
    title: 'Neuer Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    turns: [],
  }
  write([thread, ...read()])
  return thread
}

export function deleteThread(id: string): void {
  write(read().filter((t) => t.id !== id))
}

function titleFrom(turns: UrielStoredTurn[]): string {
  const firstUser = turns.find((t) => t.role === 'user')?.text?.trim()
  if (!firstUser) return 'Neuer Chat'
  return firstUser.length > 42 ? `${firstUser.slice(0, 42)}…` : firstUser
}

/** Inhalt eines Threads aktualisieren (History + Anzeige) + Titel aus erster Frage. */
export function saveThreadContent(
  id: string,
  messages: UrielMessage[],
  turns: UrielStoredTurn[],
): UrielThread[] {
  const threads = read()
  const idx = threads.findIndex((t) => t.id === id)
  const now = Date.now()
  if (idx === -1) {
    threads.unshift({ id, title: titleFrom(turns), createdAt: now, updatedAt: now, messages, turns })
  } else {
    threads[idx] = {
      ...threads[idx],
      messages,
      turns,
      title: titleFrom(turns),
      updatedAt: now,
    }
  }
  write(threads)
  return loadThreads()
}
