import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { useToast } from '../../components/Toast'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import { readDeliverProjectsLocal, useDeliverProjects } from '../../hooks/useDeliverProjects'
import type { ClientDocumentLink, DeliverProjectStage } from '../../types/db'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from './stageLabels'

const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
} as const

function InternalNotesEditor({
  doc,
  onDebouncedSave,
}: {
  doc: Record<string, unknown>
  onDebouncedSave: (next: Record<string, unknown>) => void
}) {
  const debounced = useDebouncedCallback((d: Record<string, unknown>) => {
    onDebouncedSave(d)
  }, 450)

  const editor = useEditor({
    extensions: [StarterKit],
    content: doc,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'deliver-internal-editor',
        style: 'font-family: var(--font-body); min-height: 220px; outline: none;',
      },
    },
    onUpdate: ({ editor: ed }) => {
      debounced(ed.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (!editor) return
    const a = JSON.stringify(editor.getJSON())
    const b = JSON.stringify(doc)
    if (a !== b) {
      editor.commands.setContent(doc, { emitUpdate: false })
    }
  }, [editor, doc])

  return (
    <div
      className="glass-2"
      style={{
        borderRadius: 12,
        border: '1px solid var(--glass-border-1)',
        overflow: 'hidden',
      }}
    >
      <EditorContent editor={editor} />
    </div>
  )
}

function StageKanban({
  current,
  onPick,
}: {
  current: DeliverProjectStage
  onPick: (s: DeliverProjectStage) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DELIVER_STAGE_ORDER.map((s) => {
        const active = s === current
        return (
          <button
            key={s}
            type="button"
            className="font-mono"
            onClick={() => onPick(s)}
            style={{
              flex: '1 1 100px',
              minWidth: 88,
              padding: '10px 8px',
              borderRadius: 12,
              fontSize: 10,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              border: active
                ? '2px solid var(--accent-teal)'
                : '1px solid var(--glass-border-2)',
              background: active ? 'var(--glass-4)' : 'var(--glass-1)',
              color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {DELIVER_STAGE_LABEL[s]}
          </button>
        )
      })}
    </div>
  )
}

export function ProjectPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { show } = useToast()
  const projects = useDeliverProjects(slug)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')

  useEffect(() => {
    const s = location.state as { showClientInvite?: boolean } | undefined
    if (s?.showClientInvite) {
      setInviteOpen(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, location.pathname, navigate])

  const project = useMemo(() => {
    const fromList = projects.items.find((p) => p.id === projectId) ?? null
    if (fromList) return fromList
    if (!slug || !projectId) return null
    return readDeliverProjectsLocal(slug).find((p) => p.id === projectId) ?? null
  }, [projects.items, projectId, slug])

  const [tab, setTab] = useState<'internal' | 'client'>('internal')

  const [linksText, setLinksText] = useState('')
  useEffect(() => {
    if (project) setLinksText(project.internal_file_links.join('\n'))
  }, [project?.id, project?.internal_file_links])

  const debouncedLinks = useDebouncedCallback((text: string) => {
    if (!projectId || !slug) return
    const links = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    projects.update(projectId, { internal_file_links: links })
  }, 500)

  const onLinksChange = useCallback(
    (text: string) => {
      setLinksText(text)
      debouncedLinks(text)
    },
    [debouncedLinks],
  )

  const [docs, setDocs] = useState<ClientDocumentLink[]>([])
  useEffect(() => {
    if (project) setDocs(project.client_documents)
  }, [project?.id, project?.client_documents])

  const debouncedDocs = useDebouncedCallback((next: ClientDocumentLink[]) => {
    if (!projectId) return
    projects.update(projectId, { client_documents: next })
  }, 250)

  const patchDocs = useCallback(
    (next: ClientDocumentLink[]) => {
      setDocs(next)
      debouncedDocs(next)
    },
    [debouncedDocs, projectId],
  )

  const [teamLocal, setTeamLocal] = useState('')
  const [welcomeLocal, setWelcomeLocal] = useState('')
  useEffect(() => {
    if (project) {
      setTeamLocal(project.team_notes)
      setWelcomeLocal(project.client_welcome_text)
    }
  }, [project?.id, project?.team_notes, project?.client_welcome_text])

  const debouncedTeamNotes = useDebouncedCallback((id: string, v: string) => {
    projects.update(id, { team_notes: v })
  }, 450)

  const debouncedWelcome = useDebouncedCallback((id: string, v: string) => {
    projects.update(id, { client_welcome_text: v })
  }, 450)

  if (!slug || !projectId) return <Navigate to="/" replace />

  if (!projects.loading && !projects.error && !project) {
    return <Navigate to={`/brand/${slug}/deliver`} replace />
  }

  if (projects.loading && !project) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 400,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
    )
  }

  if (!project) return null

  return (
    <motion.div
      key={projectId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    >
      <div className="mb-5">
        <Link
          to={`/brand/${slug}/deliver`}
          className="font-mono"
          style={{
            fontSize: 12,
            color: 'var(--accent-teal)',
            textDecoration: 'none',
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-2)',
          }}
        >
          ← Alle Projekte
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            Deliver
          </div>
          <h1
            className="font-display mt-1"
            style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}
          >
            {project.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="font-mono"
            onClick={() => setInviteOpen(true)}
            style={{
              fontSize: 11,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--text-primary)',
            }}
          >
            Kunden einladen
          </button>
          <button
            type="button"
            className="font-mono"
            onClick={() => {
              const origin =
                typeof window !== 'undefined' ? window.location.origin : ''
              const url = `${origin}/portal/${project.id}`
              if (!navigator.clipboard) {
                show('Clipboard nicht verfügbar', 'error')
                return
              }
              void navigator.clipboard.writeText(url).then(
                () =>
                  show(
                    'Link kopiert — teile ihn mit deinem Kunden.',
                    'success',
                  ),
                () => show('Kopieren fehlgeschlagen', 'error'),
              )
            }}
            style={{
              fontSize: 11,
              padding: '8px 14px',
              borderRadius: 10,
              border: '1px solid var(--accent-teal)',
              background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
              color: 'var(--accent-teal)',
            }}
          >
            Portal-Link kopieren
          </button>
          {(['internal', 'client'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="font-mono"
              onClick={() => setTab(t)}
              style={{
                fontSize: 11,
                padding: '8px 14px',
                borderRadius: 10,
                border:
                  tab === t
                    ? '2px solid var(--accent-teal)'
                    : '1px solid var(--glass-border-2)',
                background: tab === t ? 'var(--glass-4)' : 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
            >
              {t === 'internal' ? 'Intern' : 'Kundenbereich'}
            </button>
          ))}
        </div>
      </div>

      {projects.error ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {projects.error}
        </p>
      ) : null}

      {tab === 'internal' ? (
        <div className="flex flex-col gap-5">
          <div>
            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Interne Projekt-Stages
            </div>
            <StageKanban
              current={project.internal_stage}
              onPick={(s) => projects.update(project.id, { internal_stage: s })}
            />
          </div>
          <div>
            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Freie Notizen
            </div>
            <InternalNotesEditor
              doc={project.internal_notes_doc}
              onDebouncedSave={(d) => projects.update(project.id, { internal_notes_doc: d })}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Interne Dateien (eine URL pro Zeile)
            </label>
            <textarea
              value={linksText}
              onChange={(e) => onLinksChange(e.target.value)}
              rows={4}
              style={{ ...FIELD, resize: 'vertical', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Team-Notizen
            </label>
            <textarea
              value={teamLocal}
              onChange={(e) => {
                const v = e.target.value
                setTeamLocal(v)
                debouncedTeamNotes(project.id, v)
              }}
              rows={4}
              style={{ ...FIELD, resize: 'vertical' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Willkommenstext (sichtbar für Kunden)
            </label>
            <textarea
              value={welcomeLocal}
              onChange={(e) => {
                const v = e.target.value
                setWelcomeLocal(v)
                debouncedWelcome(project.id, v)
              }}
              rows={4}
              style={{ ...FIELD, resize: 'vertical' }}
            />
          </div>
          <div>
            <div className="font-mono mb-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Kunden-Stages (Kanban)
            </div>
            <StageKanban
              current={project.client_stage}
              onPick={(s) => projects.update(project.id, { client_stage: s })}
            />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Dokumente &amp; Links
              </span>
              <button
                type="button"
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  color: 'var(--accent-teal)',
                }}
                onClick={() =>
                  patchDocs([
                    ...docs,
                    { label: 'Neu', url: '', description: undefined },
                  ])
                }
              >
                + Zeile
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {docs.map((row, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl p-3" style={{ border: '1px solid var(--glass-border-2)' }}>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={row.label}
                      onChange={(e) => {
                        const next = docs.slice()
                        next[i] = { ...row, label: e.target.value }
                        patchDocs(next)
                      }}
                      style={{ ...FIELD, flex: 1, minWidth: 120 }}
                    />
                    <input
                      type="text"
                      placeholder="https://…"
                      value={row.url}
                      onChange={(e) => {
                        const next = docs.slice()
                        next[i] = { ...row, url: e.target.value }
                        patchDocs(next)
                      }}
                      style={{ ...FIELD, flex: 2, minWidth: 160 }}
                    />
                    <button
                      type="button"
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        padding: '8px 10px',
                        color: 'var(--accent-coral)',
                        border: '1px solid var(--accent-coral)',
                        borderRadius: 8,
                      }}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Dieses Dokument aus dem Kundenportal entfernen?',
                          )
                        )
                          return
                        patchDocs(docs.filter((_, j) => j !== i))
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Optionale Beschreibung (nur Kundenportal)"
                    value={row.description ?? ''}
                    onChange={(e) => {
                      const next = docs.slice()
                      const v = e.target.value.trim()
                      next[i] = {
                        ...row,
                        description: v ? v : undefined,
                      }
                      patchDocs(next)
                    }}
                    style={{ ...FIELD, width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Kunden einladen"
        width={400}
      >
        <div className="flex flex-col gap-4">
          <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Wir legen einen Supabase-Auth-Account an — der Kunde bekommt eine E-Mail. Noch nicht
            angebunden: siehe TODO in{' '}
            <code style={{ fontSize: 11 }}>supabase/functions/invite-client/index.ts</code>.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              E-Mail des Kunden
            </span>
            <input
              type="email"
              autoComplete="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="kunde@firma.de"
              style={FIELD}
            />
          </label>
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--accent-teal)',
              background: 'color-mix(in srgb, var(--accent-teal) 18%, transparent)',
              color: 'var(--accent-teal)',
            }}
            onClick={() => {
              // TODO: Edge Function invite-client — admin.createUser + user_roles insert
              if (!inviteEmail.trim()) {
                show('Bitte eine E-Mail eingeben.', 'error')
                return
              }
              show(
                'Einladungs-Flow folgt per Edge Function (invite-client).',
                'success',
              )
              setInviteOpen(false)
            }}
          >
            Einladung vorbereiten
          </button>
        </div>
      </Drawer>
    </motion.div>
  )
}
