import { loadList } from './storage'
import type {
  ClientDocumentLink,
  DeliverProject,
  DeliverProjectStage,
} from '../types/db'
import { DELIVER_STAGE_ORDER } from '../types/db'

const STORAGE_KEY = 'deliver-projects' as const

export function emptyTiptapDoc(): Record<string, unknown> {
  return { type: 'doc', content: [] }
}

function validStage(v: unknown): DeliverProjectStage {
  if (typeof v === 'string' && (DELIVER_STAGE_ORDER as readonly string[]).includes(v)) {
    return v as DeliverProjectStage
  }
  return 'onboarding'
}

function parseClientDocuments(raw: unknown): ClientDocumentLink[] {
  if (!Array.isArray(raw)) return []
  const out: ClientDocumentLink[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label : ''
    const url = typeof o.url === 'string' ? o.url : ''
    if (label || url) out.push({ label: label || url || 'Link', url: url || '#' })
  }
  return out
}

function isDocJson(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Normalisiert gespeicherte Projekte (neu oder Legacy localStorage). */
export function normalizeDeliverProject(
  input: Partial<DeliverProject> & { id: string },
  brandKey: string,
): DeliverProject {
  const now = new Date().toISOString()
  const doc = isDocJson(input.internal_notes_doc)
    ? input.internal_notes_doc
    : emptyTiptapDoc()
  return {
    id: input.id,
    brand_id: input.brand_id ?? brandKey,
    name: input.name ?? 'Projekt',
    client_name: input.client_name ?? '',
    client_contact_id: input.client_contact_id ?? null,
    status: input.status === 'completed' ? 'completed' : 'active',
    internal_stage: validStage(input.internal_stage),
    client_stage: validStage(input.client_stage),
    internal_notes_doc: doc,
    internal_file_links: Array.isArray(input.internal_file_links)
      ? input.internal_file_links.filter((x): x is string => typeof x === 'string')
      : [],
    team_notes: input.team_notes ?? '',
    client_welcome_text: input.client_welcome_text ?? '',
    client_documents: parseClientDocuments(input.client_documents),
    updated_at: input.updated_at ?? now,
  }
}

export function coerceStoredDeliverItem(
  item: unknown,
  brandSlug: string,
): DeliverProject | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  if (typeof o.id !== 'string') return null

  if ('internal_notes_doc' in o && o.internal_notes_doc !== undefined) {
    return normalizeDeliverProject(
      {
        id: o.id,
        brand_id: typeof o.brand_id === 'string' ? o.brand_id : brandSlug,
        name: typeof o.name === 'string' ? o.name : 'Projekt',
        client_name: typeof o.client_name === 'string' ? o.client_name : '',
        client_contact_id:
          o.client_contact_id === null || typeof o.client_contact_id === 'string'
            ? (o.client_contact_id as string | null)
            : null,
        status: o.status === 'completed' ? 'completed' : 'active',
        internal_stage: validStage(o.internal_stage),
        client_stage: validStage(o.client_stage),
        internal_notes_doc: o.internal_notes_doc as Record<string, unknown>,
        internal_file_links: o.internal_file_links as string[] | undefined,
        team_notes: typeof o.team_notes === 'string' ? o.team_notes : '',
        client_welcome_text:
          typeof o.client_welcome_text === 'string' ? o.client_welcome_text : '',
        client_documents: o.client_documents as ClientDocumentLink[] | undefined,
        updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
      },
      brandSlug,
    )
  }

  const internal = typeof o.internal_notes === 'string' ? o.internal_notes : ''
  const clientArea = typeof o.client_area_notes === 'string' ? o.client_area_notes : ''
  const doc =
    internal.trim() !== ''
      ? {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: internal }],
            },
          ],
        }
      : emptyTiptapDoc()

  return normalizeDeliverProject(
    {
      id: o.id,
      name: typeof o.name === 'string' ? o.name : 'Projekt',
      client_contact_id:
        o.client_contact_id === null || typeof o.client_contact_id === 'string'
          ? (o.client_contact_id as string | null)
          : null,
      status: o.status === 'completed' ? 'completed' : 'active',
      internal_notes_doc: doc,
      client_welcome_text: clientArea,
    },
    brandSlug,
  )
}

export function findDeliverProjectInStorage(
  projectId: string,
  brandSlugs: string[],
): { slug: string; project: DeliverProject } | null {
  for (const slug of brandSlugs) {
    const raw = loadList<unknown>([slug, STORAGE_KEY])
    for (const item of raw) {
      const p = coerceStoredDeliverItem(item, slug)
      if (p && p.id === projectId) return { slug, project: p }
    }
  }
  return null
}

export function findDeliverProjectForPortal(
  projectId: string,
  brandSlugs: string[],
): DeliverProject | null {
  return findDeliverProjectInStorage(projectId, brandSlugs)?.project ?? null
}

export function rowRecordToDeliverProject(
  row: Record<string, unknown>,
): DeliverProject {
  const owner = row.owner_brand_id as string
  return normalizeDeliverProject(
    {
      id: row.id as string,
      brand_id: owner,
      name: (row.name as string) ?? '',
      client_name: (row.client_name as string) ?? '',
      client_contact_id: (row.client_contact_id as string | null) ?? null,
      status: row.status === 'completed' ? 'completed' : 'active',
      internal_stage: validStage(row.internal_stage),
      client_stage: validStage(row.client_stage),
      internal_notes_doc: isDocJson(row.internal_notes_doc)
        ? row.internal_notes_doc
        : emptyTiptapDoc(),
      internal_file_links: Array.isArray(row.internal_file_links)
        ? (row.internal_file_links as string[])
        : [],
      team_notes: (row.team_notes as string) ?? '',
      client_welcome_text: (row.client_welcome_text as string) ?? '',
      client_documents: parseClientDocuments(row.client_documents),
      updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    },
    owner,
  )
}

export function deliverProjectToInsertRow(
  p: DeliverProject,
  brandUuid: string,
): Record<string, unknown> {
  return {
    id: p.id,
    owner_brand_id: brandUuid,
    name: p.name,
    client_contact_id: p.client_contact_id,
    status: p.status,
    internal_notes: '',
    client_area_notes: '',
    client_name: p.client_name,
    internal_stage: p.internal_stage,
    client_stage: p.client_stage,
    internal_notes_doc: p.internal_notes_doc,
    internal_file_links: p.internal_file_links,
    team_notes: p.team_notes,
    client_welcome_text: p.client_welcome_text,
    client_documents: p.client_documents,
    updated_at: p.updated_at,
  }
}

export function deliverProjectToUpdateRow(
  patch: Partial<Omit<DeliverProject, 'id' | 'brand_id'>>,
  updatedAt: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: updatedAt }
  const keys = [
    'name',
    'client_name',
    'client_contact_id',
    'status',
    'internal_stage',
    'client_stage',
    'internal_notes_doc',
    'internal_file_links',
    'team_notes',
    'client_welcome_text',
    'client_documents',
  ] as const
  for (const k of keys) {
    if (patch[k] !== undefined) out[k] = patch[k]
  }
  return out
}
