import { supabase } from './supabase'

/**
 * Datei-Sharing fürs Kundenportal (Bucket `project-files`, Migration 0051).
 * Pfad-Konvention: <projectId>/<timestamp>-<dateiname>. RLS regelt Zugriff
 * (Owner voll, Client nur eigenes Projekt, kein Client-Delete).
 */

export interface ProjectFile {
  /** voller Storage-Pfad (projectId/name) */
  path: string
  name: string
  size: number
  createdAt: string
}

const BUCKET = 'project-files'

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 120)
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  if (!supabase) return []
  const { data, error } = await supabase.storage.from(BUCKET).list(projectId, {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })
  if (error) throw new Error(error.message)
  return (data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({
      path: `${projectId}/${f.name}`,
      name: f.name.replace(/^\d{13}-/, ''),
      size: (f.metadata as { size?: number } | null)?.size ?? 0,
      createdAt: f.created_at ?? '',
    }))
}

export async function uploadProjectFile(projectId: string, file: File): Promise<ProjectFile> {
  if (!supabase) throw new Error('Verbindung nicht konfiguriert.')
  const path = `${projectId}/${Date.now()}-${sanitizeFileName(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return {
    path,
    name: file.name,
    size: file.size,
    createdAt: new Date().toISOString(),
  }
}

/** Privater Bucket → Download über signierte URL (1h gültig). */
export async function getProjectFileUrl(path: string): Promise<string> {
  if (!supabase) throw new Error('Verbindung nicht konfiguriert.')
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Signierte URL fehlgeschlagen')
  return data.signedUrl
}

export async function deleteProjectFile(path: string): Promise<void> {
  if (!supabase) throw new Error('Verbindung nicht konfiguriert.')
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
