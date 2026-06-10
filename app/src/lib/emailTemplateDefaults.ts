import { loadList, saveList } from './storage'
import { DEFAULT_EMAIL_TEMPLATE_SEEDS } from './seedEmailTemplates'

const REMOVED_KEY = 'email-templates-removed-defaults' as const

function removedSet(brandSlug: string): Set<string> {
  return new Set(loadList<string>([brandSlug, REMOVED_KEY]).map((n) => n.toLowerCase()))
}

export function isDefaultEmailTemplateName(name: string): boolean {
  const n = name.trim().toLowerCase()
  return DEFAULT_EMAIL_TEMPLATE_SEEDS.some((s) => s.name.toLowerCase() === n)
}

export function markDefaultEmailTemplateRemoved(brandSlug: string, name: string) {
  if (!isDefaultEmailTemplateName(name)) return
  const n = name.trim().toLowerCase()
  const cur = loadList<string>([brandSlug, REMOVED_KEY])
  if (cur.some((x) => x.toLowerCase() === n)) return
  saveList([brandSlug, REMOVED_KEY], [...cur, n])
}

export function defaultEmailSeedsToCreate(brandSlug: string, existingNames: string[]): typeof DEFAULT_EMAIL_TEMPLATE_SEEDS {
  const existing = new Set(existingNames.map((n) => n.toLowerCase()))
  const removed = removedSet(brandSlug)
  return DEFAULT_EMAIL_TEMPLATE_SEEDS.filter((seed) => {
    const n = seed.name.toLowerCase()
    return !existing.has(n) && !removed.has(n)
  })
}
