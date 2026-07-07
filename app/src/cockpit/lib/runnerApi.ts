import { RUNNER_BASE_URL } from './useRunnerStatus'

export interface RunSummary {
  id: string
  agent: string
  status: 'running' | 'done' | 'error'
  started: string
  finished: string
  preview: string
}

export interface RunDetail extends RunSummary {
  content: string
}

export interface VaultNote {
  path: string
  name: string
  mtime: number
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RUNNER_BASE_URL}${path}`, init)
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Runner-Fehler ${res.status}`)
  return body
}

export function postRun(agent: string, input?: Record<string, unknown>) {
  return req<{ id: string; agent: string; startedAt: string }>('/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, input }),
  })
}

export async function fetchRuns(limit = 20): Promise<RunSummary[]> {
  const { runs } = await req<{ runs: RunSummary[] }>(`/runs?limit=${limit}`)
  return runs
}

export function fetchRun(id: string): Promise<RunDetail> {
  return req<RunDetail>(`/runs/${encodeURIComponent(id)}`)
}

export async function fetchVaultRecent(limit = 15): Promise<VaultNote[]> {
  const { notes } = await req<{ notes: VaultNote[] }>(`/vault/recent?limit=${limit}`)
  return notes
}

export interface VaultGraphNode {
  path: string
  name: string
  /** Anzahl Wikilink-Verbindungen */
  links: number
}

export interface VaultGraph {
  nodes: VaultGraphNode[]
  edges: Array<{ source: string; target: string }>
}

export function fetchVaultGraph(): Promise<VaultGraph> {
  return req<VaultGraph>('/vault/graph')
}

/** Obsidian-URL für eine Vault-Notiz (Vault-Name: Second Brain). */
export function obsidianUrl(notePath: string): string {
  return `obsidian://open?vault=${encodeURIComponent('Second Brain')}&file=${encodeURIComponent(notePath.replace(/\.md$/, ''))}`
}

/**
 * Öffnet eine obsidian://-URL, ohne die SPA-Navigation anzufassen.
 * (window.open mit '_self' hängte die App auf, wenn das Protokoll
 * blockiert wird — z.B. im Preview-Panel.)
 */
export function openInObsidian(notePath: string): void {
  const a = document.createElement('a')
  a.href = obsidianUrl(notePath)
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
