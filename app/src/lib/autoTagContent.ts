import type { ContentPieceTags, ICP, WordBankEntry } from '../types/db'

function collectText(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return
  const n = node as Record<string, unknown>
  if (n.type === 'text' && typeof n.text === 'string') {
    out.push(n.text)
  }
  if (Array.isArray(n.content)) {
    for (const c of n.content) collectText(c, out)
  }
}

/** Rohtext aus Tiptap-JSON für einfaches Keyword-Matching. */
export function tiptapPlainText(doc: Record<string, unknown>): string {
  const parts: string[] = []
  collectText(doc, parts)
  return parts.join(' ')
}

export interface AutoTagSuggestion {
  icp_ids: string[]
  cluster_tags: string[]
}

/**
 * Heuristische Vorschläge aus Foundation (ICP-Namen, Word-Bank-Cluster).
 * Kein externes NLP — bewusst simpel für Phase 4.
 */
export function suggestContentTags(
  icps: ICP[],
  wordBank: WordBankEntry[],
  title: string,
  contentDoc: Record<string, unknown>,
): AutoTagSuggestion {
  const body = `${title} ${tiptapPlainText(contentDoc)}`.toLowerCase()
  const icp_ids: string[] = []
  for (const icp of icps) {
    const needle = icp.name.trim().toLowerCase()
    if (needle.length >= 3 && body.includes(needle)) {
      icp_ids.push(icp.id)
    }
  }
  const clusters = new Set<string>()
  for (const w of wordBank) {
    const word = w.word.trim().toLowerCase()
    if (word.length >= 3 && body.includes(word)) {
      clusters.add(w.cluster.trim() || 'Allgemein')
    }
  }
  return {
    icp_ids: [...new Set(icp_ids)],
    cluster_tags: [...clusters],
  }
}

export function mergeTagsIntoPieceTags(
  current: ContentPieceTags,
  suggestion: AutoTagSuggestion,
): ContentPieceTags {
  return {
    ...current,
    icp_ids: [...new Set([...current.icp_ids, ...suggestion.icp_ids])],
    cluster_tags: [
      ...new Set([...current.cluster_tags, ...suggestion.cluster_tags]),
    ],
  }
}
